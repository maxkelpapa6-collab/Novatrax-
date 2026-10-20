import React from "react";
import { Image } from "@/components/ui/image";
import { LOGO_URL } from "@/components/Logo";

export default function AuthLayout({ title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <a href="/" className="flex items-center gap-2.5" aria-label="NOVATRAX — accueil">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl shadow-sm">
              <Image src={LOGO_URL} alt="NOVATRAX" className="h-full w-full" fittingType="fill" />
            </span>
            <span className="font-heading font-extrabold text-2xl tracking-tight">
              NOVA<span className="text-gradient-novatrax">TRAX</span>
            </span>
          </a>
        </div>
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="bg-card rounded-2xl shadow-card border border-border p-6 sm:p-8">
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm text-muted-foreground mt-6">{footer}</p>
        )}
      </div>
    </div>
  );
}