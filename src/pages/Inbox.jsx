import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/api/client";
import useUnreadInbox from "@/hooks/useUnreadInbox";
import { Inbox as InboxIcon, CheckCheck, ChevronDown, Loader2, RefreshCw } from "lucide-react";

const TYPE_LABELS = {
  admin_message: "Message de l'équipe",
  commission: "Commission",
  system: "Notification",
};

const TYPE_STYLES = {
  admin_message: "bg-primary/10 text-primary",
  commission: "bg-violet/10 text-violet",
  system: "bg-muted text-muted-foreground",
};

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Boîte de réception du membre : notifications de la plateforme et messages de l'équipe.
export default function Inbox() {
  const { user } = useAuth();
  const { unreadCount, refreshUnread } = useUnreadInbox(user?.id);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError("");
    try {
      const page = await api.entities.InboxMessage.filter(
        { user_id: user.id },
        { sort: "-created_date", limit: 30 }
      );
      const items = page.items || (Array.isArray(page) ? page : []);
      setMessages(items);
      setCursor(page.next_cursor || null);
      setHasMore(!!page.has_more);
    } catch (e) {
      setError("Impossible de charger vos messages. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = async () => {
    if (!cursor || moreLoading) return;
    setMoreLoading(true);
    try {
      const page = await api.entities.InboxMessage.filter(
        { user_id: user.id },
        { sort: "-created_date", limit: 30, cursor }
      );
      setMessages((prev) => [...prev, ...(page.items || [])]);
      setCursor(page.next_cursor || null);
      setHasMore(!!page.has_more);
    } catch (e) {
      // rien de plus à charger
    } finally {
      setMoreLoading(false);
    }
  };

  const toggle = async (m) => {
    if (openId === m.id) {
      setOpenId(null);
      return;
    }
    setOpenId(m.id);
    if (!m.read) {
      try {
        await api.entities.InboxMessage.update(m.id, { read: true, read_at: new Date().toISOString() });
        setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, read: true } : x)));
        refreshUnread();
      } catch (e) {
        // le message s'ouvre quand même ; la marque de lecture sera retentée
      }
    }
  };

  const markAllRead = async () => {
    if (unreadCount === 0) return;
    try {
      await api.entities.InboxMessage.updateMany(
        { user_id: user.id, read: false },
        { $set: { read: true, read_at: new Date().toISOString() } }
      );
      setMessages((prev) => prev.map((x) => ({ ...x, read: true })));
      refreshUnread();
    } catch (e) {
      // ignoré : le compteur se rafraîchira à la prochaine visite
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold">Boîte de réception</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vos notifications et les messages de l'équipe NOVATRAX.
            {unreadCount > 0 ? (
              <span className="ml-1 font-semibold text-violet">{unreadCount} non lu{unreadCount > 1 ? "s" : ""}</span>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border hover:bg-muted"
            aria-label="Actualiser"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold hover:bg-muted"
            >
              <CheckCheck className="h-4 w-4" /> Tout marquer comme lu
            </button>
          )}
        </div>
      </div>

      {error ? (
        <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
          {error}
        </div>
      ) : loading ? (
        <div className="mt-6 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-muted/50 animate-pulse" />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-10 text-center shadow-card">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-violet/10 text-violet">
            <InboxIcon className="h-7 w-7" />
          </span>
          <h2 className="mt-4 font-heading text-lg font-bold">Aucun message pour le moment</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Vos notifications et les annonces de l'équipe NOVATRAX apparaîtront ici.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {messages.map((m) => {
            const open = openId === m.id;
            const typeLabel = TYPE_LABELS[m.type] || TYPE_LABELS.system;
            const typeStyle = TYPE_STYLES[m.type] || TYPE_STYLES.system;
            return (
              <button
                key={m.id}
                onClick={() => toggle(m)}
                className={`block w-full rounded-2xl border p-4 sm:p-5 text-left shadow-card transition-all ${
                  open ? "border-violet/40 shadow-card-hover" : "border-border hover:shadow-card-hover"
                } ${!m.read ? "bg-violet/5" : "bg-card"}`}
              >
                <div className="flex items-start gap-3">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${m.read ? "bg-border" : "gradient-novatrax"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={`truncate text-sm sm:text-base ${m.read ? "font-semibold" : "font-bold"}`}>{m.title}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${typeStyle}`}>
                        {typeLabel}
                      </span>
                      {!m.read && <span className="text-[10px] font-bold uppercase text-violet">Nouveau</span>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(m.created_date)}</p>
                    {!open && (
                      <p className="mt-1.5 line-clamp-1 text-sm text-muted-foreground/80">{m.body_text}</p>
                    )}
                    {open && (
                      <p className="mt-3 whitespace-pre-line rounded-xl bg-muted/40 p-3.5 text-sm leading-relaxed">
                        {m.body_text}
                      </p>
                    )}
                  </div>
                  <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
                </div>
              </button>
            );
          })}
          {hasMore && (
            <button
              onClick={loadMore}
              disabled={moreLoading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold hover:bg-muted disabled:opacity-60"
            >
              {moreLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Charger plus de messages
            </button>
          )}
        </div>
      )}
    </div>
  );
}