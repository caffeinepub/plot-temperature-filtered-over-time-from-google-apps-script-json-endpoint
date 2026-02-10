import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import type { TemperatureDataPoint } from '@/lib/temperatureParsing';

interface TemperatureChartProps {
  data: TemperatureDataPoint[];
}

export function TemperatureChart({ data }: TemperatureChartProps) {
  const chartData = useMemo(() => {
    return data.map((point) => ({
      timestamp: point.timestamp.getTime(),
      temperatureFiltered: point.temperatureFiltered,
      temperatureCSV: point.temperatureCSV,
      timeLabel: format(point.timestamp, 'HH:mm:ss'),
    }));
  }, [data]);

  return (
    <div className="w-full h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--border))" opacity={0.3} />
          <XAxis
            dataKey="timeLabel"
            stroke="oklch(var(--muted-foreground))"
            tick={{ fill: 'oklch(var(--muted-foreground))', fontSize: 12 }}
            tickLine={{ stroke: 'oklch(var(--border))' }}
          />
          <YAxis
            domain={[70, 102]}
            stroke="oklch(var(--muted-foreground))"
            tick={{ fill: 'oklch(var(--muted-foreground))', fontSize: 12 }}
            tickLine={{ stroke: 'oklch(var(--border))' }}
            label={{
              value: 'Temperature (°F)',
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
              const label = name === 'temperatureFiltered' 
                ? 'Temperature Filtered (°F)' 
                : 'Temperature CSV (°F) - dashed';
              return [`${value.toFixed(2)}°F`, label];
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
              if (value === 'temperatureFiltered') return 'Temperature Filtered (°F)';
              if (value === 'temperatureCSV') return 'Temperature CSV (°F) - dashed';
              return value;
            }}
          />
          <Line
            type="monotone"
            dataKey="temperatureFiltered"
            name="temperatureFiltered"
            stroke="oklch(var(--chart-1))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6, fill: 'oklch(var(--chart-1))' }}
          />
          <Line
            type="monotone"
            dataKey="temperatureCSV"
            name="temperatureCSV"
            stroke="oklch(var(--chart-2))"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            activeDot={{ r: 6, fill: 'oklch(var(--chart-2))' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
