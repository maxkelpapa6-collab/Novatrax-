import { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { COUNTRIES } from "@/lib/countries";
import { useToast } from "@/components/ui/use-toast";
import { Mail, Send, Users, Loader2, History } from "lucide-react";

const AUDIENCES = [
  { id: "all", label: "Tous les membres" },
  { id: "active", label: "Membres actifs uniquement" },
  { id: "country", label: "Par pays" },
];

const STATUS_LABELS = {
  sent: "Envoyée",
  sending: "En cours",
  partial: "Partielle",
  failed: "Échec",
};

// Section admin : envoyer un message aux membres — e-mail (avec logo NOVATRAX)
// + notification dans la boîte de réception de chaque destinataire.
export default function MessagesAdmin() {
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [audienceType, setAudienceType] = useState("all");
  const [country, setCountry] = useState("");
  const [count, setCount] = useState(null);
  const [counting, setCounting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const audience =
    audienceType === "country" ? { type: "country", country: country || undefined } : { type: audienceType };

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const page = await base44.entities.EmailCampaign.filter({}, { sort: "-created_date", limit: 5 });
      setHistory(page.items || (Array.isArray(page) ? page : []));
    } catch (e) {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleError = (e) => {
    const msg = e?.response?.data?.error || e?.response?.data?.message || e?.message || "Une erreur est survenue.";
    toast({ title: "Erreur", description: msg, variant: "destructive" });
  };

  const countRecipients = async () => {
    setCounting(true);
    try {
      const res = await base44.functions.invoke("adminEmailCampaign", { action: "count", audience });
      setCount(res.data?.count ?? 0);
    } catch (e) {
      handleError(e);
    } finally {
      setCounting(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      await base44.functions.invoke("adminEmailCampaign", {
        action: "test",
        subject,
        body_text: message,
      });
      toast({
        title: "E-mail de test envoyé",
        description: "Vérifiez votre boîte e-mail : le message porte le logo NOVATRAX.",
      });
    } catch (e) {
      handleError(e);
    } finally {
      setTesting(false);
    }
  };

  const sendAll = async () => {
    setSending(true);
    try {
      const res = await base44.functions.invoke("adminEmailCampaign", {
        action: "send",
        subject,
        body_text: message,
        audience,
        confirm: true,
      });
      toast({
        title: "Message envoyé",
        description:
          res.data?.sent_count !== undefined
            ? `${res.data.sent_count} e-mail(s) envoyé(s), ${res.data.inbox_count ?? res.data.recipients} notification(s) en boîte de réception.`
            : "Le message a été envoyé aux membres concernés.",
      });
      setSubject("");
      setMessage("");
      setConfirmSend(false);
      setCount(null);
      loadHistory();
    } catch (e) {
      handleError(e);
    } finally {
      setSending(false);
    }
  };

  const canSubmit = subject.trim().length > 0 && message.trim().length > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Formulaire d'envoi */}
      <div className="lg:col-span-3 rounded-2xl border border-border bg-card shadow-card p-5 sm:p-6">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl gradient-novatrax text-white">
            <Mail className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-heading text-lg font-bold">Message aux membres</h2>
            <p className="text-sm text-muted-foreground">E-mail avec logo + notification dans leur boîte de réception.</p>
          </div>
        </div>

        <label className="mt-5 block text-sm font-semibold">Objet du message</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Ex. Nouvelle formation disponible"
          className="mt-1.5 w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-primary"
        />

        <label className="mt-4 block text-sm font-semibold">Contenu du message</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={7}
          placeholder="Rédigez votre message… (les sauts de ligne sont conservés)"
          className="mt-1.5 w-full resize-y rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-primary"
        />

        <label className="mt-4 block text-sm font-semibold">Destinataires</label>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
          {AUDIENCES.map((a) => (
            <button
              key={a.id}
              onClick={() => setAudienceType(a.id)}
              className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                audienceType === a.id
                  ? "border-violet bg-violet/10 text-violet"
                  : "border-border text-foreground hover:bg-muted"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
        {audienceType === "country" && (
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="mt-2 w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-primary bg-card"
          >
            <option value="">Choisir un pays…</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={countRecipients}
            disabled={counting || (audienceType === "country" && !country)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-50"
          >
            {counting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
            Compter les destinataires
          </button>
          {count !== null && (
            <span className="rounded-full bg-violet/10 px-3 py-1.5 text-sm font-semibold text-violet">
              {count} membre{count > 1 ? "s" : ""} concerné{count > 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="mt-5 border-t border-border pt-5">
          <button
            onClick={sendTest}
            disabled={testing || !canSubmit}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-50"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            M'envoyer un e-mail de test
          </button>

          <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={confirmSend}
              onChange={(e) => setConfirmSend(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#6C63FF]"
            />
            <span className="text-muted-foreground">
              Je confirme l'envoi du message à {count !== null ? `${count} ` : "tous les "}
              destinataires sélectionnés (e-mail + boîte de réception).
            </span>
          </label>
          <button
            onClick={sendAll}
            disabled={sending || !canSubmit || !confirmSend || (audienceType === "country" && !country)}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl gradient-novatrax px-4 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Envoyer le message
          </button>
        </div>
      </div>

      {/* Historique récent */}
      <div className="lg:col-span-2 rounded-2xl border border-border bg-card shadow-card p-5 sm:p-6">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <History className="h-5 w-5" />
          </span>
          <h2 className="font-heading text-lg font-bold">Derniers envois</h2>
        </div>
        {historyLoading ? (
          <div className="mt-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Aucun message envoyé pour le moment.</p>
        ) : (
          <div className="mt-4 space-y-2.5">
            {history.map((c) => {
              const status = STATUS_LABELS[c.status] || c.status;
              return (
                <div key={c.id} className="rounded-xl border border-border p-3.5">
                  <p className="truncate text-sm font-semibold">{c.subject}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.recipients_count ?? 0} destinataire{(c.recipients_count ?? 0) > 1 ? "s" : ""} •{" "}
                    {c.sent_count ?? 0} envoyé{(c.sent_count ?? 0) > 1 ? "s" : ""} •{" "}
                    <span className={c.status === "failed" ? "font-semibold text-destructive" : "font-semibold text-emerald-600"}>
                      {status}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                    {c.created_date ? new Date(c.created_date).toLocaleString("fr-FR") : ""}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}