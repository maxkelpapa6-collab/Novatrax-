import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Eye, EyeOff, ChevronDown } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import SocialLoginButtons from "@/components/SocialLoginButtons";
import { toast } from "@/components/ui/use-toast";
import { safeReturnTo } from "@/lib/authReturnTo";
import { COUNTRIES, getCountry } from "@/lib/countries";
import { readPendingRef, savePendingRef, clearPendingRef } from "@/lib/pendingRef";

export default function Register() {
  // Lien de parrainage : /register?ref=CODE_UNIQUE — le code survit aux actualisations
  // pendant tout le parcours (formulaire, vérification e-mail, rechargements).
  const urlRef = (new URLSearchParams(window.location.search).get("ref") || "").trim();
  const initialRef = urlRef || readPendingRef() || "";
  const [form, setForm] = useState({
    email: "",
    username: "",
    first_name: "",
    last_name: "",
    country: "",
    phone: "",
    sponsor: initialRef,
    password: "",
    confirmPassword: "",
    acceptTerms: false,
    shareContacts: false,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [showPw, setShowPw] = useState(false);
  // Parrain identifié depuis le lien partagé (affichage verrouillé « Invitée par »)
  const [sponsorName, setSponsorName] = useState(null);
  const [sponsorHandle, setSponsorHandle] = useState(null);
  const [sponsorInvalid, setSponsorInvalid] = useState(false);

  // Dernier lien cliqué = parrain attribué ; conservation immédiate du code
  useEffect(() => {
    if (urlRef) savePendingRef(urlRef);
    const code = urlRef || readPendingRef();
    if (code) {
      base44.functions.invoke("validateSignup", { username: "", ref_code: code })
        .then((res) => {
          if (res.data?.sponsor && (res.data.sponsor.name || res.data.sponsor.username)) {
            setSponsorName(res.data.sponsor.name || res.data.sponsor.username);
            setSponsorHandle(res.data.sponsor.username || null);
            setSponsorInvalid(false);
          } else {
            setSponsorInvalid(true);
          }
        })
        .catch(() => {
          // pas de parrain fictif : le champ reste modifiable
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const country = getCountry(form.country);

  const validate = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return "Veuillez saisir une adresse e-mail valide.";
    if (!/^[a-zA-Z0-9_.]{3,20}$/.test(form.username.trim())) return "Nom d'utilisateur : 3 à 20 caractères (lettres, chiffres, _ ou .).";
    if (!/^[A-Za-zÀ-ÿ' -]{2,40}$/.test(form.first_name.trim())) return "Veuillez saisir votre prénom.";
    if (!form.country) return "Veuillez sélectionner votre pays.";
    const local = form.phone.replace(/[\s-]/g, "");
    if (!/^\d{6,12}$/.test(local)) return "Le numéro de téléphone n'est pas valide (chiffres uniquement, sans l'indicatif).";
    if (form.password.length < 8) return "Le mot de passe doit contenir au moins 8 caractères.";
    if (!/[a-zA-Z]/.test(form.password) || !/\d/.test(form.password)) return "Le mot de passe doit contenir des lettres et des chiffres.";
    if (form.password !== form.confirmPassword) return "Les mots de passe ne correspondent pas.";
    if (!form.acceptTerms) return "Vous devez accepter les conditions générales et la politique de confidentialité.";
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const v = validate();
    if (v) { setError(v); return; }
    setLoading(true);
    try {
      // Validation côté serveur : disponibilité du nom d'utilisateur + résolution du parrain
      const check = await base44.functions.invoke("validateSignup", {
        username: form.username.trim(),
        ref_code: form.sponsor.trim(),
      });
      if (check.data && check.data.username_available === false) {
        setError("Ce nom d'utilisateur est déjà pris. Choisissez-en un autre.");
        return;
      }
      // Aucun parrain fictif : un code invalide bloque l'envoi pour être corrigé
      if (form.sponsor.trim() && check.data && !check.data.sponsor) {
        setError("Le code de parrainage saisi est invalide. Corrigez-le ou laissez le champ vide.");
        return;
      }
      await base44.auth.register({ email: form.email.trim(), password: form.password });
      setShowOtp(true);
    } catch (err) {
      const msg = String(err?.response?.data?.error || err?.message || "");
      setError(/already|exist|used|utilisé/i.test(msg)
        ? "Cette adresse e-mail est déjà utilisée."
        : (msg || "Inscription échouée. Veuillez réessayer."));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await base44.auth.verifyOtp({ email: form.email.trim(), otpCode });
      if (result?.access_token) {
        base44.auth.setToken(result.access_token);
      }
      // Enregistrer le profil après vérification
      try {
        const phone = country ? country.dialCode + form.phone.replace(/[\s-]/g, "") : form.phone;
        await base44.auth.updateMe({
          username: form.username.trim(),
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          full_name: [form.first_name.trim(), form.last_name.trim()].filter(Boolean).join(" "),
          country: form.country,
          phone,
          email_verified: true,
          share_contacts: form.shareContacts === true,
        });
      } catch (profileErr) {
        console.warn("Profil non mis à jour:", profileErr);
      }
      // Enregistrer la relation de parrainage côté serveur (une seule fois, non modifiable ensuite)
      try {
        const ref = await base44.functions.invoke("registerSponsorship", { ref_code: form.sponsor.trim() });
        // Attribution définitive enregistrée : le code temporaire peut être retiré
        if (ref.data?.ok) clearPendingRef();
      } catch (refErr) {
        // Le code reste conservé : l'attribution sera reprise automatiquement à la prochaine connexion
        console.warn("Parrainage non enregistré:", refErr);
      }
      window.location.href = safeReturnTo();
    } catch (err) {
      setError(err.message || "Code de vérification invalide ou expiré.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await base44.auth.resendOtp(form.email.trim());
      toast({ title: "Code renvoyé", description: "Vérifiez votre boîte de réception." });
    } catch (err) {
      setError(err.message || "Impossible de renvoyer le code.");
    }
  };


  if (showOtp) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <h1 className="text-center text-lg font-medium text-muted-foreground mb-2">Vérifiez votre e-mail</h1>
          <p className="text-center text-sm text-muted-foreground mb-8">
            Un code à 6 chiffres a été envoyé à <span className="font-semibold text-foreground">{form.email}</span>. Il expire au bout de quelques minutes.
          </p>
          {error && <div className="mb-5 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
          <div className="flex justify-center mb-6">
            <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} autoFocus autoComplete="one-time-code">
              <InputOTPGroup>
                <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
                <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          <Button
            className="w-full h-12 rounded-xl font-semibold bg-violet text-violet-foreground hover:bg-violet/90"
            onClick={handleVerify}
            disabled={loading || otpCode.length < 6}
          >
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Vérification…</> : "Valider le code"}
          </Button>
          <p className="text-center text-sm text-muted-foreground mt-4">
            Vous n'avez pas reçu le code ?{" "}
            <button onClick={handleResend} className="text-violet font-semibold hover:underline">Renvoyer le code</button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <h1 className="text-center text-lg font-medium text-muted-foreground mb-8">
          Saisissez vos informations personnelles pour créer un compte
        </h1>

        {error && <div className="mb-5 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-foreground">Adresse email</label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="Adresse email"
              value={form.email}
              onChange={set("email")}
              className="h-12 rounded-xl bg-white focus-visible:ring-violet/40"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="username" className="text-sm font-medium text-foreground">Nom d'utilisateur</label>
            <Input
              id="username"
              type="text"
              autoComplete="username"
              placeholder="Saisissez votre nom d'utilisateur"
              value={form.username}
              onChange={set("username")}
              className="h-12 rounded-xl bg-white focus-visible:ring-violet/40"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="first_name" className="text-sm font-medium text-foreground">Prénom</label>
              <Input
                id="first_name"
                type="text"
                autoComplete="given-name"
                placeholder="Votre prénom"
                value={form.first_name}
                onChange={set("first_name")}
                className="h-12 rounded-xl bg-white focus-visible:ring-violet/40"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="last_name" className="text-sm font-medium text-foreground">Nom</label>
              <Input
                id="last_name"
                type="text"
                autoComplete="family-name"
                placeholder="Votre nom"
                value={form.last_name}
                onChange={set("last_name")}
                className="h-12 rounded-xl bg-white focus-visible:ring-violet/40"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="country" className="text-sm font-medium text-foreground">Contact</label>
            <div className="relative">
              <select
                id="country"
                value={form.country}
                onChange={set("country")}
                className="w-full h-12 rounded-xl border border-input bg-white pl-4 pr-10 text-sm font-medium uppercase outline-none focus:border-violet appearance-none"
                required
              >
                <option value="">Sélectionnez votre pays</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.name} ({c.dialCode})</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
            <div className="relative mt-2">
              {country && (
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                  {country.dialCode}
                </span>
              )}
              <Input
                id="phone"
                type="tel"
                placeholder="Numéro de téléphone"
                value={form.phone}
                onChange={set("phone")}
                className={`h-12 rounded-xl bg-white focus-visible:ring-violet/40 ${country ? "pl-16" : ""}`}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="sponsor" className="text-sm font-medium text-foreground">Invitée par</label>
            <Input
              id="sponsor"
              type="text"
              placeholder="Code ou nom d'utilisateur du parrain (optionnel)"
              value={sponsorName ? sponsorName : form.sponsor}
              onChange={set("sponsor")}
              readOnly={!!sponsorName}
              className={`h-12 rounded-xl focus-visible:ring-violet/40 ${sponsorName ? "bg-secondary" : "bg-white"}`}
            />
            {sponsorName && (
              <p className="text-xs text-muted-foreground">
                Parrain identifié à partir du lien partagé{sponsorHandle ? ` (@${sponsorHandle})` : ""} — cette information est verrouillée.
              </p>
            )}
            {sponsorInvalid && (
              <p className="text-xs text-destructive">
                Ce code de parrainage n'a pas été reconnu. Corrigez-le ou laissez le champ vide.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-foreground">Saisissez le mot de passe</label>
            <div className="relative">
              <Input
                id="password"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
                value={form.password}
                onChange={set("password")}
                className="h-12 rounded-xl bg-white pr-11 focus-visible:ring-violet/40"
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

          <div className="space-y-1.5">
            <label htmlFor="confirm" className="text-sm font-medium text-foreground">Confirmez le mot de passe</label>
            <Input
              id="confirm"
              type={showPw ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              value={form.confirmPassword}
              onChange={set("confirmPassword")}
              className="h-12 rounded-xl bg-white focus-visible:ring-violet/40"
              required
            />
          </div>

          <label className="flex items-start gap-3 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={form.acceptTerms}
              onChange={set("acceptTerms")}
              className="mt-0.5 h-4 w-4 rounded border-input accent-violet"
            />
            <span className="text-sm text-muted-foreground">
              J'accepte les{" "}
              <Link to="/terms" className="font-medium text-foreground hover:underline">conditions générales</Link>{" "}
              et{" "}
              <Link to="/privacy" className="text-violet font-medium hover:underline">la politique de confidentialité</Link>.
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.shareContacts}
              onChange={set("shareContacts")}
              className="mt-0.5 h-4 w-4 rounded border-input accent-violet"
            />
            <span className="text-sm text-muted-foreground">
              J'accepte que mon nom et mon numéro de téléphone soient visibles et partageables avec
              les membres autorisés de NOVATRAX.
            </span>
          </label>

          <Button
            type="submit"
            className="w-full h-12 rounded-xl font-semibold bg-violet text-violet-foreground hover:bg-violet/90"
            disabled={loading}
          >
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Création du compte…</> : "Créer un compte"}
          </Button>
        </form>

        <div className="relative my-7">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center">
            <span className="bg-white px-4 text-xs text-muted-foreground">Ou créez votre compte avec</span>
          </div>
        </div>

        <SocialLoginButtons returnTo={safeReturnTo()} />

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Vous avez déjà un compte ?{" "}
          <Link
            to={"/login" + (safeReturnTo() !== "/" ? "?returnTo=" + encodeURIComponent(safeReturnTo()) : "")}
            className="text-violet font-semibold hover:underline"
          >
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}