import { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

// Compteur de messages non lus pour la boîte de réception (badge de navigation).
// Mis à jour en temps réel via l'abonnement aux messages de l'utilisateur.
export default function useUnreadInbox(userId) {
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }
    try {
      const count = await base44.entities.InboxMessage.count({ user_id: userId, read: false });
      setUnreadCount(typeof count === "number" ? count : 0);
    } catch {
      setUnreadCount(0);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
    if (!userId) return undefined;
    let unsubscribe = null;
    try {
      unsubscribe = base44.entities.InboxMessage.subscribe(() => refresh());
    } catch {
      // pas d'abonnement temps réel : le compteur se rafraîchit à la navigation
    }
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [refresh]);

  return { unreadCount, refreshUnread: refresh };
}