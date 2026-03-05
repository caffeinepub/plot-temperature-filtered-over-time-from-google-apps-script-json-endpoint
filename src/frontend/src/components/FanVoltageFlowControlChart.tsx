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

interface FanVoltageFlowControlChartProps {
  data: TemperatureDataPoint[];
  startIndex: number;
  endIndex: number;
  onRangeChange: (startIndex: number, endIndex: number) => void;
}

const formatYTick = (value: number) => {
  if (value == null || Number.isNaN(value)) return "";
  return Number.parseFloat(value.toFixed(2)).toString();
};

// Resolve a CSS variable to its computed value for use in SVG stroke attributes
function resolveCssVar(varName: string): string {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return raw ? `oklch(${raw})` : "#888";
}

export function FanVoltageFlowControlChart({
  data,
  startIndex,
  endIndex,
  onRangeChange,
}: FanVoltageFlowControlChartProps) {
  // Resolve colors at render time so they react to dark/light mode changes
  const fan1Color = resolveCssVar("--chart-fan1");
  const fan2Color = resolveCssVar("--chart-fan2");
  const fan3Color = resolveCssVar("--chart-fan3");
  const flowControlColor = resolveCssVar("--chart-flow-control");

  const chartData = useMemo(() => {
    return data.map((point) => ({
      timestamp: point.timestamp.getTime(),
      fan1V: point.fan1V,
      fan2V: point.fan2V,
      fan3V: point.fan3V,
      flowControlPa: point.flowControlPa,
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
  const [zoomedY2Bottom, setZoomedY2Bottom] = useState<number | null>(null);
  const [zoomedY2Top, setZoomedY2Top] = useState<number | null>(null);
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

    const fanValues = slice
      .flatMap((d) => [d.fan1V, d.fan2V, d.fan3V])
      .filter((v) => v != null && !Number.isNaN(v as number)) as number[];
    if (fanValues.length > 0) {
      const minY = Math.min(...fanValues);
      const maxY = Math.max(...fanValues);
      const padding = (maxY - minY) * 0.05 || 1;
      setZoomedYBottom(minY - padding);
      setZoomedYTop(maxY + padding);
    }

    const flowValues = slice
      .map((d) => d.flowControlPa)
      .filter((v) => v != null && !Number.isNaN(v as number)) as number[];
    if (flowValues.length > 0) {
      const minY2 = Math.min(...flowValues);
      const maxY2 = Math.max(...flowValues);
      const padding2 = (maxY2 - minY2) * 0.05 || 1;
      setZoomedY2Bottom(minY2 - padding2);
      setZoomedY2Top(maxY2 + padding2);
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
      setZoomedY2Bottom(null);
      setZoomedY2Top(null);
    }
  }

  const yDomain: [number | string, number | string] =
    zoomedYBottom !== null && zoomedYTop !== null
      ? [zoomedYBottom, zoomedYTop]
      : ["auto", "auto"];

  const y2Domain: [number | string, number | string] =
    zoomedY2Bottom !== null && zoomedY2Top !== null
      ? [zoomedY2Bottom, zoomedY2Top]
      : ["auto", "auto"];

  return (
    <div className="w-full h-[450px]" style={{ userSelect: "none" }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 60, left: 20, bottom: 60 }}
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
            yAxisId="left"
            domain={yDomain}
            allowDataOverflow
            tickFormatter={formatYTick}
            stroke="oklch(var(--muted-foreground))"
            tick={{ fill: "oklch(var(--muted-foreground))", fontSize: 12 }}
            tickLine={{ stroke: "oklch(var(--border))" }}
            label={{
              value: "Fan Voltage (V)",
              angle: -90,
              position: "insideLeft",
              style: { fill: "oklch(var(--muted-foreground))", fontSize: 12 },
            }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={y2Domain}
            allowDataOverflow
            tickFormatter={formatYTick}
            stroke="oklch(var(--muted-foreground))"
            tick={{ fill: "oklch(var(--muted-foreground))", fontSize: 12 }}
            tickLine={{ stroke: "oklch(var(--border))" }}
            label={{
              value: "Flow Control (Pa)",
              angle: 90,
              position: "insideRight",
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
              if (name === "fan1V") label = "Fan 1 Voltage (V)";
              else if (name === "fan2V") label = "Fan 2 Voltage (V)";
              else if (name === "fan3V") label = "Fan 3 Voltage (V)";
              else if (name === "flowControlPa") label = "Flow Control (Pa)";
              const formattedValue =
                typeof value === "number" && !Number.isNaN(value)
                  ? value.toFixed(2)
                  : "0.00";
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
              if (value === "fan1V") return "Fan 1 Voltage (V)";
              if (value === "fan2V") return "Fan 2 Voltage (V)";
              if (value === "fan3V") return "Fan 3 Voltage (V)";
              if (value === "flowControlPa") return "Flow Control (Pa)";
              return value;
            }}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="fan1V"
            name="fan1V"
            stroke={fan1Color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6, fill: fan1Color }}
            isAnimationActive={false}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="fan2V"
            name="fan2V"
            stroke={fan2Color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6, fill: fan2Color }}
            isAnimationActive={false}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="fan3V"
            name="fan3V"
            stroke={fan3Color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6, fill: fan3Color }}
            isAnimationActive={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="flowControlPa"
            name="flowControlPa"
            stroke={flowControlColor}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6, fill: flowControlColor }}
            isAnimationActive={false}
          />
          {refAreaLeft && refAreaRight && (
            <ReferenceArea
              yAxisId="left"
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
