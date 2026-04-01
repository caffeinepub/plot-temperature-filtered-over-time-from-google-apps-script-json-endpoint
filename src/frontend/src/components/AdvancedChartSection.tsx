import { useActor } from "@/hooks/useActor";
import {
  CustomXTick,
  MONTH_NAMES,
  type XTickEntry,
  buildXTicks,
  computeXDomain,
} from "@/lib/chartXAxis";
import type { TSICDataPoint } from "@/lib/tsicDataParsing";
import { GripVertical, Plus, RefreshCw, X } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Brush,
  CartesianGrid,
  ComposedChart,
  Customized,
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

// ─── Types ───────────────────────────────────────────────────────────────────────────────

export interface FormulaLine {
  id: string;
  name: string;
  expression: string;
  color: string;
  visible: boolean;
  bold?: boolean;
  dotted?: boolean;
}

export interface BandConfig {
  id: string;
  name: string;
  sensors: number[];
  color: string;
  visible: boolean;
}

export interface EventConfig {
  id: string;
  timestamp: number; // ms since epoch
  label: string;
  displayOrder?: number;
}

export interface AdvancedChartConfig {
  formulas: FormulaLine[];
  bands: BandConfig[];
  events?: EventConfig[];
  testStartMs?: number;
}

// ─── Incubation helpers ───────────────────────────────────────────────────────
function msToIncubation(durationMs: number): string {
  const totalMinutes = Math.floor(durationMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return `D${String(days).padStart(2, "0")} H${String(hours).padStart(2, "0")} M${String(minutes).padStart(2, "0")}`;
}

function incubationToMs(str: string): number | null {
  const dMatch = str.match(/D(\d+)/i);
  const hMatch = str.match(/H(\d+)/i);
  const mMatch = str.match(/M(\d+)/i);
  const d = dMatch ? Number.parseInt(dMatch[1]) : 0;
  const h = hMatch ? Number.parseInt(hMatch[1]) : 0;
  const m = mMatch ? Number.parseInt(mMatch[1]) : 0;
  if (dMatch || hMatch || mMatch) {
    return ((d * 24 + h) * 60 + m) * 60000;
  }
  return null;
}

interface AdvancedChartSectionProps {
  data: TSICDataPoint[];
  startIndex: number;
  endIndex: number;
  onRangeChange: (startIndex: number, endIndex: number) => void;
  selectedId: number;
  isAdmin: boolean;
  sensorLabels?: Map<number, string>;
  initialConfigJson?: string;
  /** When true, changes are NOT saved to the backend. Use onConfigChange to capture them. */
  localOnly?: boolean;
  onConfigChange?: (json: string) => void;
}

// ─── Safe formula evaluator ───────────────────────────────────────────────────────────────────

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

// ─── Function pre-processor (avg, min, max, median, range — all skip zeros) ────────────────
function preprocessFunctions(
  expr: string,
  sensors: Record<string, number | undefined>,
): string | null {
  // Match innermost function call (no nested parens inside args)
  const funcRegex = /\b(avg|min|max|median|range)\(([^()]*)\)/i;
  let result = expr;
  let iterations = 0;
  let match: RegExpExecArray | null = funcRegex.exec(result);
  while (match !== null) {
    if (++iterations > 100) return null;
    const [fullMatch, funcName, argsStr] = match;
    const args = argsStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const values: number[] = [];
    for (const arg of args) {
      const sensorMatch = /^[Ss](\d+)$/.exec(arg);
      const numMatch = /^-?\d+(\.\d+)?$/.exec(arg);
      if (sensorMatch) {
        const num = Number.parseInt(sensorMatch[1], 10);
        const v = sensors[`S${num}`];
        if (v === undefined || v === null) return null;
        if (v !== 0) values.push(v); // skip zeros
      } else if (numMatch) {
        const v = Number.parseFloat(arg);
        if (v !== 0) values.push(v); // skip zeros
      } else {
        return null;
      }
    }
    if (values.length === 0) return null;
    const fn = funcName.toLowerCase();
    let resultVal: number;
    if (fn === "avg") {
      resultVal = values.reduce((a, b) => a + b, 0) / values.length;
    } else if (fn === "min") {
      resultVal = Math.min(...values);
    } else if (fn === "max") {
      resultVal = Math.max(...values);
    } else if (fn === "median") {
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      resultVal =
        sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];
    } else if (fn === "range") {
      resultVal = Math.max(...values) - Math.min(...values);
    } else {
      return null;
    }
    result =
      result.slice(0, match.index) +
      resultVal.toString() +
      result.slice(match.index + fullMatch.length);
    match = funcRegex.exec(result);
  }
  return result;
}

function evaluateFormula(
  expression: string,
  sensors: Record<string, number | undefined>,
): number | null {
  const preprocessed = preprocessFunctions(expression, sensors);
  if (preprocessed === null) return null;
  const tokens = tokenize(preprocessed);
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
  try {
    const dummySensors: Record<string, number> = {};
    for (let i = 1; i <= 72; i++) dummySensors[`S${i}`] = 1;
    const result = evaluateFormula(expression, dummySensors);
    return result !== null && !Number.isNaN(result);
  } catch {
    return false;
  }
}

// ─── Color utilities ───────────────────────────────────────────────────────────────────────────

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

function parseSensorList(s: string): number[] {
  return s
    .split(/[,;\s]+/)
    .map((x) => {
      const trimmed = x.trim().replace(/^[Ss]/, "");
      return Number.parseInt(trimmed, 10);
    })
    .filter((n) => !Number.isNaN(n) && n >= 1 && n <= 72);
}

// ─── BandPolygon ────────────────────────────────────────────────────────────────────────────────

interface BandPolygonProps {
  xAxisMap?: Record<string, { scale: (v: number) => number }>;
  yAxisMap?: Record<string, { scale: (v: number) => number }>;
  offset?: { top: number; left: number; width: number; height: number };
  chartData: Record<string, unknown>[];
  band: BandConfig;
  fillOpacity?: number;
}

function BandPolygon({
  xAxisMap,
  yAxisMap,
  offset,
  chartData,
  band,
  fillOpacity = 0.3,
}: BandPolygonProps) {
  if (!xAxisMap || !yAxisMap || !offset) return null;
  const xAxis = Object.values(xAxisMap)[0];
  const yAxis = Object.values(yAxisMap)[0];
  if (!xAxis?.scale || !yAxis?.scale) return null;
  const xScale = xAxis.scale;
  const yScale = yAxis.scale;
  const topPoints: [number, number][] = [];
  const bottomPoints: [number, number][] = [];
  for (const point of chartData) {
    const bandData = point[`band_area_${band.id}`];
    if (!Array.isArray(bandData)) continue;
    const [minV, maxV] = bandData as [number, number];
    if (
      minV == null ||
      maxV == null ||
      Number.isNaN(minV) ||
      Number.isNaN(maxV)
    )
      continue;
    const x = xScale(point.timestamp as number);
    const yTop = yScale(maxV);
    const yBottom = yScale(minV);
    topPoints.push([x, yTop]);
    bottomPoints.unshift([x, yBottom]);
  }
  if (topPoints.length < 2) return null;
  const allPoints = [...topPoints, ...bottomPoints];
  const d = `M ${allPoints.map(([x, y]) => `${x},${y}`).join(" L ")} Z`;
  const clipId = `band-clip-${band.id}`;
  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <rect
            x={offset.left}
            y={offset.top}
            width={offset.width}
            height={offset.height}
          />
        </clipPath>
      </defs>
      <path
        d={d}
        fill={band.color}
        fillOpacity={fillOpacity}
        stroke="none"
        clipPath={`url(#${clipId})`}
      />
    </g>
  );
}

// ─── Hover panel ──────────────────────────────────────────────────────────────────────────────
function AdvancedHoverPanel({
  payload,
  activeTimestamp,
  visibleFormulas,
  visibleBands,
  chartData,
  hasContent,
}: {
  payload: any[];
  activeTimestamp: number | null;
  visibleFormulas: FormulaLine[];
  visibleBands: BandConfig[];
  chartData: Record<string, unknown>[];
  hasContent: boolean;
}) {
  if (!hasContent) return null;
  const isHovering = !!activeTimestamp && payload.length > 0;
  const byKey: Record<string, number | null> = {};
  for (const p of payload)
    byKey[p.dataKey] = p.value != null ? Number(p.value) : null;
  // Look up band min/max directly from chartData to avoid invisible-line payload issues
  const dataRow = isHovering
    ? chartData.find((d) => d.timestamp === activeTimestamp)
    : undefined;
  const timeStr =
    isHovering && activeTimestamp
      ? (() => {
          const date = new Date(activeTimestamp);
          return `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1).toString().padStart(2, "0")} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
        })()
      : null;
  const formulaEntries = visibleFormulas.map((f) => ({
    id: f.id,
    name: f.name || f.expression,
    color: f.color,
    value: isHovering ? (byKey[`formula_${f.id}`] ?? null) : null,
  }));
  const bandEntries = visibleBands.map((b) => {
    const minRaw = dataRow ? dataRow[`band_min_${b.id}`] : undefined;
    const maxRaw = dataRow ? dataRow[`band_max_${b.id}`] : undefined;
    const minVal = isHovering && minRaw != null ? Number(minRaw) : null;
    const maxVal = isHovering && maxRaw != null ? Number(maxRaw) : null;
    return { id: b.id, name: b.name, color: b.color, minVal, maxVal };
  });
  return (
    <div className="w-full md:w-44 md:flex-shrink-0 md:pt-2 md:pl-2 mt-2 md:mt-0">
      <div
        className="rounded border border-border/40 bg-card/90 backdrop-blur-sm p-2 shadow-sm"
        style={{ fontSize: "10px", lineHeight: "1.4" }}
      >
        {timeStr && (
          <div className="text-muted-foreground mb-1.5 font-medium">
            {timeStr}
          </div>
        )}
        {formulaEntries.map((e) => (
          <div key={e.id} className="flex items-center gap-1 mb-0.5">
            <span
              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: e.color }}
            />
            <span className="text-muted-foreground truncate flex-1">
              {e.name}
            </span>
            {e.value !== null && (
              <span className="font-mono tabular-nums text-foreground flex-shrink-0">
                {e.value.toFixed(2)}
              </span>
            )}
          </div>
        ))}
        {bandEntries.map((e) => (
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
            {e.minVal !== null && (
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
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── EventRow ──────────────────────────────────────────────────────────────────────────────
interface EventRowProps {
  ev: EventConfig;
  index: number;
  testStartMs?: number;
  onUpdate: (updated: EventConfig) => void;
  onDelete: (id: string) => void;
  onSetIncubation: (evId: string, incubationMs: number) => void;
  onDragStart?: (id: string) => void;
  onDragOver?: (id: string) => void;
  onDrop?: (id: string) => void;
}
function toDatetimeLocal(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EventRow({
  ev,
  onUpdate,
  onDelete,
  onSetIncubation,
  testStartMs,
  onDragStart,
  onDragOver,
  onDrop,
}: EventRowProps) {
  const [localLabel, setLocalLabel] = useState(ev.label);
  const [localDatetime, setLocalDatetime] = useState(
    toDatetimeLocal(ev.timestamp),
  );
  const [localIncubation, setLocalIncubation] = useState(
    testStartMs !== undefined ? msToIncubation(ev.timestamp - testStartMs) : "",
  );
  const prevId = useRef(ev.id);
  useEffect(() => {
    if (prevId.current !== ev.id) {
      prevId.current = ev.id;
      setLocalLabel(ev.label);
      setLocalDatetime(toDatetimeLocal(ev.timestamp));
    }
  }, [ev.id, ev.label, ev.timestamp]);
  useEffect(() => {
    setLocalIncubation(
      testStartMs !== undefined
        ? msToIncubation(ev.timestamp - testStartMs)
        : "",
    );
  }, [testStartMs, ev.timestamp]);

  return (
    <div
      className="flex items-center gap-2 py-2 border-b border-border/30 last:border-0"
      draggable
      onDragStart={
        onDragStart
          ? (e) => {
              e.dataTransfer.effectAllowed = "move";
              onDragStart(ev.id);
            }
          : undefined
      }
      onDragOver={
        onDragOver
          ? (e) => {
              e.preventDefault();
            }
          : undefined
      }
      onDrop={
        onDrop
          ? (e) => {
              e.preventDefault();
              onDrop(ev.id);
            }
          : undefined
      }
    >
      <button
        type="button"
        className="cursor-grab text-muted-foreground hover:text-foreground flex-shrink-0"
        title="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <input
        type="datetime-local"
        value={localDatetime}
        onChange={(e) => setLocalDatetime(e.target.value)}
        onBlur={() => {
          const ms = new Date(localDatetime).getTime();
          if (!Number.isNaN(ms)) onUpdate({ ...ev, timestamp: ms });
        }}
        className="h-7 text-xs rounded border border-border bg-background px-1.5 flex-shrink-0"
        style={{ width: 175 }}
      />
      <input
        type="text"
        value={localIncubation}
        onChange={(e) => setLocalIncubation(e.target.value)}
        onBlur={() => {
          const ms = incubationToMs(localIncubation);
          if (ms !== null) onSetIncubation(ev.id, ms);
        }}
        placeholder="D00 H00 M00"
        title="Incubation time (e.g. D05 H14 M30)"
        className="h-7 text-xs rounded border border-border bg-background px-1.5 flex-shrink-0"
        style={{ width: 110 }}
      />
      <Input
        value={localLabel}
        onChange={(e) => setLocalLabel(e.target.value)}
        onBlur={() => onUpdate({ ...ev, label: localLabel })}
        placeholder="Event label"
        className="h-7 text-xs flex-1"
      />
      <button
        type="button"
        onClick={() => onDelete(ev.id)}
        className="w-6 h-6 rounded text-xs border border-border text-muted-foreground hover:text-destructive hover:border-destructive flex-shrink-0"
        title="Delete event"
      >
        <X className="w-3 h-3 mx-auto" />
      </button>
    </div>
  );
}

// ─── FormulaRow ──────────────────────────────────────────────────────────────────────────────
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
          {f.visible ? "\ud83d\udc41" : "—"}
        </button>
        <button
          type="button"
          onClick={() => onUpdate({ ...f, bold: !f.bold })}
          className={`w-6 h-6 rounded text-xs border font-bold ${f.bold ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
          title={f.bold ? "Remove bold" : "Make bold"}
          data-ocid={`tsic.advanced.formula.toggle.${index + 1}`}
        >
          B
        </button>
        <button
          type="button"
          onClick={() => onUpdate({ ...f, dotted: !f.dotted })}
          className={`w-6 h-6 rounded text-xs border ${f.dotted ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
          title={f.dotted ? "Remove dotted" : "Make dotted"}
          data-ocid={`tsic.advanced.formula.toggle.${index + 1}`}
        >
          D
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

// ─── BandRow ───────────────────────────────────────────────────────────────────────────────
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
          {b.visible ? "\ud83d\udc41" : "—"}
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

// ─── makeEventLabel ──────────────────────────────────────────────────────────────────────────────
function makeEventLabel(label: string) {
  return (props: { viewBox?: { x: number; y: number; height: number } }) => {
    const { viewBox } = props;
    if (!viewBox) return <g />;
    const { x, y, height } = viewBox;
    return (
      <text
        x={x + 10}
        y={y + height - 6}
        transform={`rotate(-90, ${x + 10}, ${y + height - 6})`}
        fontSize={13}
        fill="#000000"
        style={{ userSelect: "none", pointerEvents: "none" }}
      >
        {label}
      </text>
    );
  };
}

const ALL_SENSOR_KEYS = Array.from(
  { length: 72 },
  (_, i) => `sensor_S${i + 1}`,
);

// ─── Main component ──────────────────────────────────────────────────────────────────────────────

export function AdvancedChartSection({
  data,
  startIndex,
  endIndex,
  onRangeChange,
  selectedId,
  isAdmin,
  initialConfigJson,
  localOnly,
  onConfigChange,
}: AdvancedChartSectionProps) {
  const { actor, isFetching: actorFetching } = useActor();

  const [formulas, setFormulas] = useState<FormulaLine[]>([]);
  const [bands, setBands] = useState<BandConfig[]>([]);
  const [events, setEvents] = useState<EventConfig[]>([]);
  const [testStartMs, setTestStartMs] = useState<number | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);
  const [showReset, setShowReset] = useState(false);

  const [yMin, setYMin] = useState<number | undefined>(undefined);
  const [yMax, setYMax] = useState<number | undefined>(undefined);

  const [showAllSensors, setShowAllSensors] = useState(false);
  const [allSensorsOpacity, setAllSensorsOpacity] = useState(0.5);
  const [bandFillOpacity, setBandFillOpacity] = useState(0.3);

  const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<string | null>(null);
  const selectingRef = useRef(false);
  const [hoverX, setHoverX] = useState<number | null>(null);

  const [hoverPayload, setHoverPayload] = useState<any[]>([]);
  const [hoverTimestamp, setHoverTimestamp] = useState<number | null>(null);

  // Cursor tooltip
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [nearestFormulaName, setNearestFormulaName] = useState<string | null>(
    null,
  );

  const savedRef = useRef<string>("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load from backend ──
  useEffect(() => {
    // If initialConfigJson is provided (backup view), use it directly
    if (initialConfigJson !== undefined) {
      if (initialConfigJson.trim()) {
        try {
          const cfg: AdvancedChartConfig = JSON.parse(initialConfigJson);
          setFormulas(cfg.formulas ?? []);
          setBands(cfg.bands ?? []);
          setEvents(cfg.events ?? []);
          setTestStartMs(cfg.testStartMs);
          savedRef.current = initialConfigJson;
        } catch {
          setFormulas([]);
          setBands([]);
        }
      } else {
        setFormulas([]);
        setBands([]);
      }
      setLoaded(true);
      return;
    }
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
            setEvents(cfg.events ?? []);
            setTestStartMs(cfg.testStartMs);
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
  }, [actor, actorFetching, selectedId, isAdmin, initialConfigJson]);

  // ── Save with debounce ──
  const saveConfig = useCallback(
    (
      newFormulas: FormulaLine[],
      newBands: BandConfig[],
      newEvents?: EventConfig[],
      newTestStartMs?: number | undefined | null,
    ) => {
      const evs = newEvents !== undefined ? newEvents : events;
      const tsMs =
        newTestStartMs !== null && newTestStartMs !== undefined
          ? newTestStartMs
          : newTestStartMs === null
            ? undefined
            : testStartMs;
      const json = JSON.stringify({
        formulas: newFormulas,
        bands: newBands,
        events: evs,
        testStartMs: tsMs,
      });
      if (json === savedRef.current) return;
      savedRef.current = json;
      // In localOnly mode, notify parent but do NOT persist to backend
      if (localOnly) {
        onConfigChange?.(json);
        return;
      }
      if (!isAdmin || !actor || !loaded) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        (actor as any)
          .saveAdvancedChartConfigForId(BigInt(selectedId), json)
          .catch(() => {});
      }, 800);
    },
    [
      actor,
      isAdmin,
      loaded,
      selectedId,
      events,
      testStartMs,
      localOnly,
      onConfigChange,
    ],
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

  const updateEvents = useCallback(
    (updated: EventConfig[], newTestStartMs?: number | undefined) => {
      setEvents(updated);
      saveConfig(
        formulas,
        bands,
        updated,
        newTestStartMs !== undefined ? newTestStartMs : null,
      );
    },
    [formulas, bands, saveConfig],
  );

  const handleSetIncubation = useCallback(
    (evId: string, incubationMs: number) => {
      const ev = events.find((e) => e.id === evId);
      if (!ev) return;
      const newStartMs = ev.timestamp - incubationMs;
      setTestStartMs(newStartMs);
      saveConfig(formulas, bands, events, newStartMs);
    },
    [events, formulas, bands, saveConfig],
  );

  const [dragSourceId, setDragSourceId] = useState<string | null>(null);

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      if (a.displayOrder !== undefined && b.displayOrder !== undefined)
        return a.displayOrder - b.displayOrder;
      return a.timestamp - b.timestamp;
    });
  }, [events]);

  const hasSyntheticStart =
    testStartMs !== undefined &&
    !events.some((e) => e.timestamp === testStartMs);

  const handleEventDrop = useCallback(
    (targetId: string) => {
      if (!dragSourceId || dragSourceId === targetId) {
        setDragSourceId(null);
        return;
      }
      const oldIndex = sortedEvents.findIndex((e) => e.id === dragSourceId);
      const newIndex = sortedEvents.findIndex((e) => e.id === targetId);
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = [...sortedEvents];
        const [moved] = reordered.splice(oldIndex, 1);
        reordered.splice(newIndex, 0, moved);
        updateEvents(reordered.map((e, i) => ({ ...e, displayOrder: i })));
      }
      setDragSourceId(null);
    },
    [dragSourceId, sortedEvents, updateEvents],
  );

  const chartData = useMemo(() => {
    return data.map((point) => {
      const row: Record<string, number | null | undefined | [number, number]> =
        { timestamp: point.timestamp.getTime() };

      if (showAllSensors) {
        const sensorMap = point.sensors as Record<string, number | undefined>;
        for (let i = 1; i <= 72; i++) {
          const key = `S${i}`;
          const v = sensorMap[key];
          row[`sensor_${key}`] = v !== undefined ? v : null;
        }
      }

      for (const f of formulas) {
        if (f.visible && f.expression) {
          row[`formula_${f.id}`] = evaluateFormula(
            f.expression,
            point.sensors as Record<string, number>,
          );
        }
      }

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
                v !== undefined && v !== null && !Number.isNaN(v) && v !== 0,
            );
          if (values.length > 0) {
            const minVal = Math.min(...values);
            const maxVal = Math.max(...values);
            row[`band_area_${b.id}`] = [minVal, maxVal];
            row[`band_min_${b.id}`] = minVal;
            row[`band_max_${b.id}`] = maxVal;
          } else {
            row[`band_area_${b.id}`] = undefined;
            row[`band_min_${b.id}`] = undefined;
            row[`band_max_${b.id}`] = undefined;
          }
        }
      }
      return row;
    });
  }, [data, formulas, bands, showAllSensors]);

  const { xTicks, xDomain } = useMemo(() => {
    if (data.length === 0)
      return { xTicks: [], xDomain: [0, 1] as [number, number] };
    const firstTs = (data[startIndex] ?? data[0]).timestamp.getTime();
    const lastTs = (
      data[endIndex] ?? data[data.length - 1]
    ).timestamp.getTime();
    return {
      xTicks: buildXTicks(firstTs, lastTs),
      xDomain: computeXDomain(firstTs, lastTs),
    };
  }, [data, startIndex, endIndex]);

  const yDomain = useMemo((): [number | string, number | string] => {
    if (yMin !== undefined && yMax !== undefined) return [yMin, yMax];
    if (yMin !== undefined) return [yMin, "auto"];
    if (yMax !== undefined) return ["auto", yMax];
    if (chartData.length === 0) return ["auto", "auto"];
    let globalMin = Number.POSITIVE_INFINITY;
    let globalMax = Number.NEGATIVE_INFINITY;
    const visibleFormulas = formulas.filter((f) => f.visible && f.expression);
    const visibleBandsCfg = bands.filter(
      (b) => b.visible && b.sensors.length > 0,
    );
    const visibleChartData = chartData.slice(startIndex, endIndex + 1);
    for (const row of visibleChartData) {
      for (const f of visibleFormulas) {
        const v = row[`formula_${f.id}`];
        if (v != null && typeof v === "number" && !Number.isNaN(v) && v !== 0) {
          globalMin = Math.min(globalMin, v);
          globalMax = Math.max(globalMax, v);
        }
      }
      for (const b of visibleBandsCfg) {
        const vMin = row[`band_min_${b.id}`];
        const vMax = row[`band_max_${b.id}`];
        if (
          vMin != null &&
          typeof vMin === "number" &&
          !Number.isNaN(vMin) &&
          vMin !== 0
        )
          globalMin = Math.min(globalMin, vMin);
        if (
          vMax != null &&
          typeof vMax === "number" &&
          !Number.isNaN(vMax) &&
          vMax !== 0
        )
          globalMax = Math.max(globalMax, vMax);
      }
    }
    if (!Number.isFinite(globalMin) || !Number.isFinite(globalMax))
      return ["auto", "auto"];
    const padding = (globalMax - globalMin) * 0.05 || 1;
    return [globalMin - padding, globalMax + padding];
  }, [yMin, yMax, chartData, startIndex, endIndex, formulas, bands]);

  const handleMouseDown = useCallback((e: any) => {
    if (!e?.activeLabel) return;
    setRefAreaLeft(String(e.activeLabel));
    setRefAreaRight(null);
    selectingRef.current = true;
    setNearestFormulaName(null);
  }, []);

  const handleMouseMove = useCallback(
    (e: any) => {
      if (e?.activeLabel) setHoverX(Number(e.activeLabel));
      if (e?.activePayload?.length) {
        setHoverPayload(e.activePayload);
        setHoverTimestamp(e.activeLabel ?? null);
      }
      // Find nearest formula line for cursor tooltip
      if (
        !selectingRef.current &&
        e?.activePayload?.length &&
        (e as any).chartY != null
      ) {
        let minDist = Number.POSITIVE_INFINITY;
        let nearestName: string | null = null;
        for (const entry of e.activePayload) {
          const dk = String(entry.dataKey ?? "");
          if (!dk.startsWith("formula_")) continue;
          if (entry.y != null && entry.value != null && entry.value !== 0) {
            const dist = Math.abs(entry.y - (e as any).chartY);
            if (dist < minDist) {
              minDist = dist;
              const fId = dk.replace("formula_", "");
              const formula = formulas.find((f) => f.id === fId);
              nearestName = formula ? formula.name || formula.expression : null;
            }
          }
        }
        setNearestFormulaName(nearestName);
      } else if (selectingRef.current) {
        setNearestFormulaName(null);
      }
      if (selectingRef.current && e?.activeLabel)
        setRefAreaRight(String(e.activeLabel));
    },
    [formulas],
  );

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
    let foundStart = -1;
    let foundEnd = -1;
    for (let i = 0; i < data.length; i++) {
      const ts = data[i].timestamp.getTime();
      if (foundStart === -1 && ts >= l) foundStart = i;
      if (ts <= r) foundEnd = i;
    }
    if (foundStart !== -1 && foundEnd !== -1 && foundStart <= foundEnd)
      onRangeChange(foundStart, foundEnd);
    setRefAreaLeft(null);
    setRefAreaRight(null);
  }, [refAreaLeft, refAreaRight, data, onRangeChange]);

  const handleMouseLeave = useCallback(() => {
    setHoverX(null);
    setHoverPayload([]);
    setHoverTimestamp(null);
    setCursorPos(null);
    setNearestFormulaName(null);
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

  return (
    <div
      className="mt-2 rounded-xl border border-border bg-card shadow-sm"
      data-ocid="tsic.advanced.panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 flex-wrap gap-2">
        <div>
          <h3 className="font-semibold text-sm">Advanced Chart</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Formula lines and sensor bands — shared zoom with main chart
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Show all sensors toggle + opacity */}
          <label
            className="flex items-center gap-1.5 cursor-pointer select-none"
            data-ocid="tsic.advanced.toggle"
          >
            <input
              type="checkbox"
              checked={showAllSensors}
              onChange={(e) => setShowAllSensors(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-border accent-primary cursor-pointer"
            />
            <span className="text-xs text-muted-foreground">
              Show all sensors
            </span>
          </label>
          {showAllSensors && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Opacity:</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={allSensorsOpacity}
                onChange={(e) => setAllSensorsOpacity(Number(e.target.value))}
                className="w-20 h-1 accent-primary cursor-pointer"
                title={`Sensor lines opacity: ${Math.round(allSensorsOpacity * 100)}%`}
              />
              <span className="text-xs text-muted-foreground w-7">
                {Math.round(allSensorsOpacity * 100)}%
              </span>
            </div>
          )}
          {/* Band fill opacity */}
          {bands.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Band fill:</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={bandFillOpacity}
                onChange={(e) => setBandFillOpacity(Number(e.target.value))}
                className="w-20 h-1 accent-primary cursor-pointer"
                title={`Band fill opacity: ${Math.round(bandFillOpacity * 100)}%`}
              />
              <span className="text-xs text-muted-foreground w-7">
                {Math.round(bandFillOpacity * 100)}%
              </span>
            </div>
          )}
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
      </div>

      {!isAdmin ? (
        <div className="p-4 text-sm text-muted-foreground text-center">
          Admin access required to configure advanced charts
        </div>
      ) : (
        <>
          {((hasContent && hasVisibleContent) || showAllSensors) &&
            data.length > 0 &&
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
                <div
                  className="flex flex-col md:flex-row gap-4 items-start"
                  onMouseMove={(e) =>
                    setCursorPos({ x: e.clientX, y: e.clientY })
                  }
                  onMouseLeave={() => {
                    setCursorPos(null);
                    setNearestFormulaName(null);
                  }}
                >
                  <div
                    className="flex-1 min-w-0 w-full"
                    style={{ userSelect: "none" }}
                  >
                    <ResponsiveContainer width="100%" height={900}>
                      <ComposedChart
                        data={chartData}
                        margin={{ top: 10, right: 10, left: 0, bottom: 60 }}
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

                        {/* All-sensors grey lines */}
                        {showAllSensors &&
                          ALL_SENSOR_KEYS.map((key) => (
                            <Line
                              key={key}
                              type="monotone"
                              dataKey={key}
                              stroke={`rgba(200,200,200,${allSensorsOpacity})`}
                              strokeWidth={0.8}
                              dot={false}
                              isAnimationActive={false}
                              legendType="none"
                              connectNulls={false}
                            />
                          ))}

                        {/* Bands: custom SVG polygon */}
                        {visibleBands.map((b) => (
                          <Customized
                            key={`band_custom_${b.id}`}
                            component={(props: any) => (
                              <BandPolygon
                                xAxisMap={props.xAxisMap}
                                yAxisMap={props.yAxisMap}
                                offset={props.offset}
                                chartData={
                                  chartData as Record<string, unknown>[]
                                }
                                band={b}
                                fillOpacity={bandFillOpacity}
                              />
                            )}
                          />
                        ))}

                        {/* Invisible lines to capture band_min/band_max in hover payload */}
                        {visibleBands.map((b) => (
                          <React.Fragment key={`band_hover_${b.id}`}>
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
                            strokeWidth={f.bold ? 3 : 1.5}
                            strokeDasharray={f.dotted ? "5 3" : undefined}
                            dot={false}
                            isAnimationActive={false}
                            connectNulls={false}
                            legendType="none"
                            name={f.name || f.expression}
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

                        {/* Event lines */}
                        {events.map((ev) => {
                          const labelFn = makeEventLabel(ev.label);
                          return (
                            <ReferenceLine
                              key={`event_${ev.id}`}
                              x={ev.timestamp}
                              stroke="#000000"
                              strokeWidth={1}
                              label={labelFn as any}
                            />
                          );
                        })}

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
                        <Brush
                          dataKey="timestamp"
                          height={40}
                          stroke="oklch(var(--primary))"
                          fill="oklch(var(--muted))"
                          startIndex={startIndex}
                          endIndex={endIndex}
                          onChange={(range: any) => {
                            if (
                              range?.startIndex != null &&
                              range?.endIndex != null
                            ) {
                              onRangeChange(range.startIndex, range.endIndex);
                            }
                          }}
                          travellerWidth={10}
                          tickFormatter={(ts: number) => {
                            const d = new Date(ts);
                            return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`;
                          }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Hover side panel */}
                  <AdvancedHoverPanel
                    payload={hoverPayload}
                    activeTimestamp={hoverTimestamp}
                    visibleFormulas={visibleFormulas}
                    visibleBands={visibleBands}
                    chartData={chartData as Record<string, unknown>[]}
                    hasContent={
                      visibleFormulas.length > 0 || visibleBands.length > 0
                    }
                  />
                </div>
              </div>
            )}

          {/* Editor */}
          <div className="p-4 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Formula Lines
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  Use S1–S72, +, -, *, /, (, ) and functions:{" "}
                  <span className="font-mono">avg(S1,S2)*</span>,{" "}
                  <span className="font-mono">min(S1,S2)*</span>,{" "}
                  <span className="font-mono">max(S1,S2)*</span>,{" "}
                  <span className="font-mono">median(S1,S2)*</span>,{" "}
                  <span className="font-mono">range(S1,S2)*</span>
                  <br />
                  <span className="italic">
                    * All functions and bands skip zero values — e.g.
                    avg(S1,S2,S3) with S2=0 becomes (S1+S3)/2
                  </span>
                </p>
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
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Events
                </Label>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-xs px-2 gap-1"
                  onClick={() => {
                    const newEv: EventConfig = {
                      id: crypto.randomUUID(),
                      timestamp: Date.now(),
                      label: `Event ${events.length + 1}`,
                    };
                    updateEvents([...events, newEv]);
                  }}
                  data-ocid="tsic.advanced.event.button"
                >
                  <Plus className="w-3 h-3" />
                  Add Event
                </Button>
              </div>
              {events.length === 0 && testStartMs === undefined ? (
                <p className="text-xs text-muted-foreground italic">
                  No events yet. Add one to mark a moment on the chart with a
                  vertical line and label.
                </p>
              ) : (
                <div className="space-y-0">
                  {hasSyntheticStart && testStartMs !== undefined && (
                    <div className="flex items-center gap-2 py-2 border-b border-border/30 opacity-60">
                      <div className="w-4 h-4 flex-shrink-0" />
                      <input
                        type="datetime-local"
                        value={toDatetimeLocal(testStartMs)}
                        disabled
                        className="h-7 text-xs rounded border border-border bg-muted px-1.5 flex-shrink-0"
                        style={{ width: 175 }}
                      />
                      <span
                        className="h-7 text-xs px-1.5 flex items-center rounded border border-border bg-muted flex-shrink-0"
                        style={{ width: 110 }}
                      >
                        D00 H00 M00
                      </span>
                      <span className="h-7 text-xs px-1.5 flex items-center flex-1 italic text-muted-foreground">
                        START
                      </span>
                    </div>
                  )}
                  {sortedEvents.map((ev, i) => (
                    <EventRow
                      key={ev.id}
                      ev={ev}
                      index={i}
                      testStartMs={testStartMs}
                      onUpdate={(updated) => {
                        const next = events.map((e) =>
                          e.id === updated.id ? updated : e,
                        );
                        updateEvents(next);
                      }}
                      onDelete={(id) =>
                        updateEvents(events.filter((e) => e.id !== id))
                      }
                      onSetIncubation={handleSetIncubation}
                      onDragStart={(id) => setDragSourceId(id)}
                      onDrop={handleEventDrop}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Cursor tooltip for formula lines */}
      {cursorPos && nearestFormulaName && (
        <div
          style={{
            position: "fixed",
            left: cursorPos.x + 14,
            top: cursorPos.y - 10,
            pointerEvents: "none",
            zIndex: 9999,
          }}
          className="bg-card border border-border rounded px-2 py-0.5 text-xs shadow-md text-foreground whitespace-nowrap"
        >
          {nearestFormulaName}
        </div>
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
                updateEvents([]);
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
