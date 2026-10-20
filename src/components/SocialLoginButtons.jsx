import { Linkedin, Facebook } from "lucide-react";
import GoogleIcon from "@/components/GoogleIcon";
import XIcon from "@/components/XIcon";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";

// Rangée de connexion sociale : LinkedIn, X, Facebook, Google
export default function SocialLoginButtons({ returnTo }) {
  const handleGoogle = () => base44.auth.loginWithProvider("google", returnTo);
  const handleFacebook = () => base44.auth.loginWithProvider("facebook", returnTo);
  const handleUnavailable = () =>
    toast({ title: "Bientôt disponible", description: "Cette méthode de connexion n'est pas encore activée." });

  const items = [
    { label: "LinkedIn", icon: <Linkedin className="w-5 h-5 text-muted-foreground" />, onClick: handleUnavailable },
    { label: "X", icon: <XIcon className="w-4 h-4 text-muted-foreground" />, onClick: handleUnavailable },
    { label: "Facebook", icon: <Facebook className="w-5 h-5 text-muted-foreground" />, onClick: handleFacebook },
    { label: "Google", icon: <GoogleIcon className="w-5 h-5" />, onClick: handleGoogle },
  ];

  return (
    <div className="flex justify-center gap-4">
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={item.onClick}
          className="flex h-12 w-12 items-center justify-center rounded-xl border border-input bg-white transition hover:border-violet hover:bg-violet/5"
          aria-label={item.label}
        >
          {item.icon}
        </button>
      ))}
    </div>
  );
}