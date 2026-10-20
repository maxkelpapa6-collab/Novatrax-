import { GraduationCap, Pencil, Trash2 } from "lucide-react";
import { Image } from "@/components/ui/image";

// Carte de formation au style vitrine : bande de couverture (ou pastel),
// photo de profil carrée agrandie en surimpression, titre et étiquette.
const PASTELS = ["bg-orange-100", "bg-blue-100", "bg-emerald-100", "bg-violet-100"];
const NEW_DAYS = 30;

export default function FormationCard({ formation, variant = 0, isAdmin, onEdit, onDelete }) {
  const f = formation;
  const isNew =
    f.created_date &&
    Date.now() - new Date(f.created_date).getTime() < NEW_DAYS * 24 * 60 * 60 * 1000;

  return (
    <article className="relative flex flex-col rounded-[20px] bg-card shadow-card hover:shadow-card-hover transition-all overflow-hidden">
      {isNew && f.published !== false && (
        <span className="absolute top-2 left-2 z-20 rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          Nouveau
        </span>
      )}
      {isAdmin && !f.published && (
        <span className="absolute top-2 left-2 z-20 rounded-md bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          Brouillon
        </span>
      )}

      {/* Bande de couverture ou pastel avec icône en filigrane */}
      <div className="relative h-20 overflow-hidden">
        {f.cover_image ? (
          <Image src={f.cover_image} fittingType="fill" className="h-full w-full" alt={f.title} />
        ) : (
          <div className={`flex h-full w-full items-center justify-center ${PASTELS[variant % PASTELS.length]}`}>
            <GraduationCap className="h-10 w-10 text-primary/25" strokeWidth={1.5} />
          </div>
        )}
      </div>

      {/* Photo de profil agrandie, en surimpression sur la bande */}
      <div className="relative z-10 -mt-12 flex justify-center">
        <div className="h-24 w-24 overflow-hidden rounded-2xl border-4 border-card shadow-card">
          {f.profile_image ? (
            <Image src={f.profile_image} fittingType="fill" className="h-full w-full" alt={f.title} />
          ) : (
            <div className={`flex h-full w-full items-center justify-center ${PASTELS[variant % PASTELS.length]}`}>
              <GraduationCap className="h-8 w-8 text-primary/50" />
            </div>
          )}
        </div>
      </div>

      {/* Titre + description */}
      <div className="px-3 pt-2 text-center">
        <h3 className="truncate text-sm font-bold text-foreground">{f.title}</h3>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/80">{f.description}</p>
      </div>

      {/* Étiquette de catégorie */}
      <div className="px-3 pt-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-primary">
          <GraduationCap className="h-3 w-3" /> Formation
        </span>
      </div>

      {/* Actions administrateur */}
      {isAdmin && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-border px-3 py-3">
          <button onClick={() => onEdit(f)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
            <Pencil className="h-3.5 w-3.5" /> Modifier
          </button>
          <button onClick={() => onDelete(f)} className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 text-destructive px-3 py-1.5 text-xs font-medium hover:bg-destructive/5">
            <Trash2 className="h-3.5 w-3.5" /> Supprimer
          </button>
        </div>
      )}
    </article>
  );
}