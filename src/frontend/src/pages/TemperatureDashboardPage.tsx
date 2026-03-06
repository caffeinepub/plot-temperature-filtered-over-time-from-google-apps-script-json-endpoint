import { CO2Chart } from "@/components/CO2Chart";
import { CoolingHeatingVentilationChart } from "@/components/CoolingHeatingVentilationChart";
import { DashboardCard } from "@/components/DashboardCard";
import { FanVoltageFlowControlChart } from "@/components/FanVoltageFlowControlChart";
import { TemperatureChart } from "@/components/TemperatureChart";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSyncedTimeWindow } from "@/hooks/useSyncedTimeWindow";
import { useTemperatureSeries } from "@/hooks/useTemperatureSeries";
import { AlertCircle, Calendar, RefreshCw, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

/**
 * Parse a date string typed as DD/MM/YYYY into a Date object.
 * Returns null if the input is not a valid complete date.
 */
function parseDDMMYYYY(value: string): Date | null {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10) - 1;
  const year = Number.parseInt(match[3], 10);
  const d = new Date(year, month, day);
  if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day)
    return null;
  return d;
}

export function TemperatureDashboardPage() {
  const { data, isLoading, isError, error, isRefetching, refetch } =
    useTemperatureSeries();
  const { visibleRange, setRange, resetZoom, isZoomed } = useSyncedTimeWindow(
    data?.length || 0,
  );

  // Raw text inputs from user (DD/MM/JJJJ)
  const [startDateText, setStartDateText] = useState("");
  const [endDateText, setEndDateText] = useState("");

  // Calculate date range indices
  const dateRangeIndices = useMemo(() => {
    const start = parseDDMMYYYY(startDateText);
    const end = parseDDMMYYYY(endDateText);
    if (!data || !start || !end) return null;
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
  }, [data, startDateText, endDateText]);

  // Apply date range zoom when indices change
  useMemo(() => {
    if (dateRangeIndices && !dateRangeIndices.isEmpty) {
      setRange(dateRangeIndices.startIndex, dateRangeIndices.endIndex);
    }
  }, [dateRangeIndices, setRange]);

  const handleResetZoom = () => {
    resetZoom();
    setStartDateText("");
    setEndDateText("");
  };

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
          {/* Date Range Filter */}
          <Card className="shadow-lg">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1 space-y-2">
                  <Label
                    htmlFor="start-date"
                    className="flex items-center gap-2"
                  >
                    <Calendar className="h-4 w-4" />
                    Start Date
                  </Label>
                  <Input
                    id="start-date"
                    type="text"
                    value={startDateText}
                    onChange={(e) => setStartDateText(e.target.value)}
                    placeholder="DD/MM/JJJJ"
                    maxLength={10}
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
                    type="text"
                    value={endDateText}
                    onChange={(e) => setEndDateText(e.target.value)}
                    placeholder="DD/MM/JJJJ"
                    maxLength={10}
                    className="w-full"
                  />
                </div>
                {(isZoomed || startDateText || endDateText) && (
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
                    There are no data points between the selected start and end
                    dates. Please choose a different date range.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

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
  );
}
