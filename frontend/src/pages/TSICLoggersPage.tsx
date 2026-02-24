import { RefreshCw, AlertCircle, RotateCcw, Calendar } from 'lucide-react';
import { useState, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DashboardCard } from '@/components/DashboardCard';
import { TSICSensorChart } from '@/components/TSICSensorChart';
import { useTSICData } from '@/hooks/useTSICData';
import { useSyncedTimeWindow } from '@/hooks/useSyncedTimeWindow';
import { format } from 'date-fns';

export function TSICLoggersPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { data, isLoading, isError, error, isRefetching, refetch } = useTSICData(selectedId);
  const { visibleRange, setRange, resetZoom, isZoomed } = useSyncedTimeWindow(data?.length || 0);
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Y-axis controls (reset to null for automatic scaling on page refresh)
  const [yAxisMin, setYAxisMin] = useState<number | null>(null);
  const [yAxisMax, setYAxisMax] = useState<number | null>(null);
  
  // Sensor visibility state (all sensors enabled by default)
  const [sensorVisibility, setSensorVisibility] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (let i = 1; i <= 72; i++) {
      initial[`S${i}`] = true;
    }
    return initial;
  });

  // Track data length to detect when new data is loaded
  const prevDataLengthRef = useRef<number>(0);

  // Reset states when new data is loaded
  const handleResetStates = useCallback(() => {
    const currentDataLength = data?.length || 0;
    
    // Only reset if data length changed (new data loaded)
    if (currentDataLength > 0 && currentDataLength !== prevDataLengthRef.current) {
      prevDataLengthRef.current = currentDataLength;
      
      // Reset Y-axis controls
      setYAxisMin(null);
      setYAxisMax(null);
      
      // Reset sensor visibility to all enabled
      const resetVisibility: Record<string, boolean> = {};
      for (let i = 1; i <= 72; i++) {
        resetVisibility[`S${i}`] = true;
      }
      setSensorVisibility(resetVisibility);
    }
  }, [data?.length]);

  // Calculate date range indices
  const dateRangeIndices = useMemo(() => {
    if (!data || !startDate || !endDate) return null;

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
    if (start > end) return null;

    // Set end date to end of day for inclusive range
    end.setHours(23, 59, 59, 999);

    // Find indices
    let startIndex = -1;
    let endIndex = -1;

    for (let i = 0; i < data.length; i++) {
      const pointTime = data[i].timestamp.getTime();
      if (startIndex === -1 && pointTime >= start.getTime()) {
        startIndex = i;
      }
      if (pointTime <= end.getTime()) {
        endIndex = i;
      }
    }

    // Check if we found any data in range
    if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) {
      return { startIndex: -1, endIndex: -1, isEmpty: true };
    }

    return { startIndex, endIndex, isEmpty: false };
  }, [data, startDate, endDate]);

  // Apply date range zoom when indices change
  useMemo(() => {
    if (dateRangeIndices && !dateRangeIndices.isEmpty) {
      setRange(dateRangeIndices.startIndex, dateRangeIndices.endIndex);
    }
  }, [dateRangeIndices, setRange]);

  const handleResetZoom = () => {
    resetZoom();
    setStartDate('');
    setEndDate('');
  };

  const handleIdClick = (id: number) => {
    setSelectedId(id);
    // Reset zoom and date filters when switching IDs
    resetZoom();
    setStartDate('');
    setEndDate('');
    // Reset Y-axis controls
    setYAxisMin(null);
    setYAxisMax(null);
    // Reset sensor visibility to all enabled
    const resetVisibility: Record<string, boolean> = {};
    for (let i = 1; i <= 72; i++) {
      resetVisibility[`S${i}`] = true;
    }
    setSensorVisibility(resetVisibility);
    // Reset data length tracker
    prevDataLengthRef.current = 0;
  };

  const handleToggleSensor = (sensorKey: string) => {
    setSensorVisibility(prev => ({
      ...prev,
      [sensorKey]: !prev[sensorKey]
    }));
  };

  const refreshingIndicator = isRefetching ? (
    <span className="text-sm font-normal text-muted-foreground flex items-center gap-2">
      <RefreshCw className="h-3 w-3 animate-spin" />
      Refreshing...
    </span>
  ) : null;

  // Get min and max dates from data for input constraints
  const dateConstraints = useMemo(() => {
    if (!data || data.length === 0) return null;
    const minDate = format(data[0].timestamp, 'yyyy-MM-dd');
    const maxDate = format(data[data.length - 1].timestamp, 'yyyy-MM-dd');
    return { minDate, maxDate };
  }, [data]);

  return (
    <main className="container mx-auto px-6 py-8 space-y-6">
      {/* ID Selection Buttons */}
      <Card className="shadow-lg">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Select Logger ID</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((id) => (
                <Button
                  key={id}
                  onClick={() => handleIdClick(id)}
                  variant={selectedId === id ? 'default' : 'outline'}
                  className="w-full"
                  disabled={isLoading}
                >
                  ID {id}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && selectedId !== null && (
        <Card className="shadow-lg p-0 overflow-hidden">
          <CardContent className="flex items-center justify-center py-16">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Loading data for ID {selectedId}...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {isError && selectedId !== null && (
        <Alert variant="destructive" className="shadow-lg">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Data</AlertTitle>
          <AlertDescription className="mt-2">
            {error instanceof Error ? error.message : 'Failed to fetch data'}
            <Button
              onClick={() => refetch()}
              variant="outline"
              size="sm"
              className="mt-3"
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* No ID Selected */}
      {selectedId === null && (
        <Card className="shadow-lg">
          <CardContent className="flex items-center justify-center py-16">
            <div className="text-center text-muted-foreground">
              <p className="text-lg">Please select a logger ID to view sensor data</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Data Available */}
      {data && data.length === 0 && !isLoading && selectedId !== null && (
        <Alert className="shadow-lg">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Data Available</AlertTitle>
          <AlertDescription>
            No valid data points to display for ID {selectedId}. Please check the data source.
          </AlertDescription>
        </Alert>
      )}

      {/* Data Display */}
      {data && data.length > 0 && selectedId !== null && (
        <>
          {/* Date Range Filter */}
          <Card className="shadow-lg">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="start-date" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Start Date
                  </Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    min={dateConstraints?.minDate}
                    max={dateConstraints?.maxDate}
                    className="w-full"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <Label htmlFor="end-date" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    End Date
                  </Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={dateConstraints?.minDate}
                    max={dateConstraints?.maxDate}
                    className="w-full"
                  />
                </div>
                {(isZoomed || startDate || endDate) && (
                  <Button
                    onClick={handleResetZoom}
                    variant="outline"
                    size="default"
                    className="gap-2 whitespace-nowrap"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset Zoom
                  </Button>
                )}
              </div>
              {dateRangeIndices?.isEmpty && (
                <Alert className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>No Data in Selected Range</AlertTitle>
                  <AlertDescription>
                    There are no data points between the selected start and end dates. Please choose a different date range.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Y-Axis Controls */}
          <Card className="shadow-lg">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="y-axis-min">Y-Axis Minimum</Label>
                  <Input
                    id="y-axis-min"
                    type="number"
                    placeholder="Auto"
                    value={yAxisMin ?? ''}
                    onChange={(e) => setYAxisMin(e.target.value ? parseFloat(e.target.value) : null)}
                    className="w-full"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <Label htmlFor="y-axis-max">Y-Axis Maximum</Label>
                  <Input
                    id="y-axis-max"
                    type="number"
                    placeholder="Auto"
                    value={yAxisMax ?? ''}
                    onChange={(e) => setYAxisMax(e.target.value ? parseFloat(e.target.value) : null)}
                    className="w-full"
                  />
                </div>
                {(yAxisMin !== null || yAxisMax !== null) && (
                  <Button
                    onClick={() => {
                      setYAxisMin(null);
                      setYAxisMax(null);
                    }}
                    variant="outline"
                    size="default"
                    className="gap-2 whitespace-nowrap"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset Y-Axis
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Chart */}
          <DashboardCard
            title={`TSIC Logger ${selectedId} - All sensor readings over time`}
            headerAction={refreshingIndicator}
          >
            <TSICSensorChart
              data={data}
              startIndex={visibleRange.startIndex}
              endIndex={visibleRange.endIndex}
              onRangeChange={setRange}
              yAxisMin={yAxisMin}
              yAxisMax={yAxisMax}
              sensorVisibility={sensorVisibility}
              onToggleSensor={handleToggleSensor}
              onResetStates={handleResetStates}
            />
          </DashboardCard>
        </>
      )}
    </main>
  );
}
