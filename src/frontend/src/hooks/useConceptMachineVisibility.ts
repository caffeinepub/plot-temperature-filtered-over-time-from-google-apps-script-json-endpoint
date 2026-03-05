import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActor } from "./useActor";

/**
 * Hook to fetch the ConceptMachine page visibility status from the backend.
 * Returns the current visibility boolean and loading state.
 */
export function useConceptMachineVisibility() {
  const { actor, isFetching: actorFetching } = useActor();

  const query = useQuery<boolean>({
    queryKey: ["conceptMachineVisibility"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.isConceptMachineVisible();
    },
    enabled: !!actor && !actorFetching,
    retry: false,
    staleTime: 10000, // Cache for 10 seconds
  });

  return {
    isVisible: query.data ?? true, // Default to visible
    isLoading: actorFetching || query.isLoading,
    isFetched: !!actor && query.isFetched,
    error: query.error,
  };
}

/**
 * Mutation hook to update the ConceptMachine page visibility status.
 * Only admins can call this method.
 */
export function useSetConceptMachineVisibility() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (visible: boolean) => {
      if (!actor) throw new Error("Actor not available");

      try {
        await actor.setConceptMachineVisible(visible);
      } catch (error: any) {
        // Map backend errors to user-friendly messages
        if (error.message?.includes("Unauthorized")) {
          throw new Error("You do not have permission to change this setting");
        }
        if (error.message?.includes("trap")) {
          throw new Error("Backend error: Unable to update visibility setting");
        }
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate the visibility query to trigger a refetch
      queryClient.invalidateQueries({ queryKey: ["conceptMachineVisibility"] });
      queryClient.refetchQueries({ queryKey: ["conceptMachineVisibility"] });
    },
  });
}
