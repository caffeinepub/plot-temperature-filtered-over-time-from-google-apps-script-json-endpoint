import type { UserProfileInfo } from "@/backend";
import { useQuery } from "@tanstack/react-query";
import { useActor } from "./useActor";

export function useCurrentUserProfile() {
  const { actor, isFetching: actorFetching } = useActor();

  const query = useQuery<UserProfileInfo | null>({
    queryKey: ["currentUserProfile"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      try {
        return await actor.getCallerUserProfile();
      } catch (error: any) {
        // Handle authorization errors gracefully
        if (error.message?.includes("Unauthorized")) {
          console.error("Profile fetch unauthorized:", error);
          return null;
        }
        throw error;
      }
    },
    enabled: !!actor && !actorFetching,
    retry: false,
  });

  // Return custom state that properly reflects actor dependency
  return {
    userProfile: query.data,
    isLoading: actorFetching || query.isLoading,
    isFetched: !!actor && query.isFetched,
    error: query.error,
  };
}
