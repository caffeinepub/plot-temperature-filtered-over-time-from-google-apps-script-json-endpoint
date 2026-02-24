import { useQuery } from '@tanstack/react-query';
import { fetchTSICData } from '@/lib/tsicDataSource';
import type { TSICDataPoint } from '@/lib/tsicDataParsing';

export function useTSICData(id: number | null) {
  const query = useQuery<TSICDataPoint[], Error>({
    queryKey: ['tsic-data', id],
    queryFn: () => {
      if (id === null) {
        throw new Error('No ID selected');
      }
      return fetchTSICData(id);
    },
    enabled: id !== null,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    staleTime: Infinity,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isRefetching: query.isRefetching && !query.isLoading,
    refetch: query.refetch,
  };
}
