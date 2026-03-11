import type { TSICDataPoint } from "@/lib/tsicDataParsing";
import { fetchTSICData } from "@/lib/tsicDataSource";
import { useQuery } from "@tanstack/react-query";

// Auto-refresh interval: 10 minutes
const AUTO_REFRESH_INTERVAL = 10 * 60 * 1000;

export function useTSICData(id: number | null) {
  const query = useQuery<TSICDataPoint[], Error>({
    queryKey: ["tsic-data", id],
    queryFn: () => {
      if (id === null) {
        throw new Error("No ID selected");
      }
      return fetchTSICData(id);
    },
    enabled: id !== null,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    staleTime: AUTO_REFRESH_INTERVAL,
    refetchInterval: AUTO_REFRESH_INTERVAL,
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
