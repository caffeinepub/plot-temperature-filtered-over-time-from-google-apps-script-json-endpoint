import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { fetchTemperatureData } from '@/lib/temperatureDataSource';
import type { TemperatureDataPoint } from '@/lib/temperatureParsing';

const REFETCH_INTERVAL = 10000; // 10 seconds

export function useTemperatureSeries() {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const query = useQuery<TemperatureDataPoint[], Error>({
    queryKey: ['temperature-series'],
    queryFn: fetchTemperatureData,
    refetchInterval: REFETCH_INTERVAL,
    refetchIntervalInBackground: true,
    staleTime: 5000,
  });

  useEffect(() => {
    if (query.isSuccess && query.data) {
      setLastUpdated(new Date());
    }
  }, [query.isSuccess, query.data]);

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isRefetching: query.isRefetching && !query.isLoading,
    refetch: query.refetch,
    lastUpdated,
  };
}
