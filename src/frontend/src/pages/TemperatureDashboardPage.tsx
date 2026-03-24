import { CO2Chart } from "@/components/CO2Chart";
import { CoolingHeatingVentilationChart } from "@/components/CoolingHeatingVentilationChart";
import { DashboardCard } from "@/components/DashboardCard";
import { FanVoltageFlowControlChart } from "@/components/FanVoltageFlowControlChart";
import { TemperatureChart } from "@/components/TemperatureChart";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSyncedTimeWindow } from "@/hooks/useSyncedTimeWindow";
import { useTemperatureSeries } from "@/hooks/useTemperatureSeries";
import { AlertCircle, RefreshCw } from "lucide-react";

export function TemperatureDashboardPage() {
  const { data, isLoading, isError, error, isRefetching, refetch } =
    useTemperatureSeries();
  const { visibleRange, setRange } = useSyncedTimeWindow(data?.length || 0);

  const refreshingIndicator = isRefetching ? (
    <span className="text-sm font-normal text-muted-foreground flex items-center gap-2">
      <RefreshCw className="h-3 w-3 animate-spin" />
      Refreshing...
    </span>
  ) : null;

  return (
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
            {error instanceof Error ? error.message : "Failed to fetch data"}
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
            title="CO\u2082 Levels Over Time"
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
  );
}
