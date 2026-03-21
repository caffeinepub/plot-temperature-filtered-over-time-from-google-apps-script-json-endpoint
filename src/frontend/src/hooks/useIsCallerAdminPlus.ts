import { useQuery } from "@tanstack/react-query";
import { useActor } from "./useActor";

export function useIsCallerAdminPlus() {
  const { actor, isFetching: actorFetching } = useActor();

  const query = useQuery<boolean>({
    queryKey: ["isCallerAdminPlus"],
    queryFn: async () => {
      if (!actor) return false;
      try {
        // Cast to any since backend.ts may lag behind backend.d.ts
        return await (actor as any).isCallerAdminPlus();
      } catch (error: any) {
        console.error("Admin+ check failed:", error);
        return false;
      }
    },
    enabled: !!actor && !actorFetching,
    retry: false,
    staleTime: 30000,
  });

  return {
    isAdminPlus: query.data ?? false,
    isLoading: actorFetching || query.isLoading,
    isConfirmed: !!actor && query.isFetched,
  };
}
