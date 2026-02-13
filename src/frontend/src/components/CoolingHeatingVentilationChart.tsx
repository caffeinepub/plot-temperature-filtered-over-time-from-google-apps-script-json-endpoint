import { useMemo, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts';
import { format } from 'date-fns';
import type { TemperatureDataPoint } from '@/lib/temperatureParsing';

interface CoolingHeatingVentilationChartProps {
  data: TemperatureDataPoint[];
  startIndex: number;
  endIndex: number;
  onRangeChange: (startIndex: number, endIndex: number) => void;
}

export function CoolingHeatingVentilationChart({ data, startIndex, endIndex, onRangeChange }: CoolingHeatingVentilationChartProps) {
  const chartData = useMemo(() => {
    return data.map((point) => {
      // Apply scaling formulas
      // Cooling: (V - 3.0) / 7.0 * 100.0
      const coolingPercent = point.coolingV !== null 
        ? ((point.coolingV - 3.0) / 7.0) * 100.0 
        : null;
      
      // Heating: V * 10.0
      const heatingPercent = point.heatingPwm !== null 
        ? point.heatingPwm * 10.0 
        : null;
      
      // Ventilation: (V - 2.0) / 8.0 * 100.0
      const ventilationPercent = point.ventilationV !== null 
        ? ((point.ventilationV - 2.0) / 8.0) * 100.0 
        : null;

      return {
        timestamp: point.timestamp.getTime(),
        coolingPercent,
        heatingPercent,
        ventilationPercent,
        timeLabel: format(point.timestamp, 'HH:mm:ss'),
        fullTimestamp: format(point.timestamp, 'yyyy-MM-dd HH:mm:ss'),
      };
    });
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
            domain={[0, 100]}
            stroke="oklch(var(--muted-foreground))"
            tick={{ fill: 'oklch(var(--muted-foreground))', fontSize: 12 }}
            tickLine={{ stroke: 'oklch(var(--border))' }}
            label={{
              value: 'Percentage (%)',
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
            formatter={(value: any, name: string) => {
              let label = '';
              if (name === 'coolingPercent') label = 'Cooling (%)';
              else if (name === 'heatingPercent') label = 'Heating (%)';
              else if (name === 'ventilationPercent') label = 'Ventilation (%)';
              
              const formattedValue = value !== null && typeof value === 'number' && !isNaN(value) 
                ? value.toFixed(2) 
                : 'N/A';
              return [`${formattedValue}%`, label];
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
              if (value === 'coolingPercent') return 'Cooling (%)';
              if (value === 'heatingPercent') return 'Heating (%)';
              if (value === 'ventilationPercent') return 'Ventilation (%)';
              return value;
            }}
          />
          <Line
            type="monotone"
            dataKey="coolingPercent"
            name="coolingPercent"
            stroke="oklch(var(--chart-cooling))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6, fill: 'oklch(var(--chart-cooling))' }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="heatingPercent"
            name="heatingPercent"
            stroke="oklch(var(--chart-heating))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6, fill: 'oklch(var(--chart-heating))' }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="ventilationPercent"
            name="ventilationPercent"
            stroke="oklch(var(--chart-ventilation))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6, fill: 'oklch(var(--chart-ventilation))' }}
            connectNulls
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
