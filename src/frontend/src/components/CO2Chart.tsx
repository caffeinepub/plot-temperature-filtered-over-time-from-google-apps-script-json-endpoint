import { useMemo, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts';
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
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--border))" opacity={0.3} />
          <XAxis
            dataKey="timeLabel"
            stroke="oklch(var(--muted-foreground))"
            tick={{ fill: 'oklch(var(--muted-foreground))', fontSize: 12 }}
            tickLine={{ stroke: 'oklch(var(--border))' }}
          />
          <YAxis
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
            labelFormatter={(label) => `Time: ${label}`}
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
  );
}
