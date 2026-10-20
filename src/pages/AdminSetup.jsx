import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, ArrowLeft, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

// Configuration initiale : désigne l'administrateur principal (une seule
// fois, avec le code ADMIN_SETUP_CODE défini sur le serveur).
export default function AdminSetup() {
  const [email, setEmail] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.functions.invoke("initFirstAdmin", { email: email.trim(), setup_code: setupCode.trim() });
      setDone(true);
    } catch (err) {
      setError(err.message || "Configuration impossible.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={ShieldCheck}
      title="Administrateur principal"
      subtitle="Configuration initiale, utilisable une seule fois"
      footer={
        <Link to="/login" className="text-primary font-medium hover:underline">
          <ArrowLeft className="w-3 h-3 inline mr-1" />Retour à la connexion
        </Link>
      }
    >
      {done ? (
        <p className="text-sm text-foreground text-center">
          C'est fait : ce compte est maintenant administrateur. Reconnectez-vous pour accéder à l'espace administrateur.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Créez d'abord votre compte via l'inscription, puis saisissez son adresse e-mail et le code de configuration
            (ADMIN_SETUP_CODE).
          </p>
          <div className="space-y-2">
            <Label htmlFor="email">Adresse e-mail du compte</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="setup_code">Code de configuration</Label>
            <Input id="setup_code" type="password" value={setupCode} onChange={(e) => setSetupCode(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Devenir administrateur"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
