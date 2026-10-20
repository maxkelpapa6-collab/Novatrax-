import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { GraduationCap, Plus, BookOpen } from "lucide-react";
import FeatureLocked from "@/components/FeatureLocked";
import FormationCard from "@/components/formations/FormationCard";
import FormationForm from "@/components/formations/FormationForm";

export default function Formation() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [editing, setEditing] = useState(null); // formation or null
  const [showForm, setShowForm] = useState(false);

  // Membres : contenu servi par l'API protégée (verrouillage vérifié côté serveur,
  // uniquement après dépôt initial confirmé). Administrateurs : accès direct.
  const load = useCallback(async () => {
    setLoading(true);
    if (!isAdmin) {
      try {
        const res = await base44.functions.invoke("memberContent", {});
        if (res.data?.locked) setLocked(true);
        else setItems(res.data?.formations || []);
      } catch (e) {
        setItems([]);
      } finally {
        setLoading(false);
      }
      return;
    }
    try {
      const res = await base44.entities.Formation.filter({}, { sort: "-created_date", limit: 100 });
      setItems(res.items || []);
    } catch (e) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setShowForm(true); };
  const openEdit = (f) => { setEditing(f); setShowForm(true); };

  const onDelete = async (f) => {
    if (!confirm(`Supprimer la formation « ${f.title} » ?`)) return;
    try {
      await base44.entities.Formation.delete(f.id);
      setItems((prev) => prev.filter((i) => i.id !== f.id));
    } catch (e) {
      alert("Suppression impossible : " + (e?.message || "erreur"));
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-violet/10 px-3 py-1 text-xs font-semibold text-violet">
            <GraduationCap className="h-3.5 w-3.5" /> Formation
          </span>
          <h1 className="mt-3 font-heading text-3xl sm:text-4xl font-bold">Nos formations</h1>
          <p className="mt-2 text-muted-foreground max-w-xl">
            Des parcours pratiques pour développer vos compétences numériques et professionnelles.
          </p>
        </div>
        {isAdmin && (
          <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl gradient-novatrax px-5 py-3 text-sm font-semibold text-white shadow-card hover:shadow-card-hover">
            <Plus className="h-4 w-4" /> Ajouter une formation
          </button>
        )}
      </div>

      {!isAdmin && (locked || user?.access_activated !== true) ? (
        <div className="mt-6"><FeatureLocked /></div>
      ) : loading ? (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-64 rounded-[20px] bg-muted/50 animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {items.map((f, i) => (
            <FormationCard
              key={f.id}
              formation={f}
              variant={i}
              isAdmin={isAdmin}
              onEdit={openEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      {showForm && (
        <FormationForm
          formation={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-10 rounded-3xl border border-dashed border-border bg-secondary/30 p-10 sm:p-16 text-center">
      <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl gradient-novatrax-soft">
        <BookOpen className="h-8 w-8 text-primary/50" />
      </span>
      <h3 className="mt-5 font-heading text-xl font-bold">Formations bientôt disponibles</h3>
      <p className="mt-2 text-muted-foreground max-w-md mx-auto">
        Notre catalogue de formations est en cours de préparation. Revenez bientôt pour découvrir nos premiers parcours.
      </p>
    </div>
  );
}