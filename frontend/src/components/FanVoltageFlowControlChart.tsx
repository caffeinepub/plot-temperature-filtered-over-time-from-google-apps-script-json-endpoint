import { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Brush, ReferenceArea,
} from 'recharts';
import { format } from 'date-fns';
import type { TemperatureDataPoint } from '@/lib/temperatureParsing';

interface FanVoltageFlowControlChartProps {
  data: TemperatureDataPoint[];
  startIndex: number;
  endIndex: number;
  onRangeChange: (startIndex: number, endIndex: number) => void;
}

export function FanVoltageFlowControlChart({ data, startIndex, endIndex, onRangeChange }: FanVoltageFlowControlChartProps) {
  const chartData = useMemo(() => {
    return data.map((point) => ({
      timestamp: point.timestamp.getTime(),
      fan1V: point.fan1V,
      fan2V: point.fan2V,
      fan3V: point.fan3V,
      flowControlPa: point.flowControlPa,
      timeLabel: format(point.timestamp, 'HH:mm:ss'),
      fullTimestamp: format(point.timestamp, 'yyyy-MM-dd HH:mm:ss'),
    }));
  }, [data]);

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
  const [zoomedLeftBottom, setZoomedLeftBottom] = useState<number | null>(null);
  const [zoomedLeftTop, setZoomedLeftTop] = useState<number | null>(null);
  const [zoomedRightBottom, setZoomedRightBottom] = useState<number | null>(null);
  const [zoomedRightTop, setZoomedRightTop] = useState<number | null>(null);
  const selectingRef = useRef(false);

  // Detect dark mode from document class
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

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

    // Left Y-axis (voltage)
    const voltageValues = slice
      .flatMap(d => [d.fan1V, d.fan2V, d.fan3V])
      .filter(v => v !== null && !isNaN(v as number)) as number[];
    if (voltageValues.length > 0) {
      const minV = Math.min(...voltageValues);
      const maxV = Math.max(...voltageValues);
      const pad = (maxV - minV) * 0.05 || 0.1;
      setZoomedLeftBottom(minV - pad);
      setZoomedLeftTop(maxV + pad);
    }

    // Right Y-axis (pressure)
    const pressureValues = slice
      .map(d => d.flowControlPa)
      .filter(v => v !== null && !isNaN(v as number)) as number[];
    if (pressureValues.length > 0) {
      const minP = Math.min(...pressureValues);
      const maxP = Math.max(...pressureValues);
      const pad = (maxP - minP) * 0.05 || 5;
      setZoomedRightBottom(minP - pad);
      setZoomedRightTop(maxP + pad);
    }

    onRangeChange(startIndex + lo, startIndex + hi);
    setRefAreaLeft(null);
    setRefAreaRight(null);
  }, [refAreaLeft, refAreaRight, chartData, startIndex, endIndex, onRangeChange]);

  const prevStartIndex = useRef(startIndex);
  const prevEndIndex = useRef(endIndex);
  if (prevStartIndex.current !== startIndex || prevEndIndex.current !== endIndex) {
    prevStartIndex.current = startIndex;
    prevEndIndex.current = endIndex;
    if (startIndex === 0 && endIndex === data.length - 1) {
      setZoomedLeftBottom(null);
      setZoomedLeftTop(null);
      setZoomedRightBottom(null);
      setZoomedRightTop(null);
    }
  }

  const leftDomain: [number | string, number | string] =
    zoomedLeftBottom !== null && zoomedLeftTop !== null
      ? [zoomedLeftBottom, zoomedLeftTop]
      : [0, 10];

  const rightDomain: [number | string, number | string] =
    zoomedRightBottom !== null && zoomedRightTop !== null
      ? [zoomedRightBottom, zoomedRightTop]
      : [0, 1000];

  // Flow control line: black in light mode, white in dark mode
  const flowControlColor = isDark ? '#ffffff' : '#000000';

  return (
    <div className="w-full h-[450px]" style={{ userSelect: 'none' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 60, left: 20, bottom: 60 }}
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
          {/* Left Y-axis for Voltage */}
          <YAxis
            yAxisId="left"
            domain={leftDomain}
            allowDataOverflow
            stroke="oklch(var(--muted-foreground))"
            tick={{ fill: 'oklch(var(--muted-foreground))', fontSize: 12 }}
            tickLine={{ stroke: 'oklch(var(--border))' }}
            label={{
              value: 'Voltage (V)',
              angle: -90,
              position: 'insideLeft',
              style: { fill: 'oklch(var(--muted-foreground))', fontSize: 12 },
            }}
          />
          {/* Right Y-axis for Pressure */}
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={rightDomain}
            allowDataOverflow
            stroke="oklch(var(--muted-foreground))"
            tick={{ fill: 'oklch(var(--muted-foreground))', fontSize: 12 }}
            tickLine={{ stroke: 'oklch(var(--border))' }}
            label={{
              value: 'Pressure (Pa)',
              angle: 90,
              position: 'insideRight',
              style: { fill: 'oklch(var(--muted-foreground))', fontSize: 12 },
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'oklch(var(--popover))',
              border: '1px solid oklch(var(--border))',
              borderRadius: '8px',
              color: 'oklch(var(--popover-foreground))',
            }}
            labelStyle={{ color: 'oklch(var(--popover-foreground))' }}
            formatter={(value: any, name: string) => {
              let label = '';
              let unit = '';
              if (name === 'fan1V') { label = 'Fan 1'; unit = 'V'; }
              else if (name === 'fan2V') { label = 'Fan 2'; unit = 'V'; }
              else if (name === 'fan3V') { label = 'Fan 3'; unit = 'V'; }
              else if (name === 'flowControlPa') { label = 'Flow Control'; unit = 'Pa'; }

              const formattedValue = value !== null && typeof value === 'number' && !isNaN(value)
                ? value.toFixed(2)
                : 'N/A';
              return [`${formattedValue} ${unit}`, label];
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
            wrapperStyle={{
              paddingTop: '10px',
              color: 'oklch(var(--foreground))',
            }}
            iconType="line"
            formatter={(value) => {
              if (value === 'fan1V') return 'Fan 1 (V)';
              if (value === 'fan2V') return 'Fan 2 (V)';
              if (value === 'fan3V') return 'Fan 3 (V)';
              if (value === 'flowControlPa') return 'Flow Control (Pa)';
              return value;
            }}
          />
          {/* Fan voltage lines on left axis */}
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="fan1V"
            stroke="oklch(0.70 0.12 220)"
            strokeWidth={2}
            dot={false}
            connectNulls
            name="fan1V"
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="fan2V"
            stroke="oklch(0.55 0.15 240)"
            strokeWidth={2}
            dot={false}
            connectNulls
            name="fan2V"
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="fan3V"
            stroke="oklch(0.45 0.18 260)"
            strokeWidth={2}
            dot={false}
            connectNulls
            name="fan3V"
          />
          {/* Flow control pressure on right axis — black in light mode, white in dark mode */}
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="flowControlPa"
            stroke={flowControlColor}
            strokeWidth={2}
            dot={false}
            connectNulls
            name="flowControlPa"
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
      {(zoomedLeftBottom !== null || (startIndex > 0 || endIndex < data.length - 1)) && (
        <p className="text-xs text-muted-foreground text-center mt-1">
          💡 Drag on the chart to zoom in · Use the brush below to pan · Reset Zoom to restore
        </p>
      )}
    </div>
  );
}
