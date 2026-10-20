import { NavLink } from "react-router-dom";
import { Image } from "@/components/ui/image";
import { LOGO_URL } from "@/components/Logo";
import {
  Home as HomeIcon, Mail, GraduationCap, Smartphone, User, Users, Gift, History,
  ArrowDownToLine, ArrowUpFromLine, LogOut, LayoutDashboard, Inbox as InboxIcon,
  ShoppingBag, Store, Link2,
} from "lucide-react";

// Barre de navigation basse : exactement quatre entrées
export const NAV_ITEMS = [
  { to: "/", label: "Accueil", icon: HomeIcon, end: true },
  { to: "/contact", label: "Contact", icon: Mail },
  { to: "/formation", label: "Formation", icon: GraduationCap },
  { to: "/apk-pro", label: "Les APK Pro", icon: Smartphone },
];

// Menu latéral (hamburger) et barre latérale ordinateur
export const MENU_ITEMS = [
  { to: "/", label: "Tableau de bord", icon: LayoutDashboard, end: true },
  { to: "/boite-reception", label: "Boîte de réception", icon: InboxIcon },
  { to: "/profile", label: "Mon profil", icon: User },
  { to: "/#parrainage", label: "Mon lien de parrainage", icon: Gift, end: true },
  { to: "/reseau", label: "Mon réseau", icon: Users },
  { to: "/portefeuille?tab=historique", label: "Historique des transactions", icon: History },
  { to: "/portefeuille?tab=depot", label: "Dépôt", icon: ArrowDownToLine },
  { to: "/portefeuille?tab=retrait", label: "Retrait", icon: ArrowUpFromLine },
  { to: "/formation", label: "Formation", icon: GraduationCap },
  { to: "/apk-pro", label: "Les APK Pro", icon: Smartphone },
  { to: "/marketplace", label: "Marketplace", icon: ShoppingBag },
  { to: "/ma-boutique", label: "Ma boutique", icon: Store },
  { to: "/liens-paiement", label: "Liens de paiement", icon: Link2 },
  { to: "/contact", label: "Contact", icon: Mail },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-background/95 backdrop-blur-md border-t border-border">
      <div className="mx-auto max-w-2xl grid grid-cols-4 px-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl transition-colors ${
                  isActive ? "text-violet" : "text-muted-foreground"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                      isActive ? "gradient-novatrax text-white shadow-md" : "bg-transparent"
                    }`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={2.2} />
                  </span>
                  <span className="text-[10px] font-semibold tracking-tight">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}

// Liste de menu partagée entre le tiroir mobile et la barre latérale ordinateur
export function MenuList({ onNavigate, isAdmin, onLogout, unreadCount = 0 }) {
  return (
    <>
      {MENU_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "gradient-novatrax text-white shadow-sm"
                  : "text-foreground hover:bg-muted"
              }`
            }
          >
            <Icon className="h-5 w-5" strokeWidth={2.1} />
            <span className="flex-1">{item.label}</span>
            {item.to === "/boite-reception" && unreadCount > 0 && (
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </NavLink>
        );
      })}
      {isAdmin && (
        <NavLink
          to="/admin"
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive ? "gradient-novatrax text-white shadow-sm" : "text-foreground hover:bg-muted"
            }`
          }
        >
          <ShieldIcon />
          Espace administrateur
        </NavLink>
      )}
      {onLogout && (
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/5"
        >
          <LogOut className="h-5 w-5" strokeWidth={2.1} />
          Déconnexion
        </button>
      )}
    </>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" strokeWidth={2.1} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  );
}

export function Sidebar({ onNavigate, isAdmin, onLogout, unreadCount = 0 }) {
  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-sidebar/50 backdrop-blur-sm">
      <div className="px-5 py-6">
        <NavLink to="/" className="flex items-center gap-2.5" onClick={onNavigate}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-sm">
            <Image src={LOGO_URL} alt="NOVATRAX" className="h-full w-full" fittingType="fill" />
          </span>
          <span className="font-heading font-extrabold text-xl tracking-tight">
            NOVA<span className="text-gradient-novatrax">TRAX</span>
          </span>
        </NavLink>
      </div>
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        <MenuList onNavigate={onNavigate} isAdmin={isAdmin} onLogout={onLogout} unreadCount={unreadCount} />
      </nav>
    </aside>
  );
}