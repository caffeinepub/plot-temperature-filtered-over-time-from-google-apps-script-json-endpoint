import type { TSICDataPoint } from "@/lib/tsicDataParsing";
import { fetchTSICData } from "@/lib/tsicDataSource";
import { useQuery } from "@tanstack/react-query";

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
    staleTime: Number.POSITIVE_INFINITY,
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
