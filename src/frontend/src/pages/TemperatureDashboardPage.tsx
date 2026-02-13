import { RefreshCw, AlertCircle, Moon, Sun, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { DashboardCard } from '@/components/DashboardCard';
import { TemperatureChart } from '@/components/TemperatureChart';
import { CO2Chart } from '@/components/CO2Chart';
import { CoolingHeatingVentilationChart } from '@/components/CoolingHeatingVentilationChart';
import { FanVoltageFlowControlChart } from '@/components/FanVoltageFlowControlChart';
import { useTemperatureSeries } from '@/hooks/useTemperatureSeries';
import { useSyncedTimeWindow } from '@/hooks/useSyncedTimeWindow';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';

export function TemperatureDashboardPage() {
  const { data, isLoading, isError, error, isRefetching, refetch, lastUpdated } = useTemperatureSeries();
  const { visibleRange, setRange, resetZoom, isZoomed } = useSyncedTimeWindow(data?.length || 0);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const refreshingIndicator = isRefetching ? (
    <span className="text-sm font-normal text-muted-foreground flex items-center gap-2">
      <RefreshCw className="h-3 w-3 animate-spin" />
      Refreshing...
    </span>
  ) : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b-4 border-t-4 border-primary bg-card shadow-lg">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Conceptmachine Live Data
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                data logging • Updated every 10-20 min • Data older than 19 days is not retained
              </p>
            </div>
            <div className="flex items-center gap-3">
              {lastUpdated && (
                <div className="text-sm text-muted-foreground hidden sm:block">
                  Last updated: {format(lastUpdated, 'HH:mm:ss')}
                </div>
              )}
              <Button
                onClick={toggleTheme}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                <span className="hidden sm:inline">{isDarkMode ? 'Light' : 'Dark'}</span>
              </Button>
              <Button
                onClick={() => refetch()}
                disabled={isLoading || isRefetching}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isRefetching ? 'Refreshing...' : 'Refresh'}</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8 space-y-6">
        {isLoading && !data && (
          <Card className="shadow-lg p-0 overflow-hidden">
            <CardContent className="flex items-center justify-center py-16">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Loading data...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {isError && (
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

        {data && data.length === 0 && !isLoading && (
          <Alert className="shadow-lg">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Data Available</AlertTitle>
            <AlertDescription>
              No valid data points to display. Please check the data source.
            </AlertDescription>
          </Alert>
        )}

        {data && data.length > 0 && (
          <>
            {/* Zoom Controls */}
            {isZoomed && (
              <div className="flex justify-end">
                <Button
                  onClick={resetZoom}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset Zoom
                </Button>
              </div>
            )}

            {/* Temperature Chart */}
            <DashboardCard
              title="Temperature Over Time"
              headerAction={refreshingIndicator}
            >
              <TemperatureChart 
                data={data} 
                startIndex={visibleRange.startIndex}
                endIndex={visibleRange.endIndex}
                onRangeChange={setRange}
              />
            </DashboardCard>

            {/* CO2 Chart */}
            <DashboardCard
              title="CO₂ Levels Over Time"
              headerAction={refreshingIndicator}
            >
              <CO2Chart 
                data={data}
                startIndex={visibleRange.startIndex}
                endIndex={visibleRange.endIndex}
                onRangeChange={setRange}
              />
            </DashboardCard>

            {/* Cooling/Heating/Ventilation Chart */}
            <DashboardCard
              title="Cooling/Heating/Ventilation Over Time"
              headerAction={refreshingIndicator}
            >
              <CoolingHeatingVentilationChart 
                data={data}
                startIndex={visibleRange.startIndex}
                endIndex={visibleRange.endIndex}
                onRangeChange={setRange}
              />
            </DashboardCard>

            {/* Fan Voltage and Flow Control Chart */}
            <DashboardCard
              title="Fan Voltage & Flow Control Over Time"
              headerAction={refreshingIndicator}
            >
              <FanVoltageFlowControlChart 
                data={data}
                startIndex={visibleRange.startIndex}
                endIndex={visibleRange.endIndex}
                onRangeChange={setRange}
              />
            </DashboardCard>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-16">
        <div className="container mx-auto px-6 py-6">
          <div className="text-center text-sm text-muted-foreground">
            Built by Hannes
          </div>
        </div>
      </footer>
    </div>
  );
}
