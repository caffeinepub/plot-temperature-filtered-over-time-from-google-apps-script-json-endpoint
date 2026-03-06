import {
  CustomXTick,
  MONTH_NAMES,
  type XTickEntry,
  buildXTicks,
  computeXDomain,
} from "@/lib/chartXAxis";
import type { TSICDataPoint } from "@/lib/tsicDataParsing";
import { format } from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface TSICSensorChartProps {
  data: TSICDataPoint[];
  startIndex: number;
  endIndex: number;
  onRangeChange: (startIndex: number, endIndex: number) => void;
  yAxisMin?: number | null;
  yAxisMax?: number | null;
  sensorVisibility?: Record<string, boolean>;
  onToggleSensor?: (sensorKey: string) => void;
  onResetStates?: () => void;
  /** Maps sensor number (1-72) → CSS color string */
  sensorColorMap?: Record<number, string>;
}

const SENSOR_COUNT = 72;

/** Fallback color for sensors not in the map — never black or white */
const FALLBACK_COLOR = "#9ca3af";

const formatYTick = (value: number) => {
  if (value == null || Number.isNaN(value)) return "";
  return Number.parseFloat(value.toFixed(2)).toString();
};

export function TSICSensorChart({
  data,
  startIndex,
  endIndex,
  onRangeChange,
  yAxisMin = null,
  yAxisMax = null,
  sensorVisibility: externalSensorVisibility,
  onToggleSensor: externalToggleSensor,
  onResetStates,
  sensorColorMap = {},
}: TSICSensorChartProps) {
  // Determine which sensors have any data
  const activeSensors = useMemo(() => {
    const active: number[] = [];
    for (let s = 1; s <= SENSOR_COUNT; s++) {
      const key = `S${s}` as keyof TSICDataPoint["sensors"];
      const hasData = data.some((point) => {
        const val = point.sensors[key];
        return (
          val !== undefined &&
          val !== null &&
          !Number.isNaN(val as number) &&
          (val as number) !== 0
        );
      });
      if (hasData) active.push(s);
    }
    return active;
  }, [data]);

  // Internal visibility state (used when no external state is provided)
  const [internalVisibleSensors, setInternalVisibleSensors] = useState<
    Set<number>
  >(() => new Set(activeSensors));

  // Update internal visible sensors when active sensors change
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — use joined string as stable dep key
  useEffect(() => {
    setInternalVisibleSensors(new Set(activeSensors));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSensors.join(",")]);

  // Derive visible sensors: prefer external sensorVisibility prop if provided
  const visibleSensors = useMemo(() => {
    if (externalSensorVisibility) {
      return new Set(
        activeSensors.filter(
          (s) => externalSensorVisibility[`S${s}`] !== false,
        ),
      );
    }
    return internalVisibleSensors;
  }, [externalSensorVisibility, activeSensors, internalVisibleSensors]);

  const chartData = useMemo(() => {
    return data.map((point) => {
      const row: Record<string, number | string> = {
        timestamp: point.timestamp.getTime(),
        timeLabel: format(point.timestamp, "HH:mm:ss"),
        fullTimestamp: format(point.timestamp, "yyyy-MM-dd HH:mm:ss"),
      };
      for (let s = 1; s <= SENSOR_COUNT; s++) {
        const key = `S${s}` as keyof TSICDataPoint["sensors"];
        row[`S${s}`] = point.sensors[key] as number;
      }
      return row;
    });
  }, [data]);

  // Build X-axis tick entries for the visible window
  const xTickEntries = useMemo((): XTickEntry[] => {
    const slice = chartData.slice(startIndex, endIndex + 1);
    if (slice.length === 0) return [];
    const firstTs = slice[0].timestamp as number;
    const lastTs = slice[slice.length - 1].timestamp as number;
    return buildXTicks(firstTs, lastTs);
  }, [chartData, startIndex, endIndex]);

  const xTickValues = useMemo(
    () => xTickEntries.map((t) => t.timestamp),
    [xTickEntries],
  );

  // X-axis domain: extend to include virtual midnight ticks before first data point
  const xDomain = useMemo((): [number, number] | [string, string] => {
    const slice = chartData.slice(startIndex, endIndex + 1);
    if (slice.length === 0) return ["dataMin", "dataMax"];
    const firstTs = slice[0].timestamp as number;
    const lastTs = slice[slice.length - 1].timestamp as number;
    return computeXDomain(firstTs, lastTs);
  }, [chartData, startIndex, endIndex]);

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
      onResetStates?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.length]);

  // Drag-zoom state
  const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
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
  }, []);

  const handleMouseMove = useCallback((e: any) => {
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
    const allYValues: number[] = [];
    for (const sensorNum of visibleSensors) {
      for (const point of slice) {
        const val = point[`S${sensorNum}`];
        if (
          val != null &&
          !Number.isNaN(val as number) &&
          (val as number) !== 0
        ) {
          allYValues.push(val as number);
        }
      }
    }
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
    visibleSensors,
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

  // Dynamic Y domain: external overrides > drag-zoom > auto from visible sensors
  const yDomain: [number | string, number | string] = useMemo(() => {
    // External Y-axis min/max take priority
    if (yAxisMin !== null || yAxisMax !== null) {
      return [
        yAxisMin !== null ? yAxisMin : "auto",
        yAxisMax !== null ? yAxisMax : "auto",
      ];
    }
    if (zoomedYBottom !== null && zoomedYTop !== null) {
      return [zoomedYBottom, zoomedYTop];
    }
    const visibleSlice = chartData.slice(startIndex, endIndex + 1);
    const allValues: number[] = [];
    for (const sensorNum of visibleSensors) {
      for (const point of visibleSlice) {
        const val = point[`S${sensorNum}`];
        if (
          val != null &&
          !Number.isNaN(val as number) &&
          (val as number) !== 0
        ) {
          allValues.push(val as number);
        }
      }
    }
    if (allValues.length === 0) return ["auto", "auto"];
    const minY = Math.min(...allValues);
    const maxY = Math.max(...allValues);
    const padding = (maxY - minY) * 0.05 || 1;
    return [minY - padding, maxY + padding];
  }, [
    yAxisMin,
    yAxisMax,
    zoomedYBottom,
    zoomedYTop,
    chartData,
    startIndex,
    endIndex,
    visibleSensors,
  ]);

  // Resolve color for a sensor number — never black or white
  const getColor = (sensorNum: number): string => {
    return sensorColorMap[sensorNum] ?? FALLBACK_COLOR;
  };

  // Suppress unused variable warnings
  void isSelecting;
  void externalToggleSensor;

  return (
    <div className="w-full" style={{ userSelect: "none" }}>
      <div className="w-full h-[450px]">
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
                value: "Temperature (°C)",
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
                const formattedValue =
                  typeof value === "number" && !Number.isNaN(value)
                    ? value.toFixed(2)
                    : "—";
                return [formattedValue, name];
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
            {activeSensors.map((sensorNum) => {
              const color = getColor(sensorNum);
              return (
                <Line
                  key={sensorNum}
                  type="monotone"
                  dataKey={`S${sensorNum}`}
                  name={`S${sensorNum}`}
                  stroke={color}
                  strokeWidth={1.5}
                  dot={false}
                  hide={!visibleSensors.has(sensorNum)}
                  activeDot={{ r: 4, fill: color }}
                  isAnimationActive={false}
                />
              );
            })}
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
      </div>
    </div>
  );
}
