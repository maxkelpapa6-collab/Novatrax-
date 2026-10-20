import { Link } from "react-router-dom";
import { Image } from "@/components/ui/image";

export const LOGO_URL = "https://media.base44.com/images/public/6ad0d39326ed4b1a37df4567/ebb8af7fb_408358BC-048B-4229-BF94-04577945B068.png";

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