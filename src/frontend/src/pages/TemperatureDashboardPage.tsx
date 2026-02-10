import { RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TemperatureChart } from '@/components/TemperatureChart';
import { useTemperatureSeries } from '@/hooks/useTemperatureSeries';
import { format } from 'date-fns';

export function TemperatureDashboardPage() {
  const { data, isLoading, isError, error, isRefetching, refetch, lastUpdated } = useTemperatureSeries();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b-4 border-[#65714B] bg-card shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <img 
                src="/assets/2026-02-10_10-54-59-1.jpg" 
                alt="Conceptmachine Logo" 
                className="h-12 w-12 object-contain"
              />
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                  Conceptmachine Live Data
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Updated every 10 min
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {lastUpdated && (
                <div className="text-sm text-muted-foreground">
                  Last updated: {format(lastUpdated, 'HH:mm:ss')}
                </div>
              )}
              <Button
                onClick={() => refetch()}
                disabled={isLoading || isRefetching}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
                {isRefetching ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {isLoading && !data && (
          <Card>
            <CardContent className="flex items-center justify-center py-16">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Loading temperature data...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error Loading Data</AlertTitle>
            <AlertDescription className="mt-2">
              {error instanceof Error ? error.message : 'Failed to fetch temperature data'}
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
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Data Available</AlertTitle>
            <AlertDescription>
              No valid data points to display. Please check the data source.
            </AlertDescription>
          </Alert>
        )}

        {data && data.length > 0 && (
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Temperature Over Time</span>
                {isRefetching && (
                  <span className="text-sm font-normal text-muted-foreground flex items-center gap-2">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Refreshing...
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TemperatureChart data={data} />
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-16">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center text-sm text-muted-foreground">
            Built by Hannes @Petersime
          </div>
        </div>
      </footer>
    </div>
  );
}
