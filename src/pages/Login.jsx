import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { safeReturnTo } from "@/lib/authReturnTo";
import { Image } from "@/components/ui/image";
import { LOGO_URL } from "@/components/Logo";

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loading, setLoading] = useState(false);
  // Destination après connexion (le flux OAuth/consent utilise returnTo, même origine uniquement)
  const returnTo = safeReturnTo();

  useEffect(() => {
    const pref = localStorage.getItem("novatrax_remember_me");
    if (pref !== null) setRemember(pref === "1");
  }, []);

  const handleRemember = (checked) => {
    setRemember(checked);
    localStorage.setItem("novatrax_remember_me", checked ? "1" : "0");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setNeedsVerification(false);
    if (!identifier.trim() || !password) {
      setError("Veuillez saisir vos identifiants.");
      return;
    }
    setLoading(true);
    try {
      let email = identifier.trim();
      if (!email.includes("@")) {
        const res = await api.functions.invoke("resolveLoginIdentifier", { identifier: email });
        email = res.data?.email;
        if (!email) throw new Error("Identifiants incorrects.");
      }
      setLoginEmail(email);
      await api.auth.loginViaEmailPassword(email, password);
      // Un compte bloqué ne doit pas accéder à l'application
      try {
        const me = await api.auth.me();
        if (me?.account_status === "suspended") {
          await api.auth.logout();
          setError("Votre compte a été bloqué par l'administration NOVATRAX. Contactez le support pour plus d'informations.");
          return;
        }
      } catch {
        // Poursuivre vers la redirection standard
      }
      window.location.href = returnTo;
    } catch (err) {
      const msg = String(err?.response?.data?.error || err?.message || "");
      if (/v[ée]rifi/i.test(msg)) {
        setError("Votre adresse e-mail n'est pas encore vérifiée. Terminez la vérification avec le code reçu par e-mail.");
        setNeedsVerification(true);
      } else {
        setError("Identifiants incorrects. Vérifiez votre nom d'utilisateur / adresse e-mail et votre mot de passe.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!loginEmail) return;
    try {
      await api.auth.resendOtp(loginEmail);
      toast({ title: "Code renvoyé", description: "Vérifiez votre boîte de réception." });
    } catch {
      setError("Impossible de renvoyer le code pour le moment.");
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl shadow-sm">
              <Image src={LOGO_URL} alt="NOVATRAX" className="h-full w-full" fittingType="fill" />
            </span>
            <span className="font-heading font-extrabold text-2xl tracking-tight">
              NOVA<span className="text-violet">TRAX</span>
            </span>
          </div>
        </div>

        <h1 className="text-center text-xl font-bold text-foreground mb-2">Se connecter à son compte</h1>
        <p className="text-center text-sm text-muted-foreground mb-8">
          Saisissez votre adresse e-mail et votre mot de passe pour vous connecter.
        </p>

        {error && (
          <div className="mb-5 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
            {needsVerification && (
              <button onClick={handleResend} className="mt-2 block text-violet font-medium hover:underline">
                Renvoyer le code de vérification
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="identifier" className="text-sm font-medium text-foreground">Nom d'utilisateur / Adresse e-mail</label>
            <Input
              id="identifier"
              type="text"
              autoComplete="username"
              autoFocus
              placeholder="Saisissez votre nom d'utilisateur/adresse"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="h-12 rounded-xl bg-secondary focus-visible:ring-violet/40"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-foreground">Mot de passe</label>
            <div className="relative">
              <Input
                id="password"
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-xl bg-secondary pr-11 focus-visible:ring-violet/40"
                required
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPw ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => handleRemember(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-violet"
              />
              <span className="text-sm text-muted-foreground">Se souvenir du mot de passe</span>
            </label>
            <Link to="/forgot-password" className="text-sm text-violet font-medium hover:underline">
              Mot de passe oublié ?
            </Link>
          </div>

          <Button
            type="submit"
            className="w-full h-12 rounded-xl font-semibold bg-violet text-violet-foreground hover:bg-violet/90"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connexion…
              </>
            ) : (
              "Se connecter"
            )}
          </Button>
        </form>


        <p className="mt-8 text-center text-sm text-muted-foreground">
          Vous n'avez pas de compte ?{" "}
          <Link
            to={"/register" + (returnTo !== "/" ? "?returnTo=" + encodeURIComponent(returnTo) : "")}
            className="text-violet font-semibold hover:underline"
          >
            Créer un
          </Link>
        </p>
      </div>
    </div>
  );
}