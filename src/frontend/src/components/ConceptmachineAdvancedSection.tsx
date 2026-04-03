import { useActor } from "@/hooks/useActor";
import {
  CustomXTick,
  type XTickEntry,
  buildXTicks,
  computeXDomain,
} from "@/lib/chartXAxis";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Plus, Trash2, X } from "lucide-react";
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
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CmFormulaLine {
  id: string;
  name: string;
  expression: string;
  color: string;
  visible: boolean;
  bold?: boolean;
  dotted?: boolean;
  yAxis?: "left" | "right";
}

export interface CmBandConfig {
  id: string;
  name: string;
  variables: string[];
  minExpr?: string;
  maxExpr?: string;
  color: string;
  visible: boolean;
  yAxis?: "left" | "right";
}

export interface CmChartTab {
  id: string;
  name: string;
  formulas: CmFormulaLine[];
  bands: CmBandConfig[];
}

export interface CmAdvancedConfig {
  tabs: CmChartTab[];
}

// ─── Variable name map ───────────────────────────────────────────────────────

const RAW_KEY_MAP: Record<string, string> = {
  "Temperature(F)": "Temperature",
  "Temperature Filtered(F)": "TemperatureFiltered",
  "Temperature CSV(F)": "TemperatureCSV",
  "Fan 1(V)": "Fan1",
  "Fan 2(V)": "Fan2",
  "Fan 3(V)": "Fan3",
  "Heating(PWM)": "HeatingPWM",
  "Heating(%)": "HeatingPct",
  "Cooling(V)": "CoolingV",
  "Min value cooling(V)": "MinCoolingV",
  "Max value Cooling(V)": "MaxCoolingV",
  "Ventilation(V)": "VentilationV",
  "Max value ventilation(V)": "MaxVentilationV",
  "Min value ventilation(V)": "MinVentilationV",
  "Max value heating(V)": "MaxHeatingV",
  "Min value heating(V)": "MinHeatingV",
  "Stuursignaal debiet(Pa)": "FlowControlPa",
  "CO2 CSV(%)": "CO2CSV",
  "CO2 Rechts": "CO2Right",
  "CO2 Links": "CO2Left",
  P: "P",
  I: "I",
  Kp: "Kp",
  "Ti(s)": "Ti",
};

const ALL_VARIABLES = Object.values(RAW_KEY_MAP);

const CM_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbyoxOkLkj2976p8jUmSz7ohV1FyZxvIdYQi2-4C_ix_WYEweGUjp174raDLp8Yjtx4L2A/exec";

// ─── Timestamp parsing ────────────────────────────────────────────────────────

function parseCmTimestamp(raw: string): number {
  // Format: "14/03/26 10:35:00" → DD/MM/YY HH:mm:ss
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return Number.NaN;
  const dd = Number.parseInt(m[1], 10);
  const mm = Number.parseInt(m[2], 10) - 1;
  const yy = Number.parseInt(m[3], 10);
  const hh = Number.parseInt(m[4], 10);
  const min = Number.parseInt(m[5], 10);
  const ss = Number.parseInt(m[6], 10);
  return new Date(2000 + yy, mm, dd, hh, min, ss).getTime();
}

export interface CmDataPoint {
  timestamp: number;
  [key: string]: number | undefined | null;
}

function parseRawJson(rawArray: Record<string, unknown>[]): CmDataPoint[] {
  const result: CmDataPoint[] = [];
  for (const row of rawArray) {
    const ts = parseCmTimestamp(String(row.Timestamp ?? ""));
    if (Number.isNaN(ts)) continue;
    const point: CmDataPoint = { timestamp: ts };
    for (const [rawKey, varName] of Object.entries(RAW_KEY_MAP)) {
      const v = row[rawKey];
      if (v !== undefined && v !== null && v !== "") {
        point[varName] =
          typeof v === "number" ? v : Number.parseFloat(String(v));
      } else {
        point[varName] = null;
      }
    }
    result.push(point);
  }
  result.sort((a, b) => a.timestamp - b.timestamp);
  return result;
}

// ─── Formula evaluator ───────────────────────────────────────────────────────

function preprocessCmFunctions(
  expr: string,
  vars: Record<string, number | undefined | null>,
): string | null {
  // Handle clamp(expr, lower, upper) — evaluate inner expression, then clamp
  let result = expr;
  let safeCount2 = 0;
  while (result.includes("clamp(") && safeCount2++ < 100) {
    const idx = result.indexOf("clamp(");
    if (idx === -1) break;
    // Find matching closing paren
    let depth = 0;
    let end = -1;
    for (let ci = idx + 5; ci < result.length; ci++) {
      if (result[ci] === "(") depth++;
      else if (result[ci] === ")") {
        depth--;
        if (depth === 0) {
          end = ci;
          break;
        }
      }
    }
    if (end === -1) break;
    const inner = result.slice(idx + 6, end);
    // Split by commas at depth 0 to get (valueExpr, lower, upper)
    const parts: string[] = [];
    let cur = "";
    let d2 = 0;
    for (const ch of inner) {
      if (ch === "(") {
        d2++;
        cur += ch;
      } else if (ch === ")") {
        d2--;
        cur += ch;
      } else if (ch === "," && d2 === 0) {
        parts.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    parts.push(cur.trim());
    if (parts.length !== 3) break;
    const [valExpr, lowerStr, upperStr] = parts;
    const lower = Number.parseFloat(lowerStr);
    const upper = Number.parseFloat(upperStr);
    if (Number.isNaN(lower) || Number.isNaN(upper)) break;
    // Recursively preprocess the value expression
    const processedVal = preprocessCmFunctions(valExpr, vars);
    if (processedVal === null) break;
    const valNum = Number.parseFloat(processedVal);
    const clamped = Number.isNaN(valNum)
      ? 0
      : Math.min(upper, Math.max(lower, valNum));
    result = result.slice(0, idx) + clamped.toString() + result.slice(end + 1);
  }

  const funcRegex = /\b(avg|min|max|median|range)\(([^()]*)\)/i;
  let iterations = 0;
  let match = funcRegex.exec(result);
  while (match !== null) {
    if (++iterations > 100) return null;
    const [fullMatch, funcName, argsStr] = match;
    const args = argsStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const values: number[] = [];
    for (const arg of args) {
      const numMatch = /^-?\d+(\.\d+)?$/.exec(arg);
      if (numMatch) {
        const v = Number.parseFloat(arg);
        if (v !== 0) values.push(v);
      } else if (ALL_VARIABLES.includes(arg)) {
        const v = vars[arg];
        if (v === undefined || v === null) return null;
        if (v !== 0) values.push(v);
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

type Token =
  | { type: "number"; value: number }
  | { type: "variable"; name: string }
  | { type: "op"; op: "+" | "-" | "*" | "/" }
  | { type: "lparen" }
  | { type: "rparen" };

function tokenizeCm(
  expr: string,
  resolvedVars: Record<string, number | undefined | null>,
): Token[] | null {
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
    // Try to match a variable name (starts with letter)
    if (/[A-Za-z]/.test(ch)) {
      let j = i;
      while (j < expr.length && /[A-Za-z0-9_]/.test(expr[j])) j++;
      const name = expr.slice(i, j);
      if (ALL_VARIABLES.includes(name)) {
        tokens.push({ type: "variable", name });
        i = j;
        continue;
      }
      return null;
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
  // Resolve variable tokens to numbers
  const resolved: Token[] = [];
  for (const tok of tokens) {
    if (tok.type === "variable") {
      const v = resolvedVars[tok.name];
      if (v === undefined || v === null) return null;
      resolved.push({ type: "number", value: v });
    } else {
      resolved.push(tok);
    }
  }
  return resolved;
}

function evaluateCmFormula(
  expression: string,
  vars: Record<string, number | undefined | null>,
): number | null {
  const preprocessed = preprocessCmFunctions(expression, vars);
  if (preprocessed === null) return null;
  const tokens = tokenizeCm(preprocessed, vars);
  if (!tokens) return null;
  const precedence: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2 };
  const output: (number | string)[] = [];
  const opStack: string[] = [];
  for (const tok of tokens) {
    if (tok.type === "number") {
      output.push(tok.value);
    } else if (tok.type === "lparen") {
      opStack.push("(");
    } else if (tok.type === "rparen") {
      while (opStack.length > 0 && opStack[opStack.length - 1] !== "(") {
        output.push(opStack.pop() as string);
      }
      if (opStack.length === 0) return null;
      opStack.pop();
    } else if (tok.type === "op") {
      const p = precedence[tok.op] ?? 0;
      while (
        opStack.length > 0 &&
        opStack[opStack.length - 1] !== "(" &&
        (precedence[opStack[opStack.length - 1]] ?? 0) >= p
      ) {
        output.push(opStack.pop() as string);
      }
      opStack.push(tok.op);
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

function validateCmExpression(expression: string): boolean {
  if (!expression.trim()) return false;
  try {
    const dummyVars: Record<string, number> = {};
    for (const v of ALL_VARIABLES) dummyVars[v] = 1;
    const result = evaluateCmFormula(expression, dummyVars);
    return result !== null && !Number.isNaN(result);
  } catch {
    return false;
  }
}

// ─── Colors ───────────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  "#e15759",
  "#4e79a7",
  "#f28e2b",
  "#76b7b2",
  "#59a14f",
  "#edc948",
  "#b07aa1",
  "#ff9da7",
  "#9c755f",
  "#bab0ac",
];

function nextColor(index: number) {
  return PRESET_COLORS[index % PRESET_COLORS.length];
}

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

// ─── BandPolygon ─────────────────────────────────────────────────────────────

interface CmBandPolygonProps {
  xAxisMap?: Record<string, { scale: (v: number) => number }>;
  yAxisMap?: Record<string, { scale: (v: number) => number }>;
  offset?: { top: number; left: number; width: number; height: number };
  chartData: Record<string, unknown>[];
  band: CmBandConfig;
  fillOpacity?: number;
}

function CmBandPolygon({
  xAxisMap,
  yAxisMap,
  offset,
  chartData,
  band,
  fillOpacity = 0.3,
}: CmBandPolygonProps) {
  if (!xAxisMap || !yAxisMap || !offset) return null;
  const yAxisId = band.yAxis || "left";
  const xAxis = Object.values(xAxisMap)[0];
  const yAxis =
    yAxisId === "right"
      ? (Object.values(yAxisMap).find((_, i) => i === 1) ??
        Object.values(yAxisMap)[0])
      : Object.values(yAxisMap)[0];
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
    topPoints.push([x, yScale(maxV)]);
    bottomPoints.unshift([x, yScale(minV)]);
  }
  if (topPoints.length < 2) return null;
  const allPoints = [...topPoints, ...bottomPoints];
  const d = `M ${allPoints.map(([x, y]) => `${x},${y}`).join(" L ")} Z`;
  const clipId = `cm-band-clip-${band.id}`;
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

// ─── Hover panel ──────────────────────────────────────────────────────────────

function CmHoverPanel({
  payload,
  activeTimestamp,
  formulas,
  bands,
  chartData,
}: {
  payload: any[];
  activeTimestamp: number | null;
  formulas: CmFormulaLine[];
  bands: CmBandConfig[];
  chartData: Record<string, unknown>[];
}) {
  const visibleFormulas = formulas.filter((f) => f.visible && f.expression);
  const visibleBands = bands.filter(
    (b) => b.visible && (b.variables.length > 0 || !!b.minExpr || !!b.maxExpr),
  );
  const hasContent = visibleFormulas.length > 0 || visibleBands.length > 0;
  if (!hasContent) return null;

  const isHovering = !!activeTimestamp && payload.length > 0;
  const byKey: Record<string, number | null> = {};
  for (const p of payload)
    byKey[p.dataKey] = p.value != null ? Number(p.value) : null;

  const dataRow = isHovering
    ? chartData.find((d) => d.timestamp === activeTimestamp)
    : undefined;

  const timeStr =
    isHovering && activeTimestamp
      ? (() => {
          const d = new Date(activeTimestamp);
          return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
        })()
      : null;

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
        {visibleFormulas.map((f) => (
          <div key={f.id} className="flex items-center gap-1 mb-0.5">
            <span
              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: f.color }}
            />
            <span className="text-muted-foreground truncate flex-1">
              {f.name || f.expression}
            </span>
            {isHovering && byKey[`formula_${f.id}`] != null && (
              <span className="font-mono tabular-nums text-foreground flex-shrink-0">
                {(byKey[`formula_${f.id}`] as number).toFixed(2)}
              </span>
            )}
          </div>
        ))}
        {visibleBands.map((b) => {
          const minRaw = dataRow ? dataRow[`band_min_${b.id}`] : undefined;
          const maxRaw = dataRow ? dataRow[`band_max_${b.id}`] : undefined;
          const minVal = isHovering && minRaw != null ? Number(minRaw) : null;
          const maxVal = isHovering && maxRaw != null ? Number(maxRaw) : null;
          return (
            <div key={b.id} className="mb-0.5">
              <div className="flex items-center gap-1">
                <span
                  className="inline-block w-2 h-2 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: b.color, opacity: 0.7 }}
                />
                <span className="text-muted-foreground truncate flex-1">
                  {b.name}
                </span>
              </div>
              {minVal !== null && (
                <div className="pl-3 text-muted-foreground/80">
                  <span>min: </span>
                  <span className="font-mono tabular-nums text-foreground">
                    {minVal.toFixed(2)}
                  </span>
                  {" / max: "}
                  <span className="font-mono tabular-nums text-foreground">
                    {maxVal?.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── FormulaRow ───────────────────────────────────────────────────────────────

interface CmFormulaRowProps {
  f: CmFormulaLine;
  index: number;
  onUpdate: (updated: CmFormulaLine) => void;
  onDelete: (id: string) => void;
}

function CmFormulaRow({ f, index, onUpdate, onDelete }: CmFormulaRowProps) {
  const [localName, setLocalName] = useState(f.name);
  const [localExpr, setLocalExpr] = useState(f.expression);
  const exprValid = localExpr === "" || validateCmExpression(localExpr);
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
        />
        <div className="relative">
          <Input
            value={localExpr}
            onChange={(e) => setLocalExpr(e.target.value)}
            onBlur={() => onUpdate({ ...f, expression: localExpr })}
            placeholder="e.g. avg(Temperature, TemperatureFiltered)"
            className={`h-7 text-xs font-mono ${
              !exprValid && localExpr ? "border-red-400" : ""
            }`}
          />
          {!exprValid && localExpr && (
            <p className="text-xs text-red-500 mt-0.5">
              Invalid expression — use variable names or arithmetic
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
        {/* L/R Y-axis toggle */}
        <button
          type="button"
          onClick={() =>
            onUpdate({ ...f, yAxis: f.yAxis === "right" ? "left" : "right" })
          }
          className={`w-6 h-6 rounded text-xs border font-mono ${
            f.yAxis === "right"
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border text-muted-foreground"
          }`}
          title={f.yAxis === "right" ? "Right Y-axis" : "Left Y-axis"}
          data-ocid={`cm.advanced.formula.toggle.${index + 1}`}
        >
          {f.yAxis === "right" ? "R" : "L"}
        </button>
        {/* Bold */}
        <button
          type="button"
          onClick={() => onUpdate({ ...f, bold: !f.bold })}
          className={`w-6 h-6 rounded text-xs border font-bold ${
            f.bold
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border text-muted-foreground"
          }`}
          title={f.bold ? "Remove bold" : "Make bold"}
        >
          B
        </button>
        {/* Dotted */}
        <button
          type="button"
          onClick={() => onUpdate({ ...f, dotted: !f.dotted })}
          className={`w-6 h-6 rounded text-xs border ${
            f.dotted
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border text-muted-foreground"
          }`}
          title={f.dotted ? "Remove dotted" : "Make dotted"}
        >
          D
        </button>
        {/* Visible */}
        <button
          type="button"
          onClick={() => onUpdate({ ...f, visible: !f.visible })}
          className={`w-6 h-6 rounded text-xs border ${
            f.visible
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border text-muted-foreground"
          }`}
          title={f.visible ? "Hide" : "Show"}
        >
          {f.visible ? "👁" : "—"}
        </button>
        {/* Delete */}
        <button
          type="button"
          onClick={() => onDelete(f.id)}
          className="w-6 h-6 rounded text-xs border border-border text-muted-foreground hover:text-destructive hover:border-destructive"
          title="Delete"
        >
          <X className="w-3 h-3 mx-auto" />
        </button>
      </div>
    </div>
  );
}

// ─── BandRow ──────────────────────────────────────────────────────────────────

interface CmBandRowProps {
  b: CmBandConfig;
  index: number;
  onUpdate: (updated: CmBandConfig) => void;
  onDelete: (id: string) => void;
}

function CmBandRow({ b, index, onUpdate, onDelete }: CmBandRowProps) {
  const [localName, setLocalName] = useState(b.name);
  const [localMinExpr, setLocalMinExpr] = useState(
    b.minExpr ?? b.variables[0] ?? "",
  );
  const [localMaxExpr, setLocalMaxExpr] = useState(
    b.maxExpr ?? b.variables[1] ?? b.variables[0] ?? "",
  );
  const prevId = useRef(b.id);

  useEffect(() => {
    if (prevId.current !== b.id) {
      prevId.current = b.id;
      setLocalName(b.name);
      setLocalMinExpr(b.minExpr ?? b.variables[0] ?? "");
      setLocalMaxExpr(b.maxExpr ?? b.variables[1] ?? b.variables[0] ?? "");
    }
  }, [b.id, b.name, b.variables, b.minExpr, b.maxExpr]);

  function commitBand() {
    // Parse plain variable lists for backward compat, but store as minExpr/maxExpr
    const variables = [localMinExpr, localMaxExpr].flatMap((e) =>
      e
        .split(/[,;\s]+/)
        .map((x) => x.trim())
        .filter((x) => ALL_VARIABLES.includes(x)),
    );
    onUpdate({
      ...b,
      name: localName,
      minExpr: localMinExpr,
      maxExpr: localMaxExpr,
      variables: [...new Set(variables)],
    });
  }

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
          onBlur={commitBand}
          placeholder="Band name"
          className="h-7 text-xs mb-1"
        />
        <Input
          value={localMinExpr}
          onChange={(e) => setLocalMinExpr(e.target.value)}
          onBlur={commitBand}
          placeholder="Min expression (e.g. Temperature, CoolingV*10)"
          className="h-7 text-xs mb-1"
        />
        <Input
          value={localMaxExpr}
          onChange={(e) => setLocalMaxExpr(e.target.value)}
          onBlur={commitBand}
          placeholder="Max expression (e.g. TemperatureFiltered, CoolingV*10+5)"
          className="h-7 text-xs"
        />
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Min/max expressions for band — supports variables and arithmetic.
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
        {/* L/R Y-axis toggle */}
        <button
          type="button"
          onClick={() =>
            onUpdate({ ...b, yAxis: b.yAxis === "right" ? "left" : "right" })
          }
          className={`w-6 h-6 rounded text-xs border font-mono ${
            b.yAxis === "right"
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border text-muted-foreground"
          }`}
          title={b.yAxis === "right" ? "Right Y-axis" : "Left Y-axis"}
          data-ocid={`cm.advanced.band.toggle.${index + 1}`}
        >
          {b.yAxis === "right" ? "R" : "L"}
        </button>
        {/* Visible */}
        <button
          type="button"
          onClick={() => onUpdate({ ...b, visible: !b.visible })}
          className={`w-6 h-6 rounded text-xs border ${
            b.visible
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border text-muted-foreground"
          }`}
          title={b.visible ? "Hide" : "Show"}
        >
          {b.visible ? "👁" : "—"}
        </button>
        {/* Delete */}
        <button
          type="button"
          onClick={() => onDelete(b.id)}
          className="w-6 h-6 rounded text-xs border border-border text-muted-foreground hover:text-destructive hover:border-destructive"
          title="Delete"
        >
          <X className="w-3 h-3 mx-auto" />
        </button>
      </div>
    </div>
  );
}

// ─── Single tab chart ─────────────────────────────────────────────────────────

interface CmTabChartProps {
  tab: CmChartTab;
  data: CmDataPoint[];
  isAdmin: boolean;
  onTabChange: (updated: CmChartTab) => void;
}

function CmTabChart({ tab, data, isAdmin, onTabChange }: CmTabChartProps) {
  const [showVariables, setShowVariables] = useState(false);

  const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<string | null>(null);
  const selectingRef = useRef(false);
  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(Math.max(0, data.length - 1));

  const [hoverPayload, setHoverPayload] = useState<any[]>([]);
  const [hoverTimestamp, setHoverTimestamp] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);

  // Auto-zoom to last day on mount/data change
  useEffect(() => {
    if (data.length === 0) return;
    const lastTs = data[data.length - 1].timestamp;
    const oneDayAgo = lastTs - 24 * 60 * 60 * 1000;
    let si = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i].timestamp >= oneDayAgo) {
        si = i;
        break;
      }
    }
    setStartIndex(si);
    setEndIndex(data.length - 1);
  }, [data]);

  const chartData = useMemo(() => {
    return data.map((point) => {
      const row: Record<string, number | null | undefined | [number, number]> =
        {
          timestamp: point.timestamp,
        };
      const vars = point as Record<string, number | null | undefined>;

      for (const f of tab.formulas) {
        if (f.visible && f.expression) {
          row[`formula_${f.id}`] = evaluateCmFormula(f.expression, vars);
        }
      }

      for (const b of tab.bands) {
        if (b.visible) {
          // Support minExpr/maxExpr (arithmetic expressions) or fall back to variables
          const minExpr = b.minExpr ?? b.variables[0] ?? "";
          const maxExpr = b.maxExpr ?? b.variables[1] ?? b.variables[0] ?? "";
          if (minExpr || maxExpr) {
            const minVal = minExpr ? evaluateCmFormula(minExpr, vars) : null;
            const maxVal = maxExpr ? evaluateCmFormula(maxExpr, vars) : null;
            if (
              minVal !== null &&
              maxVal !== null &&
              !Number.isNaN(minVal) &&
              !Number.isNaN(maxVal)
            ) {
              const lo = Math.min(minVal, maxVal);
              const hi = Math.max(minVal, maxVal);
              row[`band_area_${b.id}`] = [lo, hi];
              row[`band_min_${b.id}`] = lo;
              row[`band_max_${b.id}`] = hi;
            }
          }
        }
      }
      return row;
    });
  }, [data, tab.formulas, tab.bands]);

  const visibleData = useMemo(
    () => chartData.slice(startIndex, endIndex + 1),
    [chartData, startIndex, endIndex],
  );

  const { xTicks, xDomain } = useMemo(() => {
    if (data.length === 0)
      return { xTicks: [], xDomain: [0, 1] as [number, number] };
    const firstTs = data[0].timestamp;
    const lastTs = data[data.length - 1].timestamp;
    return {
      xTicks: buildXTicks(firstTs, lastTs),
      xDomain: computeXDomain(firstTs, lastTs),
    };
  }, [data]);

  const yDomain = useMemo((): [number | string, number | string] => {
    if (visibleData.length === 0) return ["auto", "auto"];
    let globalMin = Number.POSITIVE_INFINITY;
    let globalMax = Number.NEGATIVE_INFINITY;
    const visF = tab.formulas.filter(
      (f) => f.visible && f.expression && (!f.yAxis || f.yAxis === "left"),
    );
    const visB = tab.bands.filter(
      (b) =>
        b.visible &&
        (!b.yAxis || b.yAxis === "left") &&
        (b.variables.length > 0 || !!b.minExpr || !!b.maxExpr),
    );
    for (const row of visibleData) {
      for (const f of visF) {
        const v = row[`formula_${f.id}`];
        if (v != null && typeof v === "number" && !Number.isNaN(v) && v !== 0) {
          globalMin = Math.min(globalMin, v);
          globalMax = Math.max(globalMax, v);
        }
      }
      for (const b of visB) {
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
    const pad = (globalMax - globalMin) * 0.05 || 1;
    return [globalMin - pad, globalMax + pad];
  }, [visibleData, tab.formulas, tab.bands]);

  const yDomainRight = useMemo((): [number | string, number | string] => {
    if (visibleData.length === 0) return ["auto", "auto"];
    let globalMin = Number.POSITIVE_INFINITY;
    let globalMax = Number.NEGATIVE_INFINITY;
    const visF = tab.formulas.filter(
      (f) => f.visible && f.expression && f.yAxis === "right",
    );
    const visB = tab.bands.filter(
      (b) =>
        b.visible &&
        b.yAxis === "right" &&
        (b.variables.length > 0 || !!b.minExpr || !!b.maxExpr),
    );
    for (const row of visibleData) {
      for (const f of visF) {
        const v = row[`formula_${f.id}`];
        if (v != null && typeof v === "number" && !Number.isNaN(v) && v !== 0) {
          globalMin = Math.min(globalMin, v);
          globalMax = Math.max(globalMax, v);
        }
      }
      for (const b of visB) {
        const vMin = row[`band_min_${b.id}`];
        const vMax = row[`band_max_${b.id}`];
        if (vMin != null && typeof vMin === "number" && vMin !== 0)
          globalMin = Math.min(globalMin, vMin);
        if (vMax != null && typeof vMax === "number" && vMax !== 0)
          globalMax = Math.max(globalMax, vMax);
      }
    }
    if (!Number.isFinite(globalMin) || !Number.isFinite(globalMax))
      return ["auto", "auto"];
    const pad = (globalMax - globalMin) * 0.05 || 1;
    return [globalMin - pad, globalMax + pad];
  }, [visibleData, tab.formulas, tab.bands]);

  const hasRightAxis =
    tab.formulas.some((f) => f.yAxis === "right") ||
    tab.bands.some((b) => b.yAxis === "right");

  const handleMouseDown = useCallback((e: any) => {
    if (!e?.activeLabel) return;
    setRefAreaLeft(String(e.activeLabel));
    setRefAreaRight(null);
    selectingRef.current = true;
  }, []);

  const handleMouseMove = useCallback((e: any) => {
    if (e?.activePayload?.length) {
      setHoverPayload(e.activePayload);
      setHoverTimestamp(Number(e.activeLabel) ?? null);
      setHoverX(e.activeLabel != null ? Number(e.activeLabel) : null);
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
    let foundStart = -1;
    let foundEnd = -1;
    for (let i = 0; i < data.length; i++) {
      const ts = data[i].timestamp;
      if (foundStart === -1 && ts >= l) foundStart = i;
      if (ts <= r) foundEnd = i;
    }
    if (foundStart !== -1 && foundEnd !== -1 && foundStart <= foundEnd) {
      setStartIndex(foundStart);
      setEndIndex(foundEnd);
    }
    setRefAreaLeft(null);
    setRefAreaRight(null);
  }, [refAreaLeft, refAreaRight, data]);

  const handleMouseLeave = useCallback(() => {
    setHoverPayload([]);
    setHoverTimestamp(null);
    setHoverX(null);
    if (selectingRef.current) {
      selectingRef.current = false;
      setRefAreaLeft(null);
      setRefAreaRight(null);
    }
  }, []);

  const handleDoubleClick = useCallback(() => {
    setStartIndex(0);
    setEndIndex(data.length - 1);
  }, [data.length]);

  const visibleFormulas = tab.formulas.filter((f) => f.visible && f.expression);
  const visibleBands = tab.bands.filter(
    (b) => b.visible && (b.variables.length > 0 || !!b.minExpr || !!b.maxExpr),
  );

  return (
    <div>
      {isAdmin && (
        <>
          {/* Variables reference */}
          <div className="mb-3">
            <button
              type="button"
              onClick={() => setShowVariables((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              data-ocid="cm.advanced.toggle"
            >
              {showVariables ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              Variables ({ALL_VARIABLES.length})
            </button>
            {showVariables && (
              <div className="mt-2 p-3 rounded bg-muted/40 border border-border/30">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-1">
                  {ALL_VARIABLES.map((v) => (
                    <code
                      key={v}
                      className="text-[10px] font-mono text-muted-foreground"
                    >
                      {v}
                    </code>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  Functions: avg(), min(), max(), median(), range() (skip zeros)
                  · clamp(expr, min, max) · Full arithmetic: +, -, *, / · Band
                  expressions support arithmetic too
                </p>
              </div>
            )}
          </div>

          {/* Formula editor */}
          <div className="mb-3">
            <h4 className="text-xs font-semibold text-muted-foreground mb-1">
              Formula Lines
            </h4>
            {tab.formulas.map((f, i) => (
              <CmFormulaRow
                key={f.id}
                f={f}
                index={i}
                onUpdate={(updated) => {
                  const next = tab.formulas.map((x) =>
                    x.id === updated.id ? updated : x,
                  );
                  onTabChange({ ...tab, formulas: next });
                }}
                onDelete={(id) => {
                  const next = tab.formulas.filter((x) => x.id !== id);
                  onTabChange({ ...tab, formulas: next });
                }}
              />
            ))}
            <Button
              variant="outline"
              size="sm"
              className="mt-1 h-7 text-xs"
              onClick={() => {
                const newF: CmFormulaLine = {
                  id: makeId(),
                  name: "",
                  expression: "",
                  color: nextColor(tab.formulas.length),
                  visible: true,
                };
                onTabChange({ ...tab, formulas: [...tab.formulas, newF] });
              }}
              data-ocid="cm.advanced.primary_button"
            >
              <Plus className="w-3 h-3 mr-1" /> Add Formula
            </Button>
          </div>

          {/* Band editor */}
          <div className="mb-3">
            <h4 className="text-xs font-semibold text-muted-foreground mb-1">
              Bands
            </h4>
            {tab.bands.map((b, i) => (
              <CmBandRow
                key={b.id}
                b={b}
                index={i}
                onUpdate={(updated) => {
                  const next = tab.bands.map((x) =>
                    x.id === updated.id ? updated : x,
                  );
                  onTabChange({ ...tab, bands: next });
                }}
                onDelete={(id) => {
                  const next = tab.bands.filter((x) => x.id !== id);
                  onTabChange({ ...tab, bands: next });
                }}
              />
            ))}
            <Button
              variant="outline"
              size="sm"
              className="mt-1 h-7 text-xs"
              onClick={() => {
                const newB: CmBandConfig = {
                  id: makeId(),
                  name: "",
                  variables: [],
                  color: nextColor(tab.bands.length + 5),
                  visible: true,
                };
                onTabChange({ ...tab, bands: [...tab.bands, newB] });
              }}
              data-ocid="cm.advanced.secondary_button"
            >
              <Plus className="w-3 h-3 mr-1" /> Add Band
            </Button>
          </div>
        </>
      )}

      {/* Chart */}
      {(visibleFormulas.length > 0 || visibleBands.length > 0) &&
        data.length > 0 && (
          <div className="flex flex-col md:flex-row gap-4 items-start mt-4">
            <div
              className="flex-1 min-w-0 w-full"
              style={{ userSelect: "none" }}
            >
              <p className="text-[10px] text-muted-foreground mb-1">
                Click &amp; drag to zoom · Double-click to reset
              </p>
              <ResponsiveContainer width="100%" height={900}>
                <ComposedChart
                  data={chartData}
                  margin={{
                    top: 10,
                    right: hasRightAxis ? 60 : 10,
                    left: 0,
                    bottom: 20,
                  }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseLeave}
                  onDoubleClick={handleDoubleClick}
                >
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis
                    dataKey="timestamp"
                    type="number"
                    scale="time"
                    domain={xDomain}
                    ticks={xTicks.map((t) => t.timestamp)}
                    tick={<CustomXTick allTicks={xTicks as XTickEntry[]} />}
                    tickLine={false}
                    axisLine={{ strokeOpacity: 0.3 }}
                    interval={0}
                    allowDataOverflow
                    height={45}
                  />
                  <YAxis
                    yAxisId="left"
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
                  {hasRightAxis && (
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tickFormatter={(v) =>
                        Number.parseFloat(v.toFixed(2)).toString()
                      }
                      tick={{ fontSize: 11 }}
                      axisLine={{ strokeOpacity: 0.3 }}
                      tickLine={false}
                      width={55}
                      domain={yDomainRight}
                      allowDataOverflow
                    />
                  )}

                  {/* Band polygons */}
                  {visibleBands.map((b) => (
                    <Customized
                      key={`band_custom_${b.id}`}
                      component={(props: any) => (
                        <CmBandPolygon
                          xAxisMap={props.xAxisMap}
                          yAxisMap={props.yAxisMap}
                          offset={props.offset}
                          chartData={chartData as Record<string, unknown>[]}
                          band={b}
                        />
                      )}
                    />
                  ))}

                  {/* Formula lines */}
                  {visibleFormulas.map((f) => (
                    <Line
                      key={`formula_${f.id}`}
                      type="monotone"
                      dataKey={`formula_${f.id}`}
                      stroke={f.color}
                      strokeWidth={f.bold ? 2.5 : 1.2}
                      strokeDasharray={f.dotted ? "4 3" : undefined}
                      dot={false}
                      isAnimationActive={false}
                      legendType="none"
                      connectNulls={false}
                      yAxisId={f.yAxis || "left"}
                    />
                  ))}

                  {/* Zoom selection */}
                  {refAreaLeft && refAreaRight && (
                    <ReferenceArea
                      yAxisId="left"
                      x1={refAreaLeft}
                      x2={refAreaRight}
                      strokeOpacity={0.3}
                      fill="hsl(var(--primary))"
                      fillOpacity={0.1}
                    />
                  )}

                  {/* Vertical hover line */}
                  {hoverX !== null && (
                    <ReferenceLine
                      x={hoverX}
                      yAxisId="left"
                      stroke="#888888"
                      strokeWidth={1}
                      strokeDasharray="4 2"
                    />
                  )}

                  {/* Brush for horizontal scrolling */}
                  <Brush
                    dataKey="timestamp"
                    height={40}
                    stroke="var(--border)"
                    fill="var(--background)"
                    tickFormatter={(v: number) => {
                      const d = new Date(Number(v));
                      return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
                    }}
                    startIndex={startIndex ?? 0}
                    endIndex={endIndex ?? Math.max(0, chartData.length - 1)}
                    onChange={(e: any) => {
                      if (e.startIndex !== undefined)
                        setStartIndex(e.startIndex);
                      if (e.endIndex !== undefined) setEndIndex(e.endIndex);
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Hover panel */}
            <CmHoverPanel
              payload={hoverPayload}
              activeTimestamp={hoverTimestamp}
              formulas={tab.formulas}
              bands={tab.bands}
              chartData={chartData as Record<string, unknown>[]}
            />
          </div>
        )}

      {isAdmin && visibleFormulas.length === 0 && visibleBands.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-6">
          Add a formula or band above to see the chart.
        </p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ConceptmachineAdvancedSectionProps {
  isAdmin: boolean;
}

export function ConceptmachineAdvancedSection({
  isAdmin,
}: ConceptmachineAdvancedSectionProps) {
  const { actor, isFetching: actorFetching } = useActor();
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(true);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabName, setEditingTabName] = useState("");
  const [tabs, setTabs] = useState<CmChartTab[]>([]);
  const [configLoaded, setConfigLoaded] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef = useRef("");

  // ── Fetch raw data ──
  const { data: rawData, isLoading: dataLoading } = useQuery<CmDataPoint[]>({
    queryKey: ["cmAdvancedData"],
    queryFn: async () => {
      const res = await fetch(CM_ENDPOINT);
      if (!res.ok) throw new Error("Failed to fetch Conceptmachine data");
      const json = await res.json();
      return parseRawJson(Array.isArray(json) ? json : []);
    },
    staleTime: 5 * 60 * 1000,
    enabled: !collapsed,
  });

  // ── Fetch config (admin-only) ──
  const { data: configJson } = useQuery<string>({
    queryKey: ["cmAdvancedConfig"],
    queryFn: async () => {
      if (!actor) return "";
      try {
        return await (actor as any).getConceptMachineAdvancedConfig();
      } catch {
        return "";
      }
    },
    enabled: !!actor && !actorFetching && isAdmin && !collapsed,
    staleTime: 30000,
  });

  // Load config into state
  useEffect(() => {
    if (configJson === undefined) return;
    if (configJson.trim()) {
      try {
        const cfg: CmAdvancedConfig = JSON.parse(configJson);
        const loadedTabs = cfg.tabs ?? [];
        setTabs(loadedTabs);
        if (loadedTabs.length > 0 && !activeTabId) {
          setActiveTabId(loadedTabs[0].id);
        }
        savedRef.current = configJson;
      } catch {
        setTabs([]);
      }
    } else if (!configLoaded) {
      setTabs([]);
    }
    setConfigLoaded(true);
  }, [configJson, activeTabId, configLoaded]);

  // ── Save mutation ──
  const { mutate: saveConfig } = useMutation({
    mutationFn: async (json: string) => {
      if (!actor) throw new Error("No actor");
      await (actor as any).saveConceptMachineAdvancedConfig(json);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cmAdvancedConfig"] });
      toast.success("Saved", { duration: 1500 });
    },
  });

  const debouncedSave = useCallback(
    (newTabs: CmChartTab[]) => {
      if (!isAdmin || !actor) return;
      const json = JSON.stringify({ tabs: newTabs } as CmAdvancedConfig);
      if (json === savedRef.current) return;
      savedRef.current = json;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveConfig(json);
      }, 1000);
    },
    [isAdmin, actor, saveConfig],
  );

  const updateTab = useCallback(
    (updated: CmChartTab) => {
      setTabs((prev) => {
        const next = prev.map((t) => (t.id === updated.id ? updated : t));
        debouncedSave(next);
        return next;
      });
    },
    [debouncedSave],
  );

  const addTab = useCallback(() => {
    const newTab: CmChartTab = {
      id: makeId(),
      name: `Chart ${tabs.length + 1}`,
      formulas: [],
      bands: [],
    };
    const next = [...tabs, newTab];
    setTabs(next);
    setActiveTabId(newTab.id);
    debouncedSave(next);
  }, [tabs, debouncedSave]);

  const deleteTab = useCallback(
    (id: string) => {
      const next = tabs.filter((t) => t.id !== id);
      setTabs(next);
      if (activeTabId === id) {
        setActiveTabId(next.length > 0 ? next[0].id : null);
      }
      debouncedSave(next);
    },
    [tabs, activeTabId, debouncedSave],
  );

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

  return (
    <div
      className="mt-4 rounded-xl border border-border bg-card shadow-sm"
      data-ocid="cm.advanced.panel"
    >
      {/* Collapsible header */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors rounded-xl"
        onClick={() => setCollapsed((c) => !c)}
        data-ocid="cm.advanced.toggle"
      >
        <div className="text-left">
          <h3 className="font-semibold text-sm">Advanced Chart</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Custom formula lines and bands from raw Conceptmachine data
          </p>
        </div>
        {collapsed ? (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 border-t border-border/50">
          {/* Loading */}
          {dataLoading && (
            <p className="text-xs text-muted-foreground py-4 text-center">
              Loading data...
            </p>
          )}

          {!dataLoading && rawData && rawData.length === 0 && (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No data available from the Conceptmachine endpoint.
            </p>
          )}

          {!dataLoading && rawData && rawData.length > 0 && (
            <>
              {/* Tab bar */}
              {isAdmin && (
                <div className="flex items-center gap-1 flex-wrap py-3">
                  {tabs.map((tab) => (
                    <div key={tab.id} className="flex items-center">
                      {editingTabId === tab.id ? (
                        <input
                          value={editingTabName}
                          onChange={(e) => setEditingTabName(e.target.value)}
                          onBlur={() => {
                            if (editingTabName.trim()) {
                              updateTab({
                                ...tab,
                                name: editingTabName.trim(),
                              });
                            }
                            setEditingTabId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              if (editingTabName.trim())
                                updateTab({
                                  ...tab,
                                  name: editingTabName.trim(),
                                });
                              setEditingTabId(null);
                            }
                            if (e.key === "Escape") setEditingTabId(null);
                          }}
                          className="h-7 text-xs px-2 rounded border border-primary bg-background w-28"
                        />
                      ) : (
                        <button
                          type="button"
                          className={`h-7 px-3 text-xs rounded-l border transition-colors ${
                            activeTabId === tab.id
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border text-muted-foreground hover:text-foreground"
                          }`}
                          onClick={() => setActiveTabId(tab.id)}
                          onDoubleClick={() => {
                            setEditingTabId(tab.id);
                            setEditingTabName(tab.name);
                          }}
                          title="Double-click to rename"
                          data-ocid="cm.advanced.tab"
                        >
                          {tab.name}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteTab(tab.id)}
                        className="h-7 w-5 rounded-r border border-l-0 border-border text-muted-foreground hover:text-destructive hover:border-destructive flex items-center justify-center"
                        title="Delete tab"
                        data-ocid="cm.advanced.delete_button"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={addTab}
                    title="Add new chart tab"
                    data-ocid="cm.advanced.primary_button"
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              )}

              {/* Non-admin: show tabs as read-only selector */}
              {!isAdmin && tabs.length > 1 && (
                <div className="flex items-center gap-1 flex-wrap py-3">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={`h-7 px-3 text-xs rounded border transition-colors ${
                        activeTabId === tab.id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => setActiveTabId(tab.id)}
                      data-ocid="cm.advanced.tab"
                    >
                      {tab.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Active tab content */}
              {tabs.length === 0 && isAdmin && (
                <div className="py-6 text-center">
                  <p className="text-xs text-muted-foreground mb-3">
                    No charts yet. Add a chart tab to get started.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addTab}
                    data-ocid="cm.advanced.primary_button"
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add Chart
                  </Button>
                </div>
              )}

              {tabs.length === 0 && !isAdmin && (
                <p className="py-6 text-xs text-muted-foreground text-center">
                  No advanced charts configured.
                </p>
              )}

              {activeTab && (
                <CmTabChart
                  key={activeTab.id}
                  tab={activeTab}
                  data={rawData}
                  isAdmin={isAdmin}
                  onTabChange={updateTab}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
