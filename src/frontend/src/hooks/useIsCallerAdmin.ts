import { useQuery } from "@tanstack/react-query";
import { useActor } from "./useActor";

/**
 * Dedicated hook to determine if the current caller is an admin.
 * This is the source of truth for admin status and defaults to non-admin on any error.
 */
export function useIsCallerAdmin() {
  const { actor, isFetching: actorFetching } = useActor();

  const query = useQuery<boolean>({
    queryKey: ["isCallerAdmin"],
    queryFn: async () => {
      if (!actor) return false;
      try {
        return await actor.isCallerAdmin();
      } catch (error: any) {
        // Any authorization error means not admin
        console.error("Admin check failed:", error);
        return false;
      }
    },
    enabled: !!actor && !actorFetching,
    retry: false,
    staleTime: 30000, // Cache for 30 seconds
  });

  return {
    isAdmin: query.data ?? false,
    isLoading: actorFetching || query.isLoading,
    isConfirmed: !!actor && query.isFetched,
    error: query.error,
  };
}
