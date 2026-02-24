import { useMemo, useCallback, useState, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Brush, ReferenceArea,
} from 'recharts';
import { format } from 'date-fns';
import type { TSICDataPoint } from '@/lib/tsicDataParsing';

const SENSOR_COLORS = [
  'oklch(0.65 0.18 142)', 'oklch(0.60 0.20 200)', 'oklch(0.65 0.22 30)',
  'oklch(0.55 0.18 280)', 'oklch(0.70 0.20 60)', 'oklch(0.60 0.22 320)',
  'oklch(0.65 0.18 170)', 'oklch(0.58 0.20 240)', 'oklch(0.68 0.22 10)',
  'oklch(0.62 0.18 300)', 'oklch(0.72 0.20 80)', 'oklch(0.56 0.22 200)',
  'oklch(0.66 0.18 130)', 'oklch(0.61 0.20 260)', 'oklch(0.69 0.22 40)',
  'oklch(0.57 0.18 310)', 'oklch(0.71 0.20 100)', 'oklch(0.63 0.22 220)',
  'oklch(0.67 0.18 150)', 'oklch(0.59 0.20 280)', 'oklch(0.64 0.22 20)',
  'oklch(0.54 0.18 330)', 'oklch(0.73 0.20 70)', 'oklch(0.60 0.22 190)',
  'oklch(0.65 0.18 160)', 'oklch(0.62 0.20 250)', 'oklch(0.68 0.22 50)',
  'oklch(0.56 0.18 290)', 'oklch(0.70 0.20 90)', 'oklch(0.64 0.22 210)',
  'oklch(0.66 0.18 140)', 'oklch(0.61 0.20 270)', 'oklch(0.69 0.22 30)',
  'oklch(0.57 0.18 300)', 'oklch(0.71 0.20 110)', 'oklch(0.63 0.22 230)',
  'oklch(0.67 0.18 155)', 'oklch(0.59 0.20 285)', 'oklch(0.64 0.22 25)',
  'oklch(0.54 0.18 335)', 'oklch(0.73 0.20 75)', 'oklch(0.60 0.22 195)',
  'oklch(0.65 0.18 165)', 'oklch(0.62 0.20 255)', 'oklch(0.68 0.22 55)',
  'oklch(0.56 0.18 295)', 'oklch(0.70 0.20 95)', 'oklch(0.64 0.22 215)',
  'oklch(0.66 0.18 145)', 'oklch(0.61 0.20 275)', 'oklch(0.69 0.22 35)',
  'oklch(0.57 0.18 305)', 'oklch(0.71 0.20 115)', 'oklch(0.63 0.22 235)',
  'oklch(0.67 0.18 158)', 'oklch(0.59 0.20 288)', 'oklch(0.64 0.22 28)',
  'oklch(0.54 0.18 338)', 'oklch(0.73 0.20 78)', 'oklch(0.60 0.22 198)',
  'oklch(0.65 0.18 168)', 'oklch(0.62 0.20 258)', 'oklch(0.68 0.22 58)',
  'oklch(0.56 0.18 298)', 'oklch(0.70 0.20 98)', 'oklch(0.64 0.22 218)',
  'oklch(0.66 0.18 148)', 'oklch(0.61 0.20 278)', 'oklch(0.69 0.22 38)',
  'oklch(0.57 0.18 308)', 'oklch(0.71 0.20 118)', 'oklch(0.63 0.22 238)',
];

interface TSICSensorChartProps {
  data: TSICDataPoint[];
  startIndex: number;
  endIndex: number;
  onRangeChange: (startIndex: number, endIndex: number) => void;
  sensorVisibility: Record<string, boolean>;
  onToggleSensor: (sensorKey: string) => void;
  onResetStates: () => void;
  yAxisMin?: number | null;
  yAxisMax?: number | null;
}

export function TSICSensorChart({
  data,
  startIndex,
  endIndex,
  onRangeChange,
  sensorVisibility,
  onToggleSensor,
  onResetStates,
  yAxisMin,
  yAxisMax,
}: TSICSensorChartProps) {
  const sensorCount = data.length > 0 ? Object.keys(data[0]).filter(k => k.startsWith('S')).length : 0;
  const sensorKeys = useMemo(() => Array.from({ length: sensorCount }, (_, i) => `S${i + 1}`), [sensorCount]);

  const chartData = useMemo(() => {
    // Trigger reset check when data changes
    onResetStates();
    return data.map((point) => {
      const entry: Record<string, any> = {
        timestamp: point.timestamp.getTime(),
        timeLabel: format(point.timestamp, 'HH:mm:ss'),
        fullTimestamp: format(point.timestamp, 'yyyy-MM-dd HH:mm:ss'),
      };
      sensorKeys.forEach(key => {
        entry[key] = (point as any)[key];
      });
      return entry;
    });
  }, [data, sensorKeys, onResetStates]);

  // Drag-zoom state
  const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [zoomedYBottom, setZoomedYBottom] = useState<number | null>(null);
  const [zoomedYTop, setZoomedYTop] = useState<number | null>(null);
  const selectingRef = useRef(false);

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
    const visibleSensorKeys = sensorKeys.filter(key => sensorVisibility[key] !== false);
    const allYValues = slice.flatMap(d => visibleSensorKeys.map(k => d[k])).filter(v => v != null && !isNaN(v)) as number[];
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
  }, [refAreaLeft, refAreaRight, chartData, startIndex, endIndex, onRangeChange, sensorKeys, sensorVisibility]);

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

  // Y domain: drag-zoom overrides user-specified min/max
  let yBottom: number | string = 'auto';
  let yTop: number | string = 'auto';
  if (zoomedYBottom !== null && zoomedYTop !== null) {
    yBottom = zoomedYBottom;
    yTop = zoomedYTop;
  } else {
    if (yAxisMin != null && !isNaN(yAxisMin)) yBottom = yAxisMin;
    if (yAxisMax != null && !isNaN(yAxisMax)) yTop = yAxisMax;
  }
  const yDomain: [number | string, number | string] = [yBottom, yTop];

  const allVisible = sensorKeys.every(key => sensorVisibility[key] !== false);

  const toggleAll = useCallback((checked: boolean) => {
    sensorKeys.forEach(key => {
      if ((sensorVisibility[key] !== false) !== checked) {
        onToggleSensor(key);
      }
    });
  }, [sensorKeys, sensorVisibility, onToggleSensor]);

  return (
    <div className="w-full" style={{ userSelect: 'none' }}>
      {/* Legend / checkbox controls */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 px-4 pb-2 pt-1">
        <label className="flex items-center gap-1 text-xs cursor-pointer font-semibold text-foreground">
          <input
            type="checkbox"
            checked={allVisible}
            onChange={e => toggleAll(e.target.checked)}
            className="accent-primary"
          />
          All
        </label>
        {sensorKeys.map((key, i) => (
          <label key={key} className="flex items-center gap-1 text-xs cursor-pointer" style={{ color: SENSOR_COLORS[i % SENSOR_COLORS.length] }}>
            <input
              type="checkbox"
              checked={sensorVisibility[key] !== false}
              onChange={() => onToggleSensor(key)}
              className="accent-primary"
            />
            {key}
          </label>
        ))}
      </div>

      <div className="w-full h-[500px]">
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
              tick={{ fill: 'oklch(var(--muted-foreground))', fontSize: 11 }}
              tickLine={{ stroke: 'oklch(var(--border))' }}
              allowDataOverflow
            />
            <YAxis
              domain={yDomain}
              allowDataOverflow
              stroke="oklch(var(--muted-foreground))"
              tick={{ fill: 'oklch(var(--muted-foreground))', fontSize: 11 }}
              tickLine={{ stroke: 'oklch(var(--border))' }}
              label={{
                value: 'Temperature (°C)',
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
                maxHeight: '300px',
                overflowY: 'auto',
              }}
              labelStyle={{ color: 'oklch(var(--popover-foreground))' }}
              formatter={(value: number, name: string) => {
                const formattedValue = typeof value === 'number' && !isNaN(value)
                  ? value.toFixed(2)
                  : '—';
                return [formattedValue + ' °C', name];
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
            {sensorKeys.map((key, i) =>
              sensorVisibility[key] !== false ? (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={key}
                  stroke={SENSOR_COLORS[i % SENSOR_COLORS.length]}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              ) : null
            )}
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
      </div>
      {(zoomedYBottom !== null || (startIndex > 0 || endIndex < data.length - 1)) && (
        <p className="text-xs text-muted-foreground text-center mt-1">
          💡 Drag on the chart to zoom in · Use the brush below to pan · Reset Zoom to restore
        </p>
      )}
    </div>
  );
}
