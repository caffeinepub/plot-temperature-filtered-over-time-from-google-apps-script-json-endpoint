import { useMemo, useCallback, useState, useRef } from 'react';
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

  // Drag-zoom state
  const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [zoomedYLeftBottom, setZoomedYLeftBottom] = useState<number | null>(null);
  const [zoomedYLeftTop, setZoomedYLeftTop] = useState<number | null>(null);
  const [zoomedYRightBottom, setZoomedYRightBottom] = useState<number | null>(null);
  const [zoomedYRightTop, setZoomedYRightTop] = useState<number | null>(null);
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

    // Left Y axis: voltages
    const voltageValues = slice.flatMap(d => [d.fan1V, d.fan2V, d.fan3V]).filter(v => v != null && !isNaN(v as number)) as number[];
    if (voltageValues.length > 0) {
      const minY = Math.min(...voltageValues);
      const maxY = Math.max(...voltageValues);
      const padding = (maxY - minY) * 0.05 || 0.1;
      setZoomedYLeftBottom(minY - padding);
      setZoomedYLeftTop(maxY + padding);
    }

    // Right Y axis: flow control pressure
    const flowValues = slice.map(d => d.flowControlPa).filter(v => v != null && !isNaN(v as number)) as number[];
    if (flowValues.length > 0) {
      const minY = Math.min(...flowValues);
      const maxY = Math.max(...flowValues);
      const padding = (maxY - minY) * 0.05 || 1;
      setZoomedYRightBottom(minY - padding);
      setZoomedYRightTop(maxY + padding);
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
      setZoomedYLeftBottom(null);
      setZoomedYLeftTop(null);
      setZoomedYRightBottom(null);
      setZoomedYRightTop(null);
    }
  }

  const yLeftDomain: [number | string, number | string] =
    zoomedYLeftBottom !== null && zoomedYLeftTop !== null
      ? [zoomedYLeftBottom, zoomedYLeftTop]
      : ['auto', 'auto'];

  const yRightDomain: [number | string, number | string] =
    zoomedYRightBottom !== null && zoomedYRightTop !== null
      ? [zoomedYRightBottom, zoomedYRightTop]
      : ['auto', 'auto'];

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
          <YAxis
            yAxisId="voltage"
            domain={yLeftDomain}
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
          <YAxis
            yAxisId="flow"
            orientation="right"
            domain={yRightDomain}
            allowDataOverflow
            stroke="oklch(var(--muted-foreground))"
            tick={{ fill: 'oklch(var(--muted-foreground))', fontSize: 12 }}
            tickLine={{ stroke: 'oklch(var(--border))' }}
            label={{
              value: 'Flow Control (Pa)',
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
            formatter={(value: number, name: string) => {
              const labels: Record<string, string> = {
                fan1V: 'Fan 1 Voltage (V)',
                fan2V: 'Fan 2 Voltage (V)',
                fan3V: 'Fan 3 Voltage (V)',
                flowControlPa: 'Flow Control (Pa)',
              };
              const formattedValue = typeof value === 'number' && !isNaN(value)
                ? value.toFixed(2)
                : '0.00';
              return [formattedValue, labels[name] || name];
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
              const labels: Record<string, string> = {
                fan1V: 'Fan 1 Voltage (V)',
                fan2V: 'Fan 2 Voltage (V)',
                fan3V: 'Fan 3 Voltage (V)',
                flowControlPa: 'Flow Control (Pa)',
              };
              return labels[value] || value;
            }}
          />
          <Line
            yAxisId="voltage"
            type="monotone"
            dataKey="fan1V"
            name="fan1V"
            stroke="oklch(var(--chart-fan1))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6, fill: 'oklch(var(--chart-fan1))' }}
            isAnimationActive={false}
          />
          <Line
            yAxisId="voltage"
            type="monotone"
            dataKey="fan2V"
            name="fan2V"
            stroke="oklch(var(--chart-fan2))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6, fill: 'oklch(var(--chart-fan2))' }}
            isAnimationActive={false}
          />
          <Line
            yAxisId="voltage"
            type="monotone"
            dataKey="fan3V"
            name="fan3V"
            stroke="oklch(var(--chart-fan3))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6, fill: 'oklch(var(--chart-fan3))' }}
            isAnimationActive={false}
          />
          <Line
            yAxisId="flow"
            type="monotone"
            dataKey="flowControlPa"
            name="flowControlPa"
            stroke="oklch(var(--chart-ventilation))"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            activeDot={{ r: 6, fill: 'oklch(var(--chart-ventilation))' }}
            isAnimationActive={false}
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
      {(zoomedYLeftBottom !== null || (startIndex > 0 || endIndex < data.length - 1)) && (
        <p className="text-xs text-muted-foreground text-center mt-1">
          💡 Drag on the chart to zoom in · Use the brush below to pan · Reset Zoom to restore
        </p>
      )}
    </div>
  );
}
