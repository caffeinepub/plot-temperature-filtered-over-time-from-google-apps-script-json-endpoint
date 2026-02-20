import { useMemo, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts';
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
}

// Generate colors for 72 sensors using HSL color space for better distribution
const generateSensorColors = (count: number): string[] => {
  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    const hue = (i * 360) / count;
    const saturation = 60 + (i % 3) * 15; // Vary saturation
    const lightness = 45 + (i % 4) * 10; // Vary lightness
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
  onToggleSensor
}: TSICSensorChartProps) {
  const chartData = useMemo(() => {
    return data.map((point) => {
      const dataPoint: any = {
        timestamp: point.timestamp.getTime(),
        timeLabel: format(point.timestamp, 'HH:mm:ss'),
        fullTimestamp: format(point.timestamp, 'yyyy-MM-dd HH:mm:ss'),
      };
      
      // Add all 72 sensor values
      for (let i = 1; i <= 72; i++) {
        dataPoint[`S${i}`] = point.sensors[`S${i}`];
      }
      
      return dataPoint;
    });
  }, [data]);

  const handleBrushChange = useCallback((range: { startIndex?: number; endIndex?: number }) => {
    if (range.startIndex !== undefined && range.endIndex !== undefined) {
      onRangeChange(range.startIndex, range.endIndex);
    }
  }, [onRangeChange]);

  // Filter out sensors that are all zeros to reduce clutter
  const activeSensors = useMemo(() => {
    const active: string[] = [];
    for (let i = 1; i <= 72; i++) {
      const sensorKey = `S${i}`;
      const hasNonZeroValue = data.some(point => point.sensors[sensorKey] !== 0);
      if (hasNonZeroValue) {
        active.push(sensorKey);
      }
    }
    return active;
  }, [data]);

  // Custom legend with checkboxes
  const renderCustomLegend = (props: any) => {
    const { payload } = props;
    
    return (
      <div className="flex flex-wrap gap-3 justify-center px-4 py-2 max-h-[200px] overflow-y-auto">
        {payload.map((entry: any, index: number) => {
          const sensorKey = entry.value;
          const isVisible = sensorVisibility[sensorKey];
          
          return (
            <div
              key={`legend-${index}`}
              className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 px-2 py-1 rounded"
              onClick={() => onToggleSensor(sensorKey)}
            >
              <Checkbox
                checked={isVisible}
                onCheckedChange={() => onToggleSensor(sensorKey)}
                className="h-4 w-4"
              />
              <div
                className="w-4 h-0.5"
                style={{ backgroundColor: entry.color }}
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

  // Determine Y-axis domain
  const yAxisDomain = useMemo(() => {
    const min = yAxisMin ?? 'auto';
    const max = yAxisMax ?? 'auto';
    return [min, max];
  }, [yAxisMin, yAxisMax]);

  return (
    <div className="w-full h-[600px]">
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
            domain={yAxisDomain as any}
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
          {/* Render lines for active and visible sensors only */}
          {activeSensors.filter(sensorKey => sensorVisibility[sensorKey]).map((sensorKey) => {
            const sensorNumber = parseInt(sensorKey.substring(1));
            return (
              <Line
                key={sensorKey}
                type="monotone"
                dataKey={sensorKey}
                name={sensorKey}
                stroke={sensorColors[sensorNumber - 1]}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4 }}
              />
            );
          })}
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
          Showing {activeSensors.filter(s => sensorVisibility[s]).length} of {activeSensors.length} active sensors (sensors with all zero values are hidden)
        </p>
      )}
    </div>
  );
}
