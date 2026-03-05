import type { UserProfile } from "@/backend";
import { Principal } from "@icp-sdk/core/principal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useActor } from "./useActor";

export { useCurrentUserProfile } from "./useCurrentUserProfile";

export function useSaveUserProfile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: UserProfile) => {
      if (!actor) throw new Error("Actor not available");
      return actor.saveCallerUserProfile(profile);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUserProfile"] });
      queryClient.refetchQueries({ queryKey: ["currentUserProfile"] });
    },
  });
}

export function useGrantAdmin() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (principalString: string) => {
      if (!actor) throw new Error("Actor not available");

      // Parse and validate principal
      let principal: Principal;
      try {
        principal = Principal.fromText(principalString);
      } catch (_error) {
        throw new Error("Invalid principal ID format");
      }

      try {
        const result = await actor.grantAdminRole(principal);
        if (!result) {
          throw new Error("Failed to grant admin rights");
        }
        return result;
      } catch (error: any) {
        // Map backend errors to user-friendly messages
        if (error.message?.includes("Unauthorized")) {
          throw new Error("You do not have permission to grant admin rights");
        }
        if (error.message?.includes("trap")) {
          throw new Error("Backend error: Unable to grant admin rights");
        }
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate and refetch both queries to ensure UI updates
      queryClient.invalidateQueries({ queryKey: ["currentUserProfile"] });
      queryClient.invalidateQueries({ queryKey: ["adminList"] });

      // Force immediate refetch of admin list
      queryClient.refetchQueries({ queryKey: ["adminList"] });
    },
  });
}
