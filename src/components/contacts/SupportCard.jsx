import { Mail, MessageCircle, Lock } from "lucide-react";

// Bloc support affiché sous l'annuaire des membres
export default function SupportCard() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 pb-10">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl gradient-novatrax text-white">
            <Mail className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold">Support par e-mail</p>
            <a href="mailto:novatraxagencies@gmail.com" className="text-sm text-primary hover:underline break-all">
              novatraxagencies@gmail.com
            </a>
          </div>
        </div>
        <div className="mt-5 border-t border-border pt-5 flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
            <MessageCircle className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold">Chaîne WhatsApp officielle</p>
            <a
              href="https://whatsapp.com/channel/0029VbDVwrCFsn0WpqoTR63q"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              Rejoindre la chaîne WhatsApp de NOVATRAX
            </a>
            <p className="mt-1 text-xs text-muted-foreground">Annonces officielles et assistance de l'équipe.</p>
          </div>
        </div>
        <div className="mt-5 border-t border-border pt-5 flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Lock className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold text-sm">Vos données sont protégées</p>
            <p className="text-sm text-muted-foreground">
              Seuls les membres ayant accepté le partage de leurs coordonnées apparaissent dans l'annuaire, et l'accès
              au répertoire est réservé aux membres autorisés de NOVATRAX.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}