import { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Brush, ReferenceArea,
} from 'recharts';
import { format } from 'date-fns';
import type { TemperatureDataPoint } from '@/lib/temperatureParsing';

interface CO2ChartProps {
  data: TemperatureDataPoint[];
  startIndex: number;
  endIndex: number;
  onRangeChange: (startIndex: number, endIndex: number) => void;
}

export function CO2Chart({ data, startIndex, endIndex, onRangeChange }: CO2ChartProps) {
  const chartData = useMemo(() => {
    return data.map((point) => ({
      timestamp: point.timestamp.getTime(),
      co2Right: point.co2Right,
      co2Left: point.co2Left,
      co2CSV: point.co2CSV,
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
    const allYValues = slice.flatMap(d => [d.co2Right, d.co2Left, d.co2CSV]).filter(v => v != null && !isNaN(v as number)) as number[];
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
  }, [refAreaLeft, refAreaRight, chartData, startIndex, endIndex, onRangeChange]);

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

  const yDomain: [number | string, number | string] =
    zoomedYBottom !== null && zoomedYTop !== null
      ? [zoomedYBottom, zoomedYTop]
      : ['auto', 'auto'];

  return (
    <div className="w-full h-[450px]" style={{ userSelect: 'none' }}>
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
            domain={yDomain}
            allowDataOverflow
            stroke="oklch(var(--muted-foreground))"
            tick={{ fill: 'oklch(var(--muted-foreground))', fontSize: 12 }}
            tickLine={{ stroke: 'oklch(var(--border))' }}
            label={{
              value: 'CO₂ Level (%)',
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
            }}
            labelStyle={{ color: 'oklch(var(--popover-foreground))' }}
            formatter={(value: number, name: string) => {
              let label = '';
              if (name === 'co2Right') label = 'CO2 Right (%)';
              else if (name === 'co2Left') label = 'CO2 Left (%)';
              else if (name === 'co2CSV') label = 'CO2 CSV (%) - dashed';

              const formattedValue = typeof value === 'number' && !isNaN(value)
                ? value.toFixed(2)
                : '0.00';
              return [formattedValue, label];
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
              if (value === 'co2Right') return 'CO2 Right (%)';
              if (value === 'co2Left') return 'CO2 Left (%)';
              if (value === 'co2CSV') return 'CO2 CSV (%) - dashed';
              return value;
            }}
          />
          <Line
            type="monotone"
            dataKey="co2Right"
            name="co2Right"
            stroke="oklch(var(--chart-co2-1))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6, fill: 'oklch(var(--chart-co2-1))' }}
          />
          <Line
            type="monotone"
            dataKey="co2Left"
            name="co2Left"
            stroke="oklch(var(--chart-co2-2))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6, fill: 'oklch(var(--chart-co2-2))' }}
          />
          <Line
            type="monotone"
            dataKey="co2CSV"
            name="co2CSV"
            stroke="oklch(var(--chart-co2-3))"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            activeDot={{ r: 6, fill: 'oklch(var(--chart-co2-3))' }}
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
      {(zoomedYBottom !== null || (startIndex > 0 || endIndex < data.length - 1)) && (
        <p className="text-xs text-muted-foreground text-center mt-1">
          💡 Drag on the chart to zoom in · Use the brush below to pan · Reset Zoom to restore
        </p>
      )}
    </div>
  );
}
