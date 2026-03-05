import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActor } from "./useActor";
import { useIsCallerAdmin } from "./useIsCallerAdmin";

/**
 * Fetches all TSIC logger ID labels from the backend.
 * Only fetches when the caller is confirmed as an admin.
 * Returns a Map of logger ID (number) to label string.
 */
export function useTSICLabels() {
  const { actor, isFetching: actorFetching } = useActor();
  const { isAdmin, isConfirmed } = useIsCallerAdmin();

  return useQuery<Map<number, string>>({
    queryKey: ["tsicLoggerLabels"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      const entries = await actor.getAllLoggerLabels();
      const map = new Map<number, string>();
      for (const [id, label] of entries) {
        map.set(Number(id), label);
      }
      return map;
    },
    enabled: !!actor && !actorFetching && isConfirmed && isAdmin,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/**
 * Mutation hook to save a label for a given TSIC logger ID.
 * Invalidates the labels query on success.
 */
export function useSetLoggerLabel() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, label }: { id: number; label: string }) => {
      if (!actor) throw new Error("Actor not available");
      await actor.setLoggerIdLabel(BigInt(id), label);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tsicLoggerLabels"] });
    },
  });
}
