import { useActor } from "@/hooks/useActor";
import {
  CustomXTick,
  MONTH_NAMES,
  type XTickEntry,
  buildXTicks,
  computeXDomain,
} from "@/lib/chartXAxis";
import type { TSICDataPoint } from "@/lib/tsicDataParsing";
import { Plus, RefreshCw, X } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FormulaLine {
  id: string;
  name: string;
  expression: string;
  color: string;
  visible: boolean;
}

export interface BandConfig {
  id: string;
  name: string;
  sensors: number[];
  color: string;
  visible: boolean;
}

export interface AdvancedChartConfig {
  formulas: FormulaLine[];
  bands: BandConfig[];
}

interface AdvancedChartSectionProps {
  data: TSICDataPoint[];
  startIndex: number;
  endIndex: number;
  onRangeChange: (startIndex: number, endIndex: number) => void;
  selectedId: number;
  isAdmin: boolean;
  sensorLabels?: Map<number, string>;
}

// ─── Safe formula evaluator ───────────────────────────────────────────────────

type Token =
  | { type: "number"; value: number }
  | { type: "sensor"; num: number }
  | { type: "op"; op: "+" | "-" | "*" | "/" }
  | { type: "lparen" }
  | { type: "rparen" };

function tokenize(expr: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === "(") {
      tokens.push({ type: "lparen" });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "rparen" });
      i++;
      continue;
    }
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
      tokens.push({ type: "op", op: ch });
      i++;
      continue;
    }
    if (
      (ch === "S" || ch === "s") &&
      i + 1 < expr.length &&
      /\d/.test(expr[i + 1])
    ) {
      let j = i + 1;
      while (j < expr.length && /\d/.test(expr[j])) j++;
      const num = Number.parseInt(expr.slice(i + 1, j), 10);
      if (num >= 1 && num <= 72) {
        tokens.push({ type: "sensor", num });
        i = j;
        continue;
      }
    }
    if (
      /\d/.test(ch) ||
      (ch === "." && i + 1 < expr.length && /\d/.test(expr[i + 1]))
    ) {
      let j = i;
      while (j < expr.length && (/\d/.test(expr[j]) || expr[j] === ".")) j++;
      tokens.push({
        type: "number",
        value: Number.parseFloat(expr.slice(i, j)),
      });
      i = j;
      continue;
    }
    return null;
  }
  return tokens;
}

function evaluateFormula(
  expression: string,
  sensors: Record<string, number | undefined>,
): number | null {
  const tokens = tokenize(expression);
  if (!tokens) return null;
  const values: (number | null)[] = [];
  for (const tok of tokens) {
    if (tok.type === "sensor") {
      const v = sensors[`S${tok.num}`];
      if (v === undefined || v === null) return null;
      values.push(v);
    }
  }
  let vi = 0;
  const resolvedTokens: (number | string)[] = tokens.map((tok) => {
    if (tok.type === "number") return tok.value;
    if (tok.type === "sensor") return values[vi++] as number;
    if (tok.type === "lparen") return "(";
    if (tok.type === "rparen") return ")";
    return tok.op;
  });
  const precedence: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2 };
  const output: (number | string)[] = [];
  const opStack: string[] = [];
  for (const tok of resolvedTokens) {
    if (typeof tok === "number") {
      output.push(tok);
    } else if (tok === "(") {
      opStack.push(tok);
    } else if (tok === ")") {
      while (opStack.length > 0 && opStack[opStack.length - 1] !== "(")
        output.push(opStack.pop() as string);
      if (opStack.length === 0) return null;
      opStack.pop();
    } else {
      const p = precedence[tok] ?? 0;
      while (
        opStack.length > 0 &&
        opStack[opStack.length - 1] !== "(" &&
        (precedence[opStack[opStack.length - 1]] ?? 0) >= p
      )
        output.push(opStack.pop() as string);
      opStack.push(tok);
    }
  }
  while (opStack.length > 0) {
    const op = opStack.pop() as string;
    if (op === "(" || op === ")") return null;
    output.push(op);
  }
  const stack: number[] = [];
  for (const tok of output) {
    if (typeof tok === "number") {
      stack.push(tok);
    } else {
      if (stack.length < 2) return null;
      const b = stack.pop() as number;
      const a = stack.pop() as number;
      if (tok === "+") stack.push(a + b);
      else if (tok === "-") stack.push(a - b);
      else if (tok === "*") stack.push(a * b);
      else if (tok === "/") {
        if (b === 0) return null;
        stack.push(a / b);
      }
    }
  }
  if (stack.length !== 1) return null;
  return stack[0];
}

function validateExpression(expression: string): boolean {
  if (!expression.trim()) return false;
  const tokens = tokenize(expression);
  if (!tokens || tokens.length === 0) return false;
  try {
    const dummySensors: Record<string, number> = {};
    for (let i = 1; i <= 72; i++) dummySensors[`S${i}`] = 1;
    const result = evaluateFormula(expression, dummySensors);
    return result !== null && !Number.isNaN(result);
  } catch {
    return false;
  }
}

// ─── Color utilities ──────────────────────────────────────────────────────────

const PRESET_COLORS = [
  "#e74c3c",
  "#3498db",
  "#2ecc71",
  "#f39c12",
  "#9b59b6",
  "#1abc9c",
  "#e67e22",
  "#34495e",
  "#e91e63",
  "#00bcd4",
];
function randomColor(index: number): string {
  return PRESET_COLORS[index % PRESET_COLORS.length];
}

// ─── Parse sensor list ────────────────────────────────────────────────────────
function parseSensorList(s: string): number[] {
  return s
    .split(/[,;\s]+/)
    .map((x) => {
      const trimmed = x.trim().replace(/^[Ss]/, "");
      return Number.parseInt(trimmed, 10);
    })
    .filter((n) => !Number.isNaN(n) && n >= 1 && n <= 72);
}

// ─── Legend items ─────────────────────────────────────────────────────────────
function LegendLine({ color, name }: { color: string; name: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-5 h-0.5 rounded" style={{ backgroundColor: color }} />
      <span className="text-xs text-muted-foreground">{name}</span>
    </div>
  );
}
function LegendBand({ color, name }: { color: string; name: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="w-4 h-3 rounded-sm border"
        style={{ backgroundColor: color, opacity: 0.35, borderColor: color }}
      />
      <span className="text-xs text-muted-foreground">{name}</span>
    </div>
  );
}

// ─── Hover panel (right of chart) ─────────────────────────────────────────────
function AdvancedHoverPanel({
  payload,
  activeTimestamp,
  visibleFormulas,
  visibleBands,
}: {
  payload: any[];
  activeTimestamp: number | null;
  visibleFormulas: FormulaLine[];
  visibleBands: BandConfig[];
}) {
  if (!activeTimestamp || payload.length === 0) return null;
  const byKey: Record<string, number | null> = {};
  for (const p of payload)
    byKey[p.dataKey] = p.value != null ? Number(p.value) : null;
  const date = new Date(activeTimestamp);
  const timeStr = `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1).toString().padStart(2, "0")} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
  const formulaEntries = visibleFormulas.map((f) => ({
    id: f.id,
    name: f.name || f.expression,
    color: f.color,
    value: byKey[`formula_${f.id}`] ?? null,
  }));
  const bandEntries = visibleBands.map((b) => {
    const minVal = byKey[`band_min_${b.id}`] ?? null;
    const maxVal = byKey[`band_max_${b.id}`] ?? null;
    return { id: b.id, name: b.name, color: b.color, minVal, maxVal };
  });
  const hasAny =
    formulaEntries.some((e) => e.value !== null) ||
    bandEntries.some((e) => e.minVal !== null);
  if (!hasAny) return null;
  return (
    <div className="w-44 flex-shrink-0 pt-2 pl-2">
      <div
        className="rounded border border-border/40 bg-card/90 backdrop-blur-sm p-2 shadow-sm"
        style={{ fontSize: "10px", lineHeight: "1.4" }}
      >
        <div className="text-muted-foreground mb-1.5 font-medium">
          {timeStr}
        </div>
        {formulaEntries.map(
          (e) =>
            e.value !== null && (
              <div key={e.id} className="flex items-center gap-1 mb-0.5">
                <span
                  className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: e.color }}
                />
                <span className="text-muted-foreground truncate flex-1">
                  {e.name}
                </span>
                <span className="font-mono tabular-nums text-foreground flex-shrink-0">
                  {e.value.toFixed(2)}
                </span>
              </div>
            ),
        )}
        {bandEntries.map(
          (e) =>
            e.minVal !== null && (
              <div key={e.id} className="mb-0.5">
                <div className="flex items-center gap-1">
                  <span
                    className="inline-block w-2 h-2 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: e.color, opacity: 0.7 }}
                  />
                  <span className="text-muted-foreground truncate flex-1">
                    {e.name}
                  </span>
                </div>
                <div className="pl-3 text-muted-foreground/80">
                  <span>min: </span>
                  <span className="font-mono tabular-nums text-foreground">
                    {e.minVal?.toFixed(2)}
                  </span>
                  {" / max: "}
                  <span className="font-mono tabular-nums text-foreground">
                    {e.maxVal?.toFixed(2)}
                  </span>
                </div>
              </div>
            ),
        )}
      </div>
    </div>
  );
}

// ─── FormulaRow (stable outer component) ─────────────────────────────────────
interface FormulaRowProps {
  f: FormulaLine;
  index: number;
  onUpdate: (updated: FormulaLine) => void;
  onDelete: (id: string) => void;
}
function FormulaRow({ f, index, onUpdate, onDelete }: FormulaRowProps) {
  const [localName, setLocalName] = useState(f.name);
  const [localExpr, setLocalExpr] = useState(f.expression);
  const exprValid = localExpr === "" || validateExpression(localExpr);
  const prevId = useRef(f.id);
  useEffect(() => {
    if (prevId.current !== f.id) {
      prevId.current = f.id;
      setLocalName(f.name);
      setLocalExpr(f.expression);
    }
  }, [f.id, f.name, f.expression]);
  return (
    <div className="flex items-start gap-2 py-2 border-b border-border/30 last:border-0">
      <input
        type="color"
        value={f.color}
        onChange={(e) => onUpdate({ ...f, color: e.target.value })}
        className="w-7 h-7 rounded cursor-pointer border border-border flex-shrink-0 mt-0.5"
        title="Line color"
      />
      <div className="flex-1 min-w-0">
        <Input
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          onBlur={() => onUpdate({ ...f, name: localName })}
          placeholder="Name"
          className="h-7 text-xs mb-1"
          data-ocid={`tsic.advanced.formula.input.${index + 1}`}
        />
        <div className="relative">
          <Input
            value={localExpr}
            onChange={(e) => setLocalExpr(e.target.value)}
            onBlur={() => onUpdate({ ...f, expression: localExpr })}
            placeholder="e.g. (S1+S2)/2 or S3*2"
            className={`h-7 text-xs font-mono ${!exprValid && localExpr ? "border-red-400" : ""}`}
            data-ocid={`tsic.advanced.formula.expr.${index + 1}`}
          />
          {!exprValid && localExpr && (
            <p className="text-xs text-red-500 mt-0.5">
              Invalid — use S1..S72, +, -, *, /, (, )
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
        <button
          type="button"
          onClick={() => onUpdate({ ...f, visible: !f.visible })}
          className={`w-6 h-6 rounded text-xs border ${f.visible ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
          title={f.visible ? "Hide" : "Show"}
          data-ocid="tsic.advanced.formula.toggle"
        >
          {f.visible ? "👁" : "—"}
        </button>
        <button
          type="button"
          onClick={() => onDelete(f.id)}
          className="w-6 h-6 rounded text-xs border border-border text-muted-foreground hover:text-destructive hover:border-destructive"
          title="Delete"
          data-ocid={`tsic.advanced.formula.delete_button.${index + 1}`}
        >
          <X className="w-3 h-3 mx-auto" />
        </button>
      </div>
    </div>
  );
}

// ─── BandRow (stable outer component) ────────────────────────────────────────
interface BandRowProps {
  b: BandConfig;
  index: number;
  onUpdate: (updated: BandConfig) => void;
  onDelete: (id: string) => void;
}
function BandRow({ b, index, onUpdate, onDelete }: BandRowProps) {
  const [localName, setLocalName] = useState(b.name);
  const [localSensors, setLocalSensors] = useState(
    b.sensors.length > 0 ? b.sensors.join(", ") : "",
  );
  const prevId = useRef(b.id);
  useEffect(() => {
    if (prevId.current !== b.id) {
      prevId.current = b.id;
      setLocalName(b.name);
      setLocalSensors(b.sensors.length > 0 ? b.sensors.join(", ") : "");
    }
  }, [b.id, b.name, b.sensors]);
  return (
    <div className="flex items-start gap-2 py-2 border-b border-border/30 last:border-0">
      <input
        type="color"
        value={b.color}
        onChange={(e) => onUpdate({ ...b, color: e.target.value })}
        className="w-7 h-7 rounded cursor-pointer border border-border flex-shrink-0 mt-0.5"
        title="Band color"
      />
      <div className="flex-1 min-w-0">
        <Input
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          onBlur={() => onUpdate({ ...b, name: localName })}
          placeholder="Band name"
          className="h-7 text-xs mb-1"
          data-ocid={`tsic.advanced.band.name.${index + 1}`}
        />
        <Input
          value={localSensors}
          onChange={(e) => setLocalSensors(e.target.value)}
          onBlur={() =>
            onUpdate({ ...b, sensors: parseSensorList(localSensors) })
          }
          placeholder="1, 2, 5  or  S1, S2, S5"
          className="h-7 text-xs"
          data-ocid={`tsic.advanced.band.sensors.${index + 1}`}
        />
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Sensor numbers 1–72, comma-separated. Tab or click away to apply.
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
        <button
          type="button"
          onClick={() => onUpdate({ ...b, visible: !b.visible })}
          className={`w-6 h-6 rounded text-xs border ${b.visible ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
          title={b.visible ? "Hide" : "Show"}
          data-ocid="tsic.advanced.band.toggle"
        >
          {b.visible ? "👁" : "—"}
        </button>
        <button
          type="button"
          onClick={() => onDelete(b.id)}
          className="w-6 h-6 rounded text-xs border border-border text-muted-foreground hover:text-destructive hover:border-destructive"
          title="Delete"
          data-ocid={`tsic.advanced.band.delete_button.${index + 1}`}
        >
          <X className="w-3 h-3 mx-auto" />
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AdvancedChartSection({
  data,
  startIndex,
  endIndex,
  onRangeChange,
  selectedId,
  isAdmin,
}: AdvancedChartSectionProps) {
  const { actor, isFetching: actorFetching } = useActor();

  const [formulas, setFormulas] = useState<FormulaLine[]>([]);
  const [bands, setBands] = useState<BandConfig[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showReset, setShowReset] = useState(false);

  const [yMin, setYMin] = useState<number | undefined>(undefined);
  const [yMax, setYMax] = useState<number | undefined>(undefined);

  // Drag-zoom
  const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<string | null>(null);
  const selectingRef = useRef(false);
  const [hoverX, setHoverX] = useState<number | null>(null);

  // Hover panel
  const [hoverPayload, setHoverPayload] = useState<any[]>([]);
  const [hoverTimestamp, setHoverTimestamp] = useState<number | null>(null);

  const savedRef = useRef<string>("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load from backend ──
  useEffect(() => {
    if (!isAdmin || !actor || actorFetching) return;
    setLoaded(false);
    (actor as any)
      .getAdvancedChartConfigForId(BigInt(selectedId))
      .then((json: string) => {
        if (json?.trim()) {
          try {
            const cfg: AdvancedChartConfig = JSON.parse(json);
            setFormulas(cfg.formulas ?? []);
            setBands(cfg.bands ?? []);
            savedRef.current = json;
          } catch {
            setFormulas([]);
            setBands([]);
          }
        } else {
          setFormulas([]);
          setBands([]);
          savedRef.current = "";
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [actor, actorFetching, selectedId, isAdmin]);

  // ── Save with debounce ──
  const saveConfig = useCallback(
    (newFormulas: FormulaLine[], newBands: BandConfig[]) => {
      if (!isAdmin || !actor || !loaded) return;
      const json = JSON.stringify({ formulas: newFormulas, bands: newBands });
      if (json === savedRef.current) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        savedRef.current = json;
        (actor as any)
          .saveAdvancedChartConfigForId(BigInt(selectedId), json)
          .catch(() => {});
      }, 800);
    },
    [actor, isAdmin, loaded, selectedId],
  );

  const handleFormulaUpdate = useCallback(
    (updated: FormulaLine) => {
      setFormulas((prev) => {
        const next = prev.map((x) => (x.id === updated.id ? updated : x));
        saveConfig(next, bands);
        return next;
      });
    },
    [bands, saveConfig],
  );

  const handleFormulaDelete = useCallback(
    (id: string) => {
      setFormulas((prev) => {
        const next = prev.filter((x) => x.id !== id);
        saveConfig(next, bands);
        return next;
      });
    },
    [bands, saveConfig],
  );

  const handleBandUpdate = useCallback(
    (updated: BandConfig) => {
      setBands((prev) => {
        const next = prev.map((x) => (x.id === updated.id ? updated : x));
        saveConfig(formulas, next);
        return next;
      });
    },
    [formulas, saveConfig],
  );

  const handleBandDelete = useCallback(
    (id: string) => {
      setBands((prev) => {
        const next = prev.filter((x) => x.id !== id);
        saveConfig(formulas, next);
        return next;
      });
    },
    [formulas, saveConfig],
  );

  const updateFormulas = useCallback(
    (updated: FormulaLine[]) => {
      setFormulas(updated);
      saveConfig(updated, bands);
    },
    [bands, saveConfig],
  );

  const updateBands = useCallback(
    (updated: BandConfig[]) => {
      setBands(updated);
      saveConfig(formulas, updated);
    },
    [formulas, saveConfig],
  );

  // ── Chart data — uses FULL data, sliced by startIndex/endIndex ──
  const visibleData = useMemo(
    () => data.slice(startIndex, endIndex + 1),
    [data, startIndex, endIndex],
  );

  const chartData = useMemo(() => {
    return visibleData.map((point) => {
      const row: Record<string, number | null | undefined> = {
        timestamp: point.timestamp.getTime(),
      };
      // Formula lines
      for (const f of formulas) {
        if (f.visible && f.expression) {
          row[`formula_${f.id}`] = evaluateFormula(
            f.expression,
            point.sensors as Record<string, number>,
          );
        }
      }
      // Bands: store base (min) and size (max-min) for stacked Area rendering,
      // plus keep min/max for the hover panel display
      for (const b of bands) {
        if (b.visible && b.sensors.length > 0) {
          const values = b.sensors
            .map(
              (sNum) =>
                (point.sensors as Record<string, number | undefined>)[
                  `S${sNum}`
                ],
            )
            .filter(
              (v): v is number =>
                v !== undefined && v !== null && !Number.isNaN(v),
            );
          if (values.length > 0) {
            const minVal = Math.min(...values);
            const maxVal = Math.max(...values);
            row[`band_min_${b.id}`] = minVal;
            row[`band_max_${b.id}`] = maxVal;
            // base = min value (invisible stacked area pushes band up)
            row[`band_base_${b.id}`] = minVal;
            // size = height of the band (visible colored area)
            row[`band_size_${b.id}`] = maxVal - minVal;
          } else {
            row[`band_min_${b.id}`] = undefined;
            row[`band_max_${b.id}`] = undefined;
            row[`band_base_${b.id}`] = undefined;
            row[`band_size_${b.id}`] = undefined;
          }
        }
      }
      return row;
    });
  }, [visibleData, formulas, bands]);

  // ── X-axis ──
  const { xTicks, xDomain } = useMemo(() => {
    if (visibleData.length === 0)
      return { xTicks: [], xDomain: [0, 1] as [number, number] };
    const firstTs = visibleData[0].timestamp.getTime();
    const lastTs = visibleData[visibleData.length - 1].timestamp.getTime();
    return {
      xTicks: buildXTicks(firstTs, lastTs),
      xDomain: computeXDomain(firstTs, lastTs),
    };
  }, [visibleData]);

  // ── Y-axis domain ──
  // Include band values in auto-domain so they're always visible
  const yDomain = useMemo((): [number | string, number | string] => {
    if (yMin !== undefined && yMax !== undefined) return [yMin, yMax];
    if (yMin !== undefined) return [yMin, "auto"];
    if (yMax !== undefined) return ["auto", yMax];

    // Auto: compute from formulas + bands
    if (chartData.length === 0) return ["auto", "auto"];
    let globalMin = Number.POSITIVE_INFINITY;
    let globalMax = Number.NEGATIVE_INFINITY;
    const visibleFormulas = formulas.filter((f) => f.visible && f.expression);
    const visibleBands = bands.filter((b) => b.visible && b.sensors.length > 0);
    for (const row of chartData) {
      for (const f of visibleFormulas) {
        const v = row[`formula_${f.id}`];
        if (v != null && !Number.isNaN(v)) {
          globalMin = Math.min(globalMin, v);
          globalMax = Math.max(globalMax, v);
        }
      }
      for (const b of visibleBands) {
        const vMin = row[`band_min_${b.id}`];
        const vMax = row[`band_max_${b.id}`];
        if (vMin != null && !Number.isNaN(vMin))
          globalMin = Math.min(globalMin, vMin);
        if (vMax != null && !Number.isNaN(vMax))
          globalMax = Math.max(globalMax, vMax);
      }
    }
    if (!Number.isFinite(globalMin) || !Number.isFinite(globalMax))
      return ["auto", "auto"];
    const padding = (globalMax - globalMin) * 0.05 || 1;
    return [globalMin - padding, globalMax + padding];
  }, [yMin, yMax, chartData, formulas, bands]);

  // ── Zoom drag ──
  const handleMouseDown = useCallback((e: any) => {
    if (!e?.activeLabel) return;
    setRefAreaLeft(String(e.activeLabel));
    setRefAreaRight(null);
    selectingRef.current = true;
  }, []);

  const handleMouseMove = useCallback((e: any) => {
    if (e?.activeLabel) setHoverX(Number(e.activeLabel));
    if (e?.activePayload?.length) {
      setHoverPayload(e.activePayload);
      setHoverTimestamp(e.activeLabel ?? null);
    }
    if (selectingRef.current && e?.activeLabel)
      setRefAreaRight(String(e.activeLabel));
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!selectingRef.current) return;
    selectingRef.current = false;
    if (!refAreaLeft || !refAreaRight || refAreaLeft === refAreaRight) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }
    const l = Math.min(Number(refAreaLeft), Number(refAreaRight));
    const r = Math.max(Number(refAreaLeft), Number(refAreaRight));
    // Search in the FULL data array for absolute indices
    let foundStart = -1;
    let foundEnd = -1;
    for (let i = 0; i < data.length; i++) {
      const ts = data[i].timestamp.getTime();
      if (foundStart === -1 && ts >= l) foundStart = i;
      if (ts <= r) foundEnd = i;
    }
    if (foundStart !== -1 && foundEnd !== -1 && foundStart <= foundEnd) {
      onRangeChange(foundStart, foundEnd);
    }
    setRefAreaLeft(null);
    setRefAreaRight(null);
  }, [refAreaLeft, refAreaRight, data, onRangeChange]);

  const handleMouseLeave = useCallback(() => {
    setHoverX(null);
    setHoverPayload([]);
    setHoverTimestamp(null);
    if (selectingRef.current) {
      selectingRef.current = false;
      setRefAreaLeft(null);
      setRefAreaRight(null);
    }
  }, []);

  const visibleFormulas = formulas.filter((f) => f.visible && f.expression);
  const visibleBands = bands.filter((b) => b.visible && b.sensors.length > 0);
  const hasContent = formulas.length > 0 || bands.length > 0;
  const hasVisibleContent =
    visibleFormulas.length > 0 || visibleBands.length > 0;

  // suppress unused import warning — MONTH_NAMES is used by chartXAxis helpers
  void MONTH_NAMES;

  return (
    <div
      className="mt-2 rounded-xl border border-border bg-card shadow-sm"
      data-ocid="tsic.advanced.panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div>
          <h3 className="font-semibold text-sm">Advanced Chart</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Formula lines and sensor bands — shared zoom with main chart
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowReset(true)}
            className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 px-2 py-1 rounded border border-border/50 hover:border-destructive/50 transition-colors"
            data-ocid="tsic.advanced.delete_button"
          >
            <RefreshCw className="w-3 h-3" />
            Reset
          </button>
        )}
      </div>

      {!isAdmin ? (
        <div className="p-4 text-sm text-muted-foreground text-center">
          Admin access required to configure advanced charts
        </div>
      ) : (
        <>
          {/* Chart — only shown when there's content AND visible data */}
          {hasContent &&
            hasVisibleContent &&
            visibleData.length > 0 &&
            chartData.length > 0 && (
              <div className="p-4 pb-2">
                {/* Y-axis controls */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-muted-foreground">Y-axis:</span>
                  <Input
                    type="number"
                    placeholder="Min (auto)"
                    value={yMin !== undefined ? yMin : ""}
                    onChange={(e) =>
                      setYMin(
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                      )
                    }
                    className="h-7 w-24 text-xs"
                    data-ocid="tsic.advanced.input"
                  />
                  <Input
                    type="number"
                    placeholder="Max (auto)"
                    value={yMax !== undefined ? yMax : ""}
                    onChange={(e) =>
                      setYMax(
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                      )
                    }
                    className="h-7 w-24 text-xs"
                    data-ocid="tsic.advanced.input"
                  />
                  {(yMin !== undefined || yMax !== undefined) && (
                    <button
                      type="button"
                      onClick={() => {
                        setYMin(undefined);
                        setYMax(undefined);
                      }}
                      className="h-7 px-2 text-xs rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
                      data-ocid="tsic.advanced.secondary_button"
                    >
                      Reset
                    </button>
                  )}
                </div>

                {/* Chart + hover panel side by side */}
                <div className="flex gap-4 items-start">
                  <div
                    className="flex-1 min-w-0"
                    style={{ userSelect: "none" }}
                  >
                    <ResponsiveContainer width="100%" height={450}>
                      <ComposedChart
                        data={chartData}
                        margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseLeave}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          strokeOpacity={0.2}
                        />
                        <XAxis
                          dataKey="timestamp"
                          type="number"
                          scale="time"
                          domain={xDomain}
                          ticks={xTicks.map((t) => t.timestamp)}
                          tick={
                            <CustomXTick allTicks={xTicks as XTickEntry[]} />
                          }
                          tickLine={false}
                          axisLine={{ strokeOpacity: 0.3 }}
                          interval={0}
                          allowDataOverflow
                          height={45}
                        />
                        <YAxis
                          tickFormatter={(v) =>
                            Number.parseFloat(v.toFixed(2)).toString()
                          }
                          tick={{ fontSize: 11 }}
                          axisLine={{ strokeOpacity: 0.3 }}
                          tickLine={false}
                          width={50}
                          domain={yDomain}
                          allowDataOverflow
                        />

                        {/*
                         * Bands: rendered using two stacked <Area> components per band.
                         * - band_base: invisible area that "lifts" the visible area to the min value
                         * - band_size: the visible colored area (max - min height)
                         * Both share the same stackId so Recharts stacks them correctly.
                         * Invisible <Line> components for band_min/band_max capture hover payload
                         * for the AdvancedHoverPanel.
                         */}
                        {visibleBands.map((b) => (
                          <React.Fragment key={`band_${b.id}`}>
                            {/* Invisible base — pushes the colored band up to the min value */}
                            <Area
                              type="monotone"
                              dataKey={`band_base_${b.id}`}
                              stroke="none"
                              fill="none"
                              stackId={`band_${b.id}`}
                              dot={false}
                              isAnimationActive={false}
                              legendType="none"
                              connectNulls={false}
                            />
                            {/* Visible colored band (min → max range) */}
                            <Area
                              type="monotone"
                              dataKey={`band_size_${b.id}`}
                              stroke={b.color}
                              fill={b.color}
                              fillOpacity={0.25}
                              strokeOpacity={0.5}
                              strokeWidth={1}
                              stackId={`band_${b.id}`}
                              dot={false}
                              isAnimationActive={false}
                              legendType="none"
                              connectNulls={false}
                            />
                            {/* Invisible lines so hover payload captures band_min/band_max */}
                            <Line
                              type="monotone"
                              dataKey={`band_min_${b.id}`}
                              stroke="transparent"
                              strokeWidth={0}
                              dot={false}
                              isAnimationActive={false}
                              legendType="none"
                            />
                            <Line
                              type="monotone"
                              dataKey={`band_max_${b.id}`}
                              stroke="transparent"
                              strokeWidth={0}
                              dot={false}
                              isAnimationActive={false}
                              legendType="none"
                            />
                          </React.Fragment>
                        ))}

                        {/* Formula lines */}
                        {visibleFormulas.map((f) => (
                          <Line
                            key={`formula_${f.id}`}
                            type="monotone"
                            dataKey={`formula_${f.id}`}
                            stroke={f.color}
                            strokeWidth={1.5}
                            dot={false}
                            isAnimationActive={false}
                            connectNulls={false}
                            legendType="none"
                            name={f.name}
                          />
                        ))}

                        {/* Hover cursor line */}
                        {hoverX !== null && (
                          <ReferenceLine
                            x={hoverX}
                            stroke="#888888"
                            strokeWidth={1}
                            strokeDasharray="4 2"
                          />
                        )}

                        {/* Drag selection area */}
                        {refAreaLeft && refAreaRight && (
                          <ReferenceArea
                            x1={Number(refAreaLeft)}
                            x2={Number(refAreaRight)}
                            strokeOpacity={0.3}
                            fill="oklch(var(--primary))"
                            fillOpacity={0.2}
                            stroke="oklch(var(--primary))"
                          />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Hover side panel */}
                  <AdvancedHoverPanel
                    payload={hoverPayload}
                    activeTimestamp={hoverTimestamp}
                    visibleFormulas={visibleFormulas}
                    visibleBands={visibleBands}
                  />
                </div>

                {/* Legend */}
                {(visibleFormulas.length > 0 || visibleBands.length > 0) && (
                  <div className="flex flex-wrap gap-3 px-2 pt-1 pb-2">
                    {visibleFormulas.map((f) => (
                      <LegendLine
                        key={f.id}
                        color={f.color}
                        name={f.name || f.expression}
                      />
                    ))}
                    {visibleBands.map((b) => (
                      <LegendBand key={b.id} color={b.color} name={b.name} />
                    ))}
                  </div>
                )}
              </div>
            )}

          {/* Editor */}
          <div className="p-4 space-y-4">
            {/* Formulas section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Formula Lines
                </Label>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-xs px-2 gap-1"
                  onClick={() => {
                    const newF: FormulaLine = {
                      id: crypto.randomUUID(),
                      name: `Formula ${formulas.length + 1}`,
                      expression: "",
                      color: randomColor(formulas.length),
                      visible: true,
                    };
                    updateFormulas([...formulas, newF]);
                  }}
                  data-ocid="tsic.advanced.formula.button"
                >
                  <Plus className="w-3 h-3" />
                  Add Formula
                </Button>
              </div>
              {formulas.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  No formulas yet. Add one to plot a calculated line.
                </p>
              ) : (
                <div className="space-y-0">
                  {formulas.map((f, i) => (
                    <FormulaRow
                      key={f.id}
                      f={f}
                      index={i}
                      onUpdate={handleFormulaUpdate}
                      onDelete={handleFormulaDelete}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Bands section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Sensor Bands
                </Label>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-xs px-2 gap-1"
                  onClick={() => {
                    const newB: BandConfig = {
                      id: crypto.randomUUID(),
                      name: `Band ${bands.length + 1}`,
                      sensors: [],
                      color: randomColor(bands.length + 5),
                      visible: true,
                    };
                    updateBands([...bands, newB]);
                  }}
                  data-ocid="tsic.advanced.band.button"
                >
                  <Plus className="w-3 h-3" />
                  Add Band
                </Button>
              </div>
              {bands.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  No bands yet. Add one to display a min/max range between
                  sensors.
                </p>
              ) : (
                <div className="space-y-0">
                  {bands.map((b, i) => (
                    <BandRow
                      key={b.id}
                      b={b}
                      index={i}
                      onUpdate={handleBandUpdate}
                      onDelete={handleBandDelete}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Reset confirmation */}
      <Dialog open={showReset} onOpenChange={setShowReset}>
        <DialogContent data-ocid="tsic.advanced.dialog">
          <DialogHeader>
            <DialogTitle>Reset Advanced Chart</DialogTitle>
            <DialogDescription>
              Are you sure you want to reset all formulas and bands for logger
              ID {selectedId}? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowReset(false)}
              data-ocid="tsic.advanced.cancel_button"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                updateFormulas([]);
                updateBands([]);
                setShowReset(false);
              }}
              data-ocid="tsic.advanced.confirm_button"
            >
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
