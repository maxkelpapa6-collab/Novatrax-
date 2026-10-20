import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { Smartphone, Plus } from "lucide-react";
import FeatureLocked from "@/components/FeatureLocked";
import AppCard from "@/components/apkpro/AppCard";
import AppForm from "@/components/apkpro/AppForm";
import { useToast } from "@/components/ui/use-toast";

// Page APK Pro : catalogue réservé aux membres actifs (verrouillage vérifié
// côté serveur via memberContent) ; gestion complète pour les administrateurs.
export default function ApkPro() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (!isAdmin) {
        const res = await base44.functions.invoke("memberContent", {});
        if (res.data?.locked) setLocked(true);
        else {
          setLocked(false);
          setItems(res.data?.applications || []);
        }
      } else {
        const res = await base44.entities.Application.filter({}, { sort: "-created_date", limit: 100 });
        setItems(res.items || []);
      }
    } catch (e) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setShowForm(true); };
  const openEdit = (a) => { setEditing(a); setShowForm(true); };

  const onDelete = async (a) => {
    if (!confirm(`Supprimer l'application « ${a.name} » ? Cette action est définitive.`)) return;
    try {
      await base44.entities.Application.delete(a.id);
      setItems((prev) => prev.filter((i) => i.id !== a.id));
    } catch (e) {
      toast({ title: "Suppression impossible", description: e?.response?.data?.error || e?.message || "Erreur", variant: "destructive" });
    }
  };

  const onTogglePublish = async (a) => {
    if (!a.published && !a.apk_file_uri && (a.download_type === "apk_file" || (!a.download_type && !a.download_url))) {
      toast({ title: "Activation impossible", description: "Ajoutez d'abord un fichier APK à cette application.", variant: "destructive" });
      return;
    }
    if (!a.published && a.download_type !== "apk_file" && !a.download_url) {
      toast({ title: "Activation impossible", description: "Renseignez d'abord le lien de téléchargement.", variant: "destructive" });
      return;
    }
    try {
      await base44.entities.Application.update(a.id, { published: !a.published });
      load();
    } catch (e) {
      toast({ title: "Modification impossible", description: e?.response?.data?.error || e?.message || "Erreur", variant: "destructive" });
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Smartphone className="h-3.5 w-3.5" /> Applications
          </span>
          <h1 className="mt-3 font-heading text-3xl sm:text-4xl font-bold">Les APK Pro</h1>
          <p className="mt-2 text-muted-foreground max-w-xl">
            Un catalogue d'applications et d'outils numériques sélectionnés pour booster votre productivité.
          </p>
        </div>
        {isAdmin && (
          <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl gradient-novatrax px-5 py-3 text-sm font-semibold text-white shadow-card hover:shadow-card-hover">
            <Plus className="h-4 w-4" /> Ajouter une application
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
        <EmptyState isAdmin={isAdmin} />
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {items.map((a, i) => (
            <AppCard
              key={a.id}
              app={a}
              variant={i}
              isAdmin={isAdmin}
              onEdit={openEdit}
              onDelete={onDelete}
              onTogglePublish={onTogglePublish}
              onChanged={load}
            />
          ))}
        </div>
      )}

      {showForm && (
        <AppForm application={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />
      )}
    </div>
  );
}

function EmptyState({ isAdmin }) {
  return (
    <div className="mt-10 rounded-3xl border border-dashed border-border bg-secondary/30 p-10 sm:p-16 text-center">
      <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl gradient-novatrax-soft">
        <Smartphone className="h-8 w-8 text-primary/50" />
      </span>
      <h3 className="mt-5 font-heading text-xl font-bold">{isAdmin ? "Aucune application pour le moment" : "Catalogue bientôt disponible"}</h3>
      <p className="mt-2 text-muted-foreground max-w-md mx-auto">
        {isAdmin
          ? "Ajoutez votre première application APK Pro avec un lien externe ou un fichier APK."
          : "Les applications Pro seront ajoutées prochainement. Revenez visiter cette rubrique pour découvrir nos outils."}
      </p>
    </div>
  );
}