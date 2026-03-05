import type { TemperatureDataPoint } from "@/lib/temperatureParsing";
import { format } from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface CoolingHeatingVentilationChartProps {
  data: TemperatureDataPoint[];
  startIndex: number;
  endIndex: number;
  onRangeChange: (startIndex: number, endIndex: number) => void;
}

// Conversion functions: raw value → percentage (clamped 0–100)
function coolingToPercent(raw: number | undefined | null): number | undefined {
  if (raw == null || Number.isNaN(raw)) return undefined;
  return Math.min(100, Math.max(0, ((raw - 3) / 7) * 100));
}

function heatingToPercent(raw: number | undefined | null): number | undefined {
  if (raw == null || Number.isNaN(raw)) return undefined;
  return Math.min(100, Math.max(0, (raw / 10) * 100));
}

function ventilationToPercent(
  raw: number | undefined | null,
): number | undefined {
  if (raw == null || Number.isNaN(raw)) return undefined;
  return Math.min(100, Math.max(0, ((raw - 2) / 8) * 100));
}

const formatYTick = (value: number) => {
  if (value == null || Number.isNaN(value)) return "";
  return `${Number.parseFloat(value.toFixed(2))}%`;
};

export function CoolingHeatingVentilationChart({
  data,
  startIndex,
  endIndex,
  onRangeChange,
}: CoolingHeatingVentilationChartProps) {
  const chartData = useMemo(() => {
    return data.map((point) => ({
      timestamp: point.timestamp.getTime(),
      coolingV: coolingToPercent(point.coolingV),
      heatingPwm: heatingToPercent(point.heatingPwm),
      ventilationV: ventilationToPercent(point.ventilationV),
      timeLabel: format(point.timestamp, "HH:mm:ss"),
      fullTimestamp: format(point.timestamp, "yyyy-MM-dd HH:mm:ss"),
    }));
  }, [data]);

  // Auto-zoom to last day on first data load
  const initializedRef = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — only run once when data length changes
  useEffect(() => {
    if (data.length > 1 && !initializedRef.current) {
      initializedRef.current = true;
      const lastIndex = data.length - 1;
      const lastTs = data[lastIndex].timestamp.getTime();
      const oneDayMs = 24 * 60 * 60 * 1000;
      const startTs = lastTs - oneDayMs;
      let autoStartIndex = 0;
      for (let i = 0; i < data.length; i++) {
        if (data[i].timestamp.getTime() >= startTs) {
          autoStartIndex = i;
          break;
        }
      }
      onRangeChange(autoStartIndex, lastIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.length]);

  // Drag-zoom state
  const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<string | null>(null);
  const [_isSelecting, setIsSelecting] = useState(false);
  const [zoomedYBottom, setZoomedYBottom] = useState<number | null>(null);
  const [zoomedYTop, setZoomedYTop] = useState<number | null>(null);
  const selectingRef = useRef(false);

  const handleBrushChange = useCallback(
    (range: { startIndex?: number; endIndex?: number }) => {
      if (range.startIndex !== undefined && range.endIndex !== undefined) {
        onRangeChange(range.startIndex, range.endIndex);
      }
    },
    [onRangeChange],
  );

  const handleMouseDown = useCallback((e: any) => {
    if (!e || !e.activeLabel) return;
    setRefAreaLeft(e.activeLabel);
    setRefAreaRight(null);
    setIsSelecting(true);
    selectingRef.current = true;
  }, []);

  const handleMouseMove = useCallback((e: any) => {
    if (!selectingRef.current || !e || !e.activeLabel) return;
    setRefAreaRight(e.activeLabel);
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!selectingRef.current) return;
    selectingRef.current = false;
    setIsSelecting(false);

    if (!refAreaLeft || !refAreaRight || refAreaLeft === refAreaRight) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }

    const visibleData = chartData.slice(startIndex, endIndex + 1);
    const leftIdx = visibleData.findIndex((d) => d.timeLabel === refAreaLeft);
    const rightIdx = visibleData.findIndex((d) => d.timeLabel === refAreaRight);

    if (leftIdx === -1 || rightIdx === -1) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }

    const lo = Math.min(leftIdx, rightIdx);
    const hi = Math.max(leftIdx, rightIdx);

    const slice = visibleData.slice(lo, hi + 1);
    // Values are already converted to percentages in chartData
    const allYValues = slice
      .flatMap((d) => [d.coolingV, d.heatingPwm, d.ventilationV])
      .filter((v) => v != null && !Number.isNaN(v as number)) as number[];
    if (allYValues.length > 0) {
      const minY = Math.min(...allYValues);
      const maxY = Math.max(...allYValues);
      const padding = (maxY - minY) * 0.05 || 1;
      setZoomedYBottom(minY - padding);
      setZoomedYTop(maxY + padding);
    }

    onRangeChange(startIndex + lo, startIndex + hi);
    setRefAreaLeft(null);
    setRefAreaRight(null);
  }, [
    refAreaLeft,
    refAreaRight,
    chartData,
    startIndex,
    endIndex,
    onRangeChange,
  ]);

  const prevStartIndex = useRef(startIndex);
  const prevEndIndex = useRef(endIndex);
  if (
    prevStartIndex.current !== startIndex ||
    prevEndIndex.current !== endIndex
  ) {
    prevStartIndex.current = startIndex;
    prevEndIndex.current = endIndex;
    if (startIndex === 0 && endIndex === data.length - 1) {
      setZoomedYBottom(null);
      setZoomedYTop(null);
    }
  }

  const yDomain: [number | string, number | string] =
    zoomedYBottom !== null && zoomedYTop !== null
      ? [zoomedYBottom, zoomedYTop]
      : [0, 100];

  return (
    <div className="w-full h-[450px]" style={{ userSelect: "none" }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="oklch(var(--border))"
            opacity={0.3}
          />
          <XAxis
            dataKey="timeLabel"
            stroke="oklch(var(--muted-foreground))"
            tick={{ fill: "oklch(var(--muted-foreground))", fontSize: 12 }}
            tickLine={{ stroke: "oklch(var(--border))" }}
            allowDataOverflow
          />
          <YAxis
            domain={yDomain}
            allowDataOverflow
            tickFormatter={formatYTick}
            stroke="oklch(var(--muted-foreground))"
            tick={{ fill: "oklch(var(--muted-foreground))", fontSize: 12 }}
            tickLine={{ stroke: "oklch(var(--border))" }}
            label={{
              value: "Level (%)",
              angle: -90,
              position: "insideLeft",
              style: { fill: "oklch(var(--muted-foreground))", fontSize: 12 },
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "oklch(var(--popover))",
              border: "1px solid oklch(var(--border))",
              borderRadius: "8px",
              color: "oklch(var(--popover-foreground))",
            }}
            labelStyle={{ color: "oklch(var(--popover-foreground))" }}
            formatter={(value: number, name: string) => {
              let label = "";
              if (name === "coolingV") label = "Cooling";
              else if (name === "heatingPwm") label = "Heating PWM";
              else if (name === "ventilationV") label = "Ventilation";
              const formattedValue =
                typeof value === "number" && !Number.isNaN(value)
                  ? `${value.toFixed(2)}%`
                  : "0.00%";
              return [formattedValue, label];
            }}
            labelFormatter={
              ((label: any, payload: any) => {
                if (payload && payload.length > 0) {
                  const dataPoint = payload[0].payload;
                  if (dataPoint?.fullTimestamp) {
                    return dataPoint.fullTimestamp;
                  }
                }
                return label;
              }) as any
            }
          />
          <Legend
            wrapperStyle={{
              paddingTop: "10px",
              color: "oklch(var(--foreground))",
            }}
            iconType="line"
            formatter={(value) => {
              if (value === "coolingV") return "Cooling (%)";
              if (value === "heatingPwm") return "Heating PWM (%)";
              if (value === "ventilationV") return "Ventilation (%)";
              return value;
            }}
          />
          <Line
            type="monotone"
            dataKey="coolingV"
            name="coolingV"
            stroke="oklch(var(--chart-cooling))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6, fill: "oklch(var(--chart-cooling))" }}
          />
          <Line
            type="monotone"
            dataKey="heatingPwm"
            name="heatingPwm"
            stroke="oklch(var(--chart-heating))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6, fill: "oklch(var(--chart-heating))" }}
          />
          <Line
            type="monotone"
            dataKey="ventilationV"
            name="ventilationV"
            stroke="oklch(var(--chart-ventilation))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6, fill: "oklch(var(--chart-ventilation))" }}
          />
          {refAreaLeft && refAreaRight && (
            <ReferenceArea
              x1={refAreaLeft}
              x2={refAreaRight}
              strokeOpacity={0.3}
              fill="oklch(var(--primary))"
              fillOpacity={0.2}
              stroke="oklch(var(--primary))"
            />
          )}
          <Brush
            dataKey="timeLabel"
            height={40}
            stroke="oklch(var(--primary))"
            fill="oklch(var(--muted))"
            startIndex={startIndex}
            endIndex={endIndex}
            onChange={handleBrushChange}
            travellerWidth={10}
          />
        </LineChart>
      </ResponsiveContainer>
      {(zoomedYBottom !== null ||
        startIndex > 0 ||
        endIndex < data.length - 1) && (
        <p className="text-xs text-muted-foreground text-center mt-1">
          💡 Drag on the chart to zoom in · Use the brush below to pan · Reset
          Zoom to restore
        </p>
      )}
    </div>
  );
}
