import { useQuery } from "@tanstack/react-query";
import { useActor } from "./useActor";

export function useGoogleSheetsDownloadLink(enabled: boolean) {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<string>({
    queryKey: ["googleSheetsDownloadLink"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.getGoogleSheetsDownloadLink();
    },
    enabled: !!actor && !actorFetching && enabled,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY, // URL doesn't change, cache indefinitely
  });
}
