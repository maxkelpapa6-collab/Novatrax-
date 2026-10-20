import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";

export const MEMBER_HOME_KEY = "memberHome";

async function fetchMemberHome(includeMembers) {
  const res = await api.functions.invoke(
    "memberHome",
    includeMembers ? { include_members: true } : {}
  );
  return res.data;
}

// Un seul appel partagé entre l'accueil, le portefeuille et « Mon réseau » :
// naviguer entre ces pages ne relance plus les calculs côté serveur, ce qui
// évite de dépasser les quotas de la plateforme (« Rate limit exceeded »).
export function useMemberHome(includeMembers = false) {
  return useQuery({
    queryKey: [MEMBER_HOME_KEY, includeMembers],
    queryFn: () => fetchMemberHome(includeMembers),
    staleTime: 30000,
    retry: false,
  });
}

// Force le rafraîchissement après une opération qui change le solde ou le réseau
// (dépôt confirmé, retrait demandé, parrainage enregistré).
export function useInvalidateMemberHome() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [MEMBER_HOME_KEY] });
  }, [queryClient]);
}