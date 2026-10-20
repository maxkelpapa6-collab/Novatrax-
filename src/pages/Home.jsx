import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { api } from "@/api/client";
import { useMemberHome, useInvalidateMemberHome } from "@/hooks/useMemberHome";
import WelcomeCard from "@/components/home/WelcomeCard";
import FinanceStats from "@/components/home/FinanceStats";
import ReferralLinkCard from "@/components/home/ReferralLinkCard";
import NetworkLevels from "@/components/home/NetworkLevels";
import DepositAnomalyBanner from "@/components/home/DepositAnomalyBanner";
import ShowcaseSection from "@/components/home/ShowcaseSection";
import { readPendingRef, clearPendingRef } from "@/lib/pendingRef";
import { ShieldAlert, RefreshCw } from "lucide-react";

// Page d'accueil NOVATRAX : tableau de bord personnel vu après inscription et connexion.
// Toutes les données affichées proviennent de l'utilisateur connecté et du serveur.
export default function Home() {
  const location = useLocation();
  const { data, isLoading: loading, isError, error: fetchError, refetch } = useMemberHome();
  const invalidateMemberHome = useInvalidateMemberHome();
  const error = isError
    ? (fetchError?.response?.data?.error || fetchError?.message || "Impossible de charger vos informations.")
    : "";

  // Reprise d'un parrainage non enregistré : le code conservé reste valable jusqu'à attribution définitive
  useEffect(() => {
    const pending = readPendingRef();
    if (pending) {
      api.functions.invoke("registerSponsorship", { ref_code: pending })
        .then((res) => {
          if (res.data?.ok) {
            clearPendingRef();
            invalidateMemberHome();
          }
        })
        .catch(() => {
          // le code reste conservé pour une nouvelle tentative
        });
    }
  }, [invalidateMemberHome]);

  // Accès direct à la carte de parrainage depuis le menu (#parrainage)
  useEffect(() => {
    if (location.hash === "#parrainage") {
      const el = document.getElementById("parrainage");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  }, [location.hash]);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
      <WelcomeCard />

      {error ? (
        <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 flex flex-col items-center gap-3 text-center">
          <ShieldAlert className="h-6 w-6 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <button
            onClick={refetch}
            className="inline-flex items-center gap-2 rounded-xl gradient-novatrax px-4 py-2.5 text-sm font-semibold text-white"
          >
            <RefreshCw className="h-4 w-4" /> Réessayer
          </button>
        </div>
      ) : (
        <>
          {data?.review?.flagged && (
            <div className="mt-6">
              <DepositAnomalyBanner />
            </div>
          )}
          <div className="mt-6">
            <FinanceStats stats={data?.stats} loading={loading} />
          </div>
          <ShowcaseSection />
          {data?.access?.activated === false ? (
            <div className="mt-6">
              <ReferralLinkCard code={null} locked />
            </div>
          ) : (
            <>
              <div className="mt-6">
                <ReferralLinkCard code={data?.referral_code} />
              </div>
              <div className="mt-6">
                <NetworkLevels network={data?.network} loading={loading} />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}