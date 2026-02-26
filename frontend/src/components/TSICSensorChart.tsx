import { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Brush, ReferenceArea,
} from 'recharts';
import { format } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import type { TSICDataPoint } from '@/lib/tsicDataParsing';

interface TSICSensorChartProps {
  data: TSICDataPoint[];
  startIndex: number;
  endIndex: number;
  onRangeChange: (startIndex: number, endIndex: number) => void;
  yAxisMin?: number | null;
  yAxisMax?: number | null;
  sensorVisibility: Record<string, boolean>;
  onToggleSensor: (sensorKey: string) => void;
  onResetStates?: () => void;
}

// Generate colors for 72 sensors using HSL color space for better distribution
const generateSensorColors = (count: number): string[] => {
  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    const hue = (i * 360) / count;
    const saturation = 60 + (i % 3) * 15;
    const lightness = 45 + (i % 4) * 10;
    colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
  }
  return colors;
};

const sensorColors = generateSensorColors(72);

export function TSICSensorChart({
  data,
  startIndex,
  endIndex,
  onRangeChange,
  yAxisMin,
  yAxisMax,
  sensorVisibility,
  onToggleSensor,
  onResetStates
}: TSICSensorChartProps) {
  const chartData = useMemo(() => {
    const shouldClip = yAxisMin !== null && yAxisMin !== undefined && yAxisMax !== null && yAxisMax !== undefined;

    return data.map((point) => {
      const dataPoint: any = {
        timestamp: point.timestamp.getTime(),
        timeLabel: format(point.timestamp, 'HH:mm:ss'),
        fullTimestamp: format(point.timestamp, 'yyyy-MM-dd HH:mm:ss'),
      };

      for (let i = 1; i <= 72; i++) {
        const sensorKey = `S${i}` as keyof typeof point.sensors;
        const value = point.sensors[sensorKey];

        if (shouldClip) {
          if (value < yAxisMin! || value > yAxisMax!) {
            dataPoint[sensorKey] = null;
          } else {
            dataPoint[sensorKey] = value;
          }
        } else {
          dataPoint[sensorKey] = value;
        }
      }

      return dataPoint;
    });
  }, [data, yAxisMin, yAxisMax]);

  // Auto-zoom to last day on first data load
  const initializedRef = useRef(false);
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
  const [isSelecting, setIsSelecting] = useState(false);
  const [zoomedYBottom, setZoomedYBottom] = useState<number | null>(null);
  const [zoomedYTop, setZoomedYTop] = useState<number | null>(null);
  const selectingRef = useRef(false);

  // Reset states when data changes (new data loaded)
  useEffect(() => {
    if (onResetStates && data.length > 0) {
      onResetStates();
    }
  }, [data.length, onResetStates]);

  const handleBrushChange = useCallback((range: { startIndex?: number; endIndex?: number }) => {
    if (range.startIndex !== undefined && range.endIndex !== undefined) {
      onRangeChange(range.startIndex, range.endIndex);
    }
  }, [onRangeChange]);

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
    const leftIdx = visibleData.findIndex(d => d.timeLabel === refAreaLeft);
    const rightIdx = visibleData.findIndex(d => d.timeLabel === refAreaRight);

    if (leftIdx === -1 || rightIdx === -1) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }

    const lo = Math.min(leftIdx, rightIdx);
    const hi = Math.max(leftIdx, rightIdx);
    const slice = visibleData.slice(lo, hi + 1);

    // Compute Y domain from visible (checked) sensors in the slice
    const allYValues: number[] = [];
    for (const point of slice) {
      for (let i = 1; i <= 72; i++) {
        const sensorKey = `S${i}`;
        if (sensorVisibility[sensorKey]) {
          const v = point[sensorKey];
          if (v !== null && v !== undefined && !isNaN(v)) {
            allYValues.push(v);
          }
        }
      }
    }

    if (allYValues.length > 0) {
      const minY = Math.min(...allYValues);
      const maxY = Math.max(...allYValues);
      const padding = (maxY - minY) * 0.05 || 0.5;
      setZoomedYBottom(minY - padding);
      setZoomedYTop(maxY + padding);
    }

    onRangeChange(startIndex + lo, startIndex + hi);
    setRefAreaLeft(null);
    setRefAreaRight(null);
  }, [refAreaLeft, refAreaRight, chartData, startIndex, endIndex, onRangeChange, sensorVisibility]);

  // Reset Y zoom when brush range resets to full data
  const prevStartIndex = useRef(startIndex);
  const prevEndIndex = useRef(endIndex);
  if (prevStartIndex.current !== startIndex || prevEndIndex.current !== endIndex) {
    prevStartIndex.current = startIndex;
    prevEndIndex.current = endIndex;
    if (startIndex === 0 && endIndex === data.length - 1) {
      setZoomedYBottom(null);
      setZoomedYTop(null);
    }
  }

  // Filter out sensors that are all zeros to reduce clutter
  const activeSensors = useMemo(() => {
    const active: string[] = [];
    for (let i = 1; i <= 72; i++) {
      const sensorKey = `S${i}` as keyof typeof data[0]['sensors'];
      const hasNonZeroValue = data.some(point => point.sensors[sensorKey] !== 0);
      if (hasNonZeroValue) {
        active.push(`S${i}`);
      }
    }
    return active;
  }, [data]);

  // Custom legend with checkboxes - always show all active sensors
  const renderCustomLegend = (_props: any) => {
    return (
      <div className="flex flex-wrap gap-3 justify-center px-4 py-2 max-h-[200px] overflow-y-auto">
        {activeSensors.map((sensorKey) => {
          const isVisible = sensorVisibility[sensorKey];
          const sensorNumber = parseInt(sensorKey.substring(1));
          const color = sensorColors[sensorNumber - 1];

          return (
            <div
              key={`legend-${sensorKey}`}
              className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 px-2 py-1 rounded transition-colors"
              onClick={() => onToggleSensor(sensorKey)}
            >
              <Checkbox
                checked={isVisible}
                className="h-4 w-4 pointer-events-none"
              />
              <div
                className="w-4 h-0.5"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs" style={{ color: 'oklch(var(--foreground))' }}>
                {sensorKey}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  // Determine Y-axis domain - drag zoom overrides user limits when active
  const yAxisDomain = useMemo((): [number | 'auto', number | 'auto'] => {
    // If drag zoom is active, use zoomed domain
    if (zoomedYBottom !== null && zoomedYTop !== null) {
      return [zoomedYBottom, zoomedYTop];
    }
    // Otherwise use user-specified limits
    if (yAxisMin !== null && yAxisMin !== undefined && yAxisMax !== null && yAxisMax !== undefined) {
      return [yAxisMin, yAxisMax];
    } else if (yAxisMin !== null && yAxisMin !== undefined) {
      return [yAxisMin, 'auto'];
    } else if (yAxisMax !== null && yAxisMax !== undefined) {
      return ['auto', yAxisMax];
    }
    return ['auto', 'auto'];
  }, [yAxisMin, yAxisMax, zoomedYBottom, zoomedYTop]);

  // Count visible sensors
  const visibleSensorCount = useMemo(() => {
    return activeSensors.filter(s => sensorVisibility[s]).length;
  }, [activeSensors, sensorVisibility]);

  return (
    <div className="w-full h-[600px]" style={{ userSelect: 'none' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--border))" opacity={0.3} />
          <XAxis
            dataKey="timeLabel"
            stroke="oklch(var(--muted-foreground))"
            tick={{ fill: 'oklch(var(--muted-foreground))', fontSize: 12 }}
            tickLine={{ stroke: 'oklch(var(--border))' }}
            allowDataOverflow
          />
          <YAxis
            domain={yAxisDomain}
            allowDataOverflow={true}
            stroke="oklch(var(--muted-foreground))"
            tick={{ fill: 'oklch(var(--muted-foreground))', fontSize: 12 }}
            tickLine={{ stroke: 'oklch(var(--border))' }}
            label={{
              value: 'Sensor Value',
              angle: -90,
              position: 'insideLeft',
              style: { fill: 'oklch(var(--muted-foreground))', fontSize: 12 },
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'oklch(var(--popover))',
              border: '1px solid oklch(var(--border))',
              borderRadius: '8px',
              color: 'oklch(var(--popover-foreground))',
              maxHeight: '400px',
              overflowY: 'auto',
            }}
            labelStyle={{ color: 'oklch(var(--popover-foreground))' }}
            formatter={(value: number, name: string) => {
              return [value, name];
            }}
            labelFormatter={((label: any, payload: any) => {
              if (payload && payload.length > 0) {
                const dataPoint = payload[0].payload;
                if (dataPoint?.fullTimestamp) {
                  return dataPoint.fullTimestamp;
                }
              }
              return label;
            }) as any}
          />
          <Legend
            content={renderCustomLegend}
            wrapperStyle={{
              paddingTop: '10px',
            }}
          />
          {/* Render all active sensors, but use light gray for unchecked ones */}
          {activeSensors.map((sensorKey) => {
            const sensorNumber = parseInt(sensorKey.substring(1));
            const isVisible = sensorVisibility[sensorKey];
            const originalColor = sensorColors[sensorNumber - 1];
            const displayColor = isVisible ? originalColor : '#d1d5db';

            return (
              <Line
                key={sensorKey}
                type="monotone"
                dataKey={sensorKey}
                name={sensorKey}
                stroke={displayColor}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4 }}
                opacity={isVisible ? 1 : 0.3}
                connectNulls={false}
              />
            );
          })}
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
      {activeSensors.length < 72 && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Showing {visibleSensorCount} of {activeSensors.length} active sensors (sensors with all zero values are hidden)
        </p>
      )}
      {(zoomedYBottom !== null || (startIndex > 0 || endIndex < data.length - 1)) && (
        <p className="text-xs text-muted-foreground text-center mt-1">
          💡 Drag on the chart to zoom in · Use the brush below to pan · Reset Zoom to restore
        </p>
      )}
    </div>
  );
}
