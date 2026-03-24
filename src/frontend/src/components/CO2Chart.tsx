import {
  CustomXTick,
  MONTH_NAMES,
  type XTickEntry,
  buildXTicks,
  computeXDomain,
} from "@/lib/chartXAxis";
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

const CO2_RIGHT_COLOR = "#C2CF85";
const CO2_LEFT_COLOR = "#808A54";
const CO2_CSV_COLOR = "#808A54";

const LINE_NAME_MAP: Record<string, string> = {
  co2Right: "CO2 Right (%)",
  co2Left: "CO2 Left (%)",
  co2CSV: "CO2 CSV (%)",
};

interface CO2ChartProps {
  data: TemperatureDataPoint[];
  startIndex: number;
  endIndex: number;
  onRangeChange: (startIndex: number, endIndex: number) => void;
}

const formatYTick = (value: number) => {
  if (value == null || Number.isNaN(value)) return "";
  return Number.parseFloat(value.toFixed(2)).toString();
};

export function CO2Chart({
  data,
  startIndex,
  endIndex,
  onRangeChange,
}: CO2ChartProps) {
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [nearestLineName, setNearestLineName] = useState<string | null>(null);

  const chartData = useMemo(() => {
    return data.map((point) => ({
      timestamp: point.timestamp.getTime(),
      co2Right: point.co2Right,
      co2Left: point.co2Left,
      co2CSV: point.co2CSV,
      fullTimestamp: format(point.timestamp, "yyyy-MM-dd HH:mm:ss"),
    }));
  }, [data]);

  const xTickEntries = useMemo((): XTickEntry[] => {
    const slice = chartData.slice(startIndex, endIndex + 1);
    if (slice.length === 0) return [];
    return buildXTicks(slice[0].timestamp, slice[slice.length - 1].timestamp);
  }, [chartData, startIndex, endIndex]);

  const xTickValues = useMemo(
    () => xTickEntries.map((t) => t.timestamp),
    [xTickEntries],
  );

  const xDomain = useMemo((): [number, number] | [string, string] => {
    const slice = chartData.slice(startIndex, endIndex + 1);
    if (slice.length === 0) return ["dataMin", "dataMax"];
    return computeXDomain(
      slice[0].timestamp,
      slice[slice.length - 1].timestamp,
    );
  }, [chartData, startIndex, endIndex]);

  const initializedRef = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional
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
  }, [data.length]);

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
    setRefAreaLeft(String(e.activeLabel));
    setRefAreaRight(null);
    setIsSelecting(true);
    selectingRef.current = true;
    setNearestLineName(null);
  }, []);

  const handleMouseMove = useCallback((e: any) => {
    if (
      !selectingRef.current &&
      e?.activePayload?.length &&
      (e as any).chartY != null
    ) {
      let minDist = Number.POSITIVE_INFINITY;
      let nearestName: string | null = null;
      for (const entry of e.activePayload) {
        if (entry.y != null && entry.value != null && entry.value !== 0) {
          const dist = Math.abs(entry.y - (e as any).chartY);
          if (dist < minDist) {
            minDist = dist;
            nearestName = String(entry.name ?? entry.dataKey ?? "");
          }
        }
      }
      setNearestLineName(nearestName);
    } else if (selectingRef.current) {
      setNearestLineName(null);
    }
    if (!selectingRef.current || !e || !e.activeLabel) return;
    setRefAreaRight(String(e.activeLabel));
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
    const leftIdx = visibleData.findIndex(
      (d) => String(d.timestamp) === refAreaLeft,
    );
    const rightIdx = visibleData.findIndex(
      (d) => String(d.timestamp) === refAreaRight,
    );
    if (leftIdx === -1 || rightIdx === -1) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }
    const lo = Math.min(leftIdx, rightIdx);
    const hi = Math.max(leftIdx, rightIdx);
    const slice = visibleData.slice(lo, hi + 1);
    const allYValues = slice
      .flatMap((d) => [d.co2Right, d.co2Left, d.co2CSV])
      .filter((v) => v != null && !Number.isNaN(v as number)) as number[];
    if (allYValues.length > 0) {
      const minY = Math.min(...allYValues);
      const maxY = Math.max(...allYValues);
      const padding = (maxY - minY) * 0.05 || 0.01;
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

  // Compute visible data range for Y-axis scroll zoom baseline
  const computeVisibleRange = useCallback((): [number, number] | null => {
    const slice = chartData.slice(startIndex, endIndex + 1);
    const values = slice
      .flatMap((d) => [d.co2Right, d.co2Left, d.co2CSV])
      .filter((v): v is number => v != null && !Number.isNaN(v) && v !== 0);
    if (values.length === 0) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min) * 0.05 || 1;
    return [min - pad, max + pad];
  }, [chartData, startIndex, endIndex]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      let curMin: number;
      let curMax: number;
      if (zoomedYBottom !== null && zoomedYTop !== null) {
        curMin = zoomedYBottom;
        curMax = zoomedYTop;
      } else {
        const range = computeVisibleRange();
        if (!range) return;
        [curMin, curMax] = range;
      }
      const range = curMax - curMin;
      const factor = e.deltaY < 0 ? 0.1 : -0.1;
      const newMin = curMin + range * factor;
      const newMax = curMax - range * factor;
      if (newMax - newMin > 0.1) {
        setZoomedYBottom(newMin);
        setZoomedYTop(newMax);
      }
    },
    [zoomedYBottom, zoomedYTop, computeVisibleRange],
  );

  const yDomain: [number | string, number | string] =
    zoomedYBottom !== null && zoomedYTop !== null
      ? [zoomedYBottom, zoomedYTop]
      : ["auto", "auto"];

  const displayName = nearestLineName
    ? (LINE_NAME_MAP[nearestLineName] ?? nearestLineName)
    : null;

  return (
    <>
      <div
        className="w-full h-[450px] relative"
        style={{ userSelect: "none" }}
        onWheel={handleWheel}
        onDoubleClick={() => {
          setZoomedYBottom(null);
          setZoomedYTop(null);
        }}
        onMouseMove={(e) => setCursorPos({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => {
          setCursorPos(null);
          setNearestLineName(null);
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 2, right: 30, left: 20, bottom: 60 }}
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
              dataKey="timestamp"
              type="number"
              domain={xDomain}
              scale="time"
              ticks={xTickValues}
              interval={0}
              tick={(tickProps) => (
                <CustomXTick
                  {...tickProps}
                  allTicks={xTickEntries}
                  fill="oklch(var(--muted-foreground))"
                />
              )}
              tickLine={false}
              axisLine={{ stroke: "oklch(var(--border))" }}
              allowDataOverflow
              height={46}
            />
            <YAxis
              domain={yDomain}
              allowDataOverflow
              tickFormatter={formatYTick}
              stroke="oklch(var(--muted-foreground))"
              tick={{ fill: "oklch(var(--muted-foreground))", fontSize: 12 }}
              tickLine={{ stroke: "oklch(var(--border))" }}
              label={{
                value: "CO\u2082 Level (%)",
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
                if (name === "co2Right") label = "CO2 Right (%)";
                else if (name === "co2Left") label = "CO2 Left (%)";
                else if (name === "co2CSV") label = "CO2 CSV (%) - dashed";
                const formattedValue =
                  typeof value === "number" && !Number.isNaN(value)
                    ? value.toFixed(2)
                    : "0.00";
                return [formattedValue, label];
              }}
              labelFormatter={
                ((label: any, payload: any) => {
                  if (payload && payload.length > 0) {
                    const dp = payload[0].payload;
                    if (dp?.fullTimestamp) return dp.fullTimestamp;
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
                if (value === "co2Right") return "CO2 Right (%)";
                if (value === "co2Left") return "CO2 Left (%)";
                if (value === "co2CSV") return "CO2 CSV (%) - dashed";
                return value;
              }}
            />
            <Line
              type="monotone"
              dataKey="co2Right"
              name="co2Right"
              stroke={CO2_RIGHT_COLOR}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, fill: CO2_RIGHT_COLOR }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="co2Left"
              name="co2Left"
              stroke={CO2_LEFT_COLOR}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, fill: CO2_LEFT_COLOR }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="co2CSV"
              name="co2CSV"
              stroke={CO2_CSV_COLOR}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              activeDot={{ r: 6, fill: CO2_CSV_COLOR }}
              isAnimationActive={false}
            />
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
              onChange={handleBrushChange}
              travellerWidth={10}
              tickFormatter={(ts: number) => {
                const d = new Date(ts);
                return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`;
              }}
            />
          </LineChart>
        </ResponsiveContainer>
        {cursorPos && displayName && (
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
            {displayName}
          </div>
        )}
      </div>
      <p className="text-center text-[10px] text-muted-foreground mt-1 pb-1 select-none">
        Scroll to zoom Y axis · Double-click to reset
      </p>
    </>
  );
}
