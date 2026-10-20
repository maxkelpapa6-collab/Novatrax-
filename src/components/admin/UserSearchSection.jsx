import { useState } from "react";
import { api } from "@/api/client";
import { Search, Loader2, UserSearch } from "lucide-react";
import UserSheet from "@/components/admin/usersheet/UserSheet";
import { useToast } from "@/components/ui/use-toast";

// Recherche d'un utilisateur par adresse e-mail exacte (espace Admin).
// Toutes les données de la fiche sont calculées côté serveur : cette section
// ne fait que saisir l'e-mail et afficher la réponse du serveur.
export default function UserSearchSection() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [searched, setSearched] = useState(false);
  const { toast } = useToast();

  const runSearch = async (e) => {
    e?.preventDefault();
    const q = email.trim();
    if (!q || loading) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await api.functions.invoke("adminUserSheet", { email: q });
      setSheet(res.data?.found ? res.data : null);
    } catch (err) {
      setSheet(null);
      toast({
        title: "Recherche impossible",
        description: err?.response?.data?.error || err?.message || "Erreur serveur.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center gap-2">
          <UserSearch className="h-5 w-5 text-primary" />
          <h2 className="font-heading text-lg font-bold">Rechercher un utilisateur</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Saisissez l'adresse e-mail exacte enregistrée dans le compte pour afficher sa fiche complète.
        </p>
        <form onSubmit={runSearch} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Adresse e-mail"
            className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl gradient-novatrax px-5 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            RECHERCHER
          </button>
        </form>
        {searched && !loading && !sheet && (
          <p className="mt-3 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
            Aucun utilisateur trouvé avec cette adresse e-mail.
          </p>
        )}
      </div>
      {sheet && <UserSheet data={sheet} onRefresh={() => runSearch()} />}
    </div>
  );
}