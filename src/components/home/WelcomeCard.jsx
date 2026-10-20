import { useAuth } from "@/lib/AuthContext";

// Carte de bienvenue : prénom réel du compte connecté (jamais fictif)
export default function WelcomeCard() {
  const { user } = useAuth();
  const firstName =
    user?.first_name ||
    user?.full_name?.split(" ")[0] ||
    user?.username ||
    "Utilisateur";

  return (
    <div className="relative overflow-hidden rounded-3xl gradient-novatrax p-6 sm:p-8 text-white shadow-card">
      <div className="absolute -top-16 -right-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <div className="relative">
        <p className="text-sm font-medium text-white/85">Bonjour {firstName} 👋</p>
        <h1 className="mt-1 font-heading text-2xl sm:text-3xl font-bold">Bienvenue sur NOVATRAX !</h1>
        <p className="mt-2 text-white/85 text-sm max-w-lg">
          Accédez à vos formations, vos applications Pro et vos informations personnelles.
        </p>
      </div>
    </div>
  );
}