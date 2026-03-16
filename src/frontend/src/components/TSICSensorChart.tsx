import { type SensorGroup, getGroupColor } from "@/hooks/useSensorGroups";
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
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

export interface HoveredGroup {
  groupName: string;
  groupColor: string;
  sensors: { label: string; value: number; isBold: boolean }[];
}

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
  sensorColorMap?: Record<number, string>;
  groups?: SensorGroup[];
  sensorLabels?: Map<number, string>;
  boldSensors?: Set<number>;
  dottedSensors?: Set<number>;
  onHoverChange?: (
    groups: HoveredGroup[] | null,
    timestamp: string | null,
  ) => void;
}

const SENSOR_COUNT = 72;
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
  groups,
  sensorLabels,
  boldSensors,
  dottedSensors,
  onHoverChange,
}: TSICSensorChartProps) {
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

  const [internalVisibleSensors, setInternalVisibleSensors] = useState<
    Set<number>
  >(() => new Set(activeSensors));

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional
  useEffect(() => {
    setInternalVisibleSensors(new Set(activeSensors));
  }, [activeSensors.join(",")]);

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

  const xTickEntries = useMemo((): XTickEntry[] => {
    const slice = chartData.slice(startIndex, endIndex + 1);
    if (slice.length === 0) return [];
    return buildXTicks(
      slice[0].timestamp as number,
      slice[slice.length - 1].timestamp as number,
    );
  }, [chartData, startIndex, endIndex]);

  const xTickValues = useMemo(
    () => xTickEntries.map((t) => t.timestamp),
    [xTickEntries],
  );

  const xDomain = useMemo((): [number, number] | [string, string] => {
    const slice = chartData.slice(startIndex, endIndex + 1);
    if (slice.length === 0) return ["dataMin", "dataMax"];
    return computeXDomain(
      slice[0].timestamp as number,
      slice[slice.length - 1].timestamp as number,
    );
  }, [chartData, startIndex, endIndex]);

  const initializedRef = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional
  useEffect(() => {
    if (data.length > 1 && !initializedRef.current) {
      initializedRef.current = true;
      const lastIndex = data.length - 1;
      const lastTs = data[lastIndex].timestamp.getTime();
      const startTs = lastTs - 24 * 60 * 60 * 1000;
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
  }, [data.length]);

  const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [zoomedYBottom, setZoomedYBottom] = useState<number | null>(null);
  const [zoomedYTop, setZoomedYTop] = useState<number | null>(null);
  const selectingRef = useRef(false);

  // Cursor tooltip state
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [nearestSensorNum, setNearestSensorNum] = useState<number | null>(null);

  const handleBrushChange = useCallback(
    (range: { startIndex?: number; endIndex?: number }) => {
      if (range.startIndex !== undefined && range.endIndex !== undefined) {
        onRangeChange(range.startIndex, range.endIndex);
      }
    },
    [onRangeChange],
  );

  const handleMouseDown = useCallback((e: any) => {
    if (!e?.activeLabel) return;
    setRefAreaLeft(String(e.activeLabel));
    setRefAreaRight(null);
    setIsSelecting(true);
    selectingRef.current = true;
    setNearestSensorNum(null);
  }, []);

  const buildHoverGroups = useCallback(
    (payload: any[], fullTimestamp: string): HoveredGroup[] => {
      const sensorValues: Record<number, number> = {};
      for (const entry of payload) {
        const match = String(entry.dataKey).match(/^S(\d+)$/);
        if (!match) continue;
        const sNum = Number.parseInt(match[1]);
        if (!visibleSensors.has(sNum)) continue;
        const val = entry.value as number;
        if (val === null || val === undefined || Number.isNaN(val) || val === 0)
          continue;
        sensorValues[sNum] = val;
      }

      if (Object.keys(sensorValues).length === 0) return [];

      const result: HoveredGroup[] = [];
      const assignedSensors = new Set<number>();

      const sortedGroups = [...(groups ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      for (const group of sortedGroups) {
        const entries = group.sensors
          .filter((s) => sensorValues[s] !== undefined)
          .map((s) => {
            assignedSensors.add(s);
            const label = sensorLabels?.get(s) || `S${s}`;
            const isBold = boldSensors?.has(s) ?? false;
            return { label, value: sensorValues[s], isBold };
          });
        if (entries.length === 0) continue;
        result.push({
          groupName: group.name,
          groupColor: getGroupColor(group),
          sensors: entries,
        });
      }

      void assignedSensors;
      void fullTimestamp;
      return result;
    },
    [groups, sensorLabels, boldSensors, visibleSensors],
  );

  const handleMouseMove = useCallback(
    (e: any) => {
      if (e?.activePayload?.length) {
        const timestamp = e.activePayload[0]?.payload?.fullTimestamp || null;
        const hoverGroups = buildHoverGroups(e.activePayload, timestamp ?? "");
        onHoverChange?.(hoverGroups.length > 0 ? hoverGroups : null, timestamp);
        if (e.activeLabel) setHoverX(Number(e.activeLabel));
      } else {
        onHoverChange?.(null, null);
        setHoverX(null);
      }

      // Find nearest sensor line for cursor tooltip
      if (
        !selectingRef.current &&
        e?.activePayload?.length &&
        (e as any).chartY != null
      ) {
        let minDist = Number.POSITIVE_INFINITY;
        let nearestNum: number | null = null;
        for (const entry of e.activePayload) {
          const match = String(entry.dataKey).match(/^S(\d+)$/);
          if (!match) continue;
          if (entry.value != null && !Number.isNaN(entry.value)) {
            // Use pixel distance if entry.y is available, otherwise use data-unit distance
            let dist: number;
            if (entry.y != null) {
              dist = Math.abs(entry.y - (e as any).chartY);
            } else {
              // Fallback: pick the sensor closest to the cursor using value distance
              dist = Number.POSITIVE_INFINITY;
            }
            if (dist < minDist) {
              minDist = dist;
              nearestNum = Number.parseInt(match[1]);
            }
          }
        }
        setNearestSensorNum(nearestNum);
      } else if (selectingRef.current) {
        setNearestSensorNum(null);
      }

      if (!selectingRef.current || !e?.activeLabel) return;
      setRefAreaRight(String(e.activeLabel));
    },
    [buildHoverGroups, onHoverChange],
  );

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

  const handleMouseLeave = useCallback(() => {
    onHoverChange?.(null, null);
    setHoverX(null);
    setCursorPos(null);
    setNearestSensorNum(null);
    if (!selectingRef.current) return;
    selectingRef.current = false;
    setIsSelecting(false);
    setRefAreaLeft(null);
    setRefAreaRight(null);
  }, [onHoverChange]);

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

  const yDomain: [number | string, number | string] = useMemo(() => {
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

  const getColor = (sensorNum: number): string =>
    sensorColorMap[sensorNum] ?? FALLBACK_COLOR;

  const normalSensors = activeSensors.filter((s) => !boldSensors?.has(s));
  const boldSensorList = activeSensors.filter((s) => boldSensors?.has(s));
  const orderedSensors = [...normalSensors, ...boldSensorList];

  void isSelecting;
  void externalToggleSensor;

  // Cursor tooltip display
  let cursorTooltipText: string | null = null;
  if (nearestSensorNum !== null) {
    const label = sensorLabels?.get(nearestSensorNum);
    cursorTooltipText = label
      ? `${label} (S${nearestSensorNum})`
      : `S${nearestSensorNum}`;
  }

  return (
    <div
      className="w-full"
      style={{ userSelect: "none" }}
      onMouseMove={(e) => setCursorPos({ x: e.clientX, y: e.clientY })}
    >
      <div className="w-full h-[900px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 2, right: 30, left: 20, bottom: 60 }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
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
                value: "Temperature (\u00b0F)",
                angle: -90,
                position: "insideLeft",
                style: { fill: "oklch(var(--muted-foreground))", fontSize: 12 },
              }}
            />
            {orderedSensors.map((sensorNum) => {
              const color = getColor(sensorNum);
              const isBold = boldSensors?.has(sensorNum);
              const isDotted = dottedSensors?.has(sensorNum);
              return (
                <Line
                  key={sensorNum}
                  type="monotone"
                  dataKey={`S${sensorNum}`}
                  name={`S${sensorNum}`}
                  stroke={color}
                  strokeWidth={isBold ? 2 : 0.8}
                  strokeDasharray={isDotted ? "5 3" : undefined}
                  dot={false}
                  hide={!visibleSensors.has(sensorNum)}
                  activeDot={{ r: isBold ? 5 : 4, fill: color }}
                  isAnimationActive={false}
                />
              );
            })}
            {hoverX !== null && !isSelecting && (
              <ReferenceLine
                x={hoverX}
                stroke="#888888"
                strokeWidth={1}
                strokeDasharray="4 2"
              />
            )}
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
      {cursorPos && cursorTooltipText && (
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
          {cursorTooltipText}
        </div>
      )}
    </div>
  );
}
