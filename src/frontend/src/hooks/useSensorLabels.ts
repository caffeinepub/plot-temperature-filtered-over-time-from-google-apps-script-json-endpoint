import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActor } from "./useActor";
import { useIsCallerAdmin } from "./useIsCallerAdmin";

/**
 * Fetches all sensor labels for a specific logger ID from the backend.
 * Only fetches when the caller is confirmed as an admin AND a loggerId is provided.
 * Returns a Map of sensor number (number) to label string.
 */
export function useSensorLabels(loggerId: number | null) {
  const { actor, isFetching: actorFetching } = useActor();
  const { isAdmin, isConfirmed } = useIsCallerAdmin();

  return useQuery<Map<number, string>>({
    queryKey: ["sensorLabels", loggerId],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      if (loggerId === null) return new Map<number, string>();
      const entries = await actor.getAllSensorLabelsForId(BigInt(loggerId));
      const map = new Map<number, string>();
      for (const [num, label] of entries) {
        map.set(Number(num), label);
      }
      return map;
    },
    enabled:
      !!actor && !actorFetching && isConfirmed && isAdmin && loggerId !== null,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/**
 * Mutation hook to save a label for a given sensor number within a logger ID.
 * Invalidates the sensorLabels query for that logger ID on success.
 */
export function useSetSensorLabel() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      loggerId,
      sensorNum,
      label,
    }: { loggerId: number; sensorNum: number; label: string }) => {
      if (!actor) throw new Error("Actor not available");
      await actor.setSensorLabel(BigInt(loggerId), BigInt(sensorNum), label);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["sensorLabels", variables.loggerId],
      });
    },
  });
}

/**
 * Mutation hook to reset all sensor labels for a specific logger ID.
 */
export function useResetSensorLabels() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ loggerId }: { loggerId: number }) => {
      if (!actor) throw new Error("Actor not available");
      await actor.resetSensorLabelsForId(BigInt(loggerId));
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["sensorLabels", variables.loggerId],
      });
    },
  });
}
