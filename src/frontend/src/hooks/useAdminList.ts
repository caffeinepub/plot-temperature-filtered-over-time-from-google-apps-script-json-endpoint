import { useQuery } from '@tanstack/react-query';
import { useActor } from './useActor';
import type { AdminInfo } from '@/backend';

export function useAdminList(enabled: boolean) {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<AdminInfo[]>({
    queryKey: ['adminList'],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      try {
        return await actor.getAllAdmins();
      } catch (error: any) {
        // Handle authorization errors gracefully
        if (error.message?.includes('Unauthorized')) {
          throw new Error('You do not have permission to view the admin list');
        }
        throw error;
      }
    },
    enabled: !!actor && !actorFetching && enabled,
    retry: false,
    staleTime: 30000, // Cache for 30 seconds
  });
}
