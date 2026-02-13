import { useMemo, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts';
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

  const handleBrushChange = useCallback((range: { startIndex?: number; endIndex?: number }) => {
    if (range.startIndex !== undefined && range.endIndex !== undefined) {
      onRangeChange(range.startIndex, range.endIndex);
    }
  }, [onRangeChange]);

  return (
    <div className="w-full h-[450px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 60, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--border))" opacity={0.3} />
          <XAxis
            dataKey="timeLabel"
            stroke="oklch(var(--muted-foreground))"
            tick={{ fill: 'oklch(var(--muted-foreground))', fontSize: 12 }}
            tickLine={{ stroke: 'oklch(var(--border))' }}
          />
          {/* Left Y-axis for Voltage (0-10V) */}
          <YAxis
            yAxisId="left"
            domain={[0, 10]}
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
          {/* Right Y-axis for Pressure (0-1000Pa) */}
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 1000]}
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
              if (name === 'fan1V') {
                label = 'Fan 1';
                unit = 'V';
              } else if (name === 'fan2V') {
                label = 'Fan 2';
                unit = 'V';
              } else if (name === 'fan3V') {
                label = 'Fan 3';
                unit = 'V';
              } else if (name === 'flowControlPa') {
                label = 'Flow Control';
                unit = 'Pa';
              }
              
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
            stroke="oklch(0.40 0.18 250)"
            strokeWidth={2}
            dot={false}
            connectNulls
            name="fan3V"
          />
          {/* Flow control signal on right axis - uses CSS variable for dark mode visibility */}
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="flowControlPa"
            stroke="oklch(var(--chart-flow-control))"
            strokeWidth={2}
            dot={false}
            connectNulls
            name="flowControlPa"
          />
          <Brush
            dataKey="timeLabel"
            height={30}
            stroke="oklch(var(--primary))"
            fill="oklch(var(--muted))"
            startIndex={startIndex}
            endIndex={endIndex}
            onChange={handleBrushChange}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
