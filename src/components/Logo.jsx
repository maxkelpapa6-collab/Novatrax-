import { Link } from "react-router-dom";
import { Image } from "@/components/ui/image";

// Remplacez public/logo.svg par votre logo (même nom, ou modifiez ce chemin).
export const LOGO_URL = "/logo.svg";

const SIZES = {
  sm: { mark: 28, text: "text-lg" },
  md: { mark: 36, text: "text-xl" },
  lg: { mark: 44, text: "text-2xl" },
  xl: { mark: 64, text: "text-3xl" },
};

export default function Logo({ to = "/", size = "md", showText = true, className = "" }) {
  const s = SIZES[size] || SIZES.md;
  return (
    <Link to={to} className={`inline-flex items-center gap-2.5 ${className}`} aria-label="NOVATRAX — accueil">
      <span
        className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-sm"
        style={{ width: s.mark, height: s.mark }}
      >
        <Image src={LOGO_URL} alt="NOVATRAX" className="h-full w-full" fittingType="fill" />
      </span>
      {showText && (
        <span className={`font-heading font-extrabold tracking-tight ${s.text} text-foreground`}>
          NOVA<span className="text-gradient-novatrax">TRAX</span>
        </span>
      )}
    </Link>
  );
}