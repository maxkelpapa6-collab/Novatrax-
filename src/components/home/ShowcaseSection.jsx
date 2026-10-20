import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { Smartphone, GraduationCap, ArrowRight, Lock } from "lucide-react";
import { Image } from "@/components/ui/image";

// Section vitrine de la page d'accueil : applications et formations avec leur
// photo de profil. Visible par tous les membres (vitrine sans contenu ni liens,
// servie par l'API protégée memberContent) — le contenu complet reste réservé
// aux membres avec accès Pro actif.
const PASTELS = ["bg-orange-100", "bg-blue-100", "bg-emerald-100", "bg-violet-100"];

export default function ShowcaseSection() {
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, items: [], locked: false });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.functions.invoke("memberContent", {});
        if (!alive) return;
        const showcase = res.data?.showcase || [];
        setState({ loading: false, items: showcase, locked: res.data?.locked === true });
      } catch {
        if (alive) setState({ loading: false, items: [], locked: false });
      }
    })();
    return () => { alive = false; };
  }, []);

  if (state.loading || state.items.length === 0) return null;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-bold">Applications &amp; formations</h2>
        <button
          onClick={() => navigate("/apk-pro")}
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          Tout voir <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:gap-4">
        {state.items.map((item, i) => (
          <button
            key={item.id}
            onClick={() => navigate(item.kind === "app" ? "/apk-pro" : "/formation")}
            className="relative flex flex-col rounded-[20px] bg-card shadow-card hover:shadow-card-hover transition-all overflow-hidden text-left"
          >
            <div className={`relative flex h-16 items-center justify-center ${PASTELS[i % PASTELS.length]}`}>
              {item.kind === "app" ? (
                <Smartphone className="h-10 w-10 text-primary/25" strokeWidth={1.5} />
              ) : (
                <GraduationCap className="h-10 w-10 text-primary/25" strokeWidth={1.5} />
              )}
            </div>
            <div className="relative z-10 -mt-10 flex justify-center">
              <div className="h-20 w-20 overflow-hidden rounded-2xl border-4 border-card shadow-card">
                {item.image ? (
                  <Image src={item.image} fittingType="fill" className="h-full w-full" alt={item.name} />
                ) : (
                  <div className={`flex h-full w-full items-center justify-center ${PASTELS[i % PASTELS.length]}`}>
                    {item.kind === "app"
                      ? <Smartphone className="h-8 w-8 text-primary/50" />
                      : <GraduationCap className="h-8 w-8 text-primary/50" />}
                  </div>
                )}
              </div>
            </div>
            <div className="px-3 pt-2 pb-4 text-center">
              <p className="truncate text-sm font-bold text-foreground">{item.name}</p>
              <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-primary">
                {item.kind === "app"
                  ? <><Smartphone className="h-3 w-3" /> APK Pro</>
                  : <><GraduationCap className="h-3 w-3" /> Formation</>}
              </span>
            </div>
          </button>
        ))}
      </div>

      {state.locked && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" />
          Aperçu uniquement — activez votre accès pour consulter et télécharger les contenus.
        </p>
      )}
    </div>
  );
}