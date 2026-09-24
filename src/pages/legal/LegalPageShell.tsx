import { Link } from "react-router-dom";
import { Package, ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";

interface LegalPageShellProps {
  title: string;
  effectiveDate: string;
  lastUpdated: string;
  children: React.ReactNode;
}

/** Shared chrome for public Privacy Policy / Terms of Service pages. */
export function LegalPageShell({
  title,
  effectiveDate,
  lastUpdated,
  children,
}: LegalPageShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
              <Package className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">Emerald CFZE</p>
              <p className="truncate text-xs text-muted-foreground">SCM Platform</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/auth">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Sign in
              </Link>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Effective date: {effectiveDate} · Last updated: {lastUpdated}
        </p>
        <div className="mt-8 space-y-8 text-sm sm:text-base leading-relaxed text-foreground/90 [&_h2]:text-lg [&_h2]:sm:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-0 [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1.5 [&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline [&_p]:text-muted-foreground [&_li]:text-muted-foreground">
          {children}
        </div>

        <nav className="mt-12 flex flex-wrap gap-4 border-t pt-6 text-sm">
          <Link to="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
          <Link to="/terms" className="text-primary hover:underline">
            Terms of Service
          </Link>
          <Link to="/vendor-portal" className="text-muted-foreground hover:text-foreground hover:underline">
            Vendor Portal
          </Link>
          <Link to="/" className="text-muted-foreground hover:text-foreground hover:underline">
            Home
          </Link>
        </nav>
      </main>
    </div>
  );
}

export const LEGAL_ENTITY = "Emerald CFZE";
export const LEGAL_PLATFORM = "Emerald CFZE Supply Chain Management Platform (SCM Platform)";
export const LEGAL_CONTACT_PRIVACY = "procurement@emeraldcfze.com";
export const LEGAL_CONTACT_AP = "accountpayables@emeraldcfze.com";
export const LEGAL_EFFECTIVE = "24 September 2026";
