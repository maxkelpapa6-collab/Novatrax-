import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { Menu, X, Globe, LogOut, ChevronDown, Ban, Bell } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Image } from "@/components/ui/image";
import { LOGO_URL } from "@/components/Logo";
import { base44 } from "@/api/base44Client";
import { BottomNav, Sidebar, MenuList } from "@/components/Navigation";
import useUnreadInbox from "@/hooks/useUnreadInbox";
import { useEffect } from "react";

export default function AppLayout() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { unreadCount } = useUnreadInbox(user?.id);
  const navigate = useNavigate();

  const firstName = user?.first_name || user?.full_name?.split(" ")[0] || "Utilisateur";
  const initials = (user?.first_name?.[0] || user?.full_name?.[0] || "U").toUpperCase();

  const handleLogout = () => {
    logout(false);
    navigate("/");
  };

  // Un compte bloqué ne peut pas utiliser l'application
  if (user?.account_status === "suspended") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-card">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <Ban className="h-7 w-7" />
          </span>
          <h1 className="mt-4 font-heading text-2xl font-bold">Compte bloqué</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Votre compte a été suspendu par l'administration NOVATRAX.
            {user?.blocked_reason ? ` Motif : ${user.blocked_reason}` : ""}
            {" "}Vos données et votre historique sont conservés. Contactez le support pour toute question.
          </p>
          <button
            onClick={handleLogout}
            className="mt-6 inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-semibold hover:bg-muted"
          >
            <LogOut className="h-4 w-4" /> Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-xl hover:bg-muted"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <NavLink to="/" className="flex items-center gap-2.5" aria-label="NOVATRAX — accueil">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-sm">
                <Image src={LOGO_URL} alt="NOVATRAX" className="h-full w-full" fittingType="fill" />
              </span>
              <span className="font-heading font-extrabold text-xl tracking-tight">
                NOVA<span className="text-gradient-novatrax">TRAX</span>
              </span>
            </NavLink>
          </div>

          <div className="flex items-center gap-2">
            <NavLink
              to="/boite-reception"
              aria-label="Boîte de réception"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-foreground hover:bg-muted"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute right-0.5 top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </NavLink>
            <button className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">
              <Globe className="h-4 w-4" />
              FR
            </button>
            <div className="relative">
              <button
                onClick={() => setProfileOpen((v) => !v)}
                className="flex items-center gap-2 rounded-xl border border-border px-2 py-1.5 hover:bg-muted"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg gradient-novatrax text-sm font-bold text-white">
                  {initials}
                </span>
                <span className="hidden sm:block text-sm font-semibold max-w-[120px] truncate">{firstName}</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-border bg-popover shadow-card-hover z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-border">
                      <p className="text-sm font-semibold truncate">{user?.email}</p>
                      <p className="text-xs text-muted-foreground">{user?.role === "admin" ? "Administrateur" : "Membre"}</p>
                    </div>
                    <button
                      onClick={() => { setProfileOpen(false); navigate("/profile"); }}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-muted"
                    >
                      Mes informations personnelles
                    </button>
                    <button
                      onClick={() => { setProfileOpen(false); navigate("/profile"); }}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-muted"
                    >
                      Paramètres & sécurité
                    </button>
                    {user?.role === "admin" && (
                      <button
                        onClick={() => { setProfileOpen(false); navigate("/admin"); }}
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-muted"
                      >
                        Espace administrateur
                      </button>
                    )}
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/5"
                    >
                      <LogOut className="h-4 w-4" /> Déconnexion
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Mobile menu drawer */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-border bg-background">
            <nav className="px-3 py-3 space-y-1 max-h-[calc(100vh-4rem)] overflow-y-auto">
              <MenuList
                onNavigate={() => setMobileOpen(false)}
                isAdmin={user?.role === "admin"}
                onLogout={handleLogout}
                unreadCount={unreadCount}
              />
            </nav>
          </div>
        )}
      </header>

      <div className="flex">
        <Sidebar onNavigate={() => setMobileOpen(false)} isAdmin={user?.role === "admin"} onLogout={handleLogout} unreadCount={unreadCount} />
        <main className="flex-1 min-w-0 pb-24 lg:pb-10">
          <Outlet />
        </main>
      </div>

      <BottomNav />
    </div>
  );
}