import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActor } from "./useActor";
import { useIsCallerAdmin } from "./useIsCallerAdmin";

/**
 * Fetches all sensor labels from the backend.
 * Only fetches when the caller is confirmed as an admin.
 * Returns a Map of sensor number (number) to label string.
 */
export function useSensorLabels() {
  const { actor, isFetching: actorFetching } = useActor();
  const { isAdmin, isConfirmed } = useIsCallerAdmin();

  return useQuery<Map<number, string>>({
    queryKey: ["sensorLabels"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      const entries = await actor.getAllSensorLabels();
      const map = new Map<number, string>();
      for (const [num, label] of entries) {
        map.set(Number(num), label);
      }
      return map;
    },
    enabled: !!actor && !actorFetching && isConfirmed && isAdmin,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/**
 * Mutation hook to save a label for a given sensor number.
 * Invalidates the sensorLabels query on success.
 */
export function useSetSensorLabel() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sensorNum,
      label,
    }: { sensorNum: number; label: string }) => {
      if (!actor) throw new Error("Actor not available");
      await actor.setSensorLabel(BigInt(sensorNum), label);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sensorLabels"] });
    },
  });
}

/**
 * Mutation hook to reset all sensor labels.
 */
export function useResetSensorLabels() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Actor not available");
      await actor.resetSensorLabels();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sensorLabels"] });
    },
  });
}
