"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import type { Organization } from "@/lib/types";

const NAV = [
  { href: "/onboarding", label: "Onboarding" },
  { href: "/adjuster", label: "Claims Queue" },
  { href: "/adjuster/review", label: "Review Queue" },
  { href: "/rules", label: "Rules" },
  { href: "/documents", label: "Documents" },
  { href: "/executive", label: "Dashboard" },
];

function ShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const orgId = searchParams.get("org") ?? orgs[0]?.id ?? "";

  useEffect(() => {
    fetch("/api/organizations")
      .then((r) => r.json())
      .then((d) => setOrgs(d.organizations ?? []))
      .catch(() => setOrgs([]));
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-navy text-white">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between flex-wrap gap-2">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-display font-semibold text-lg tracking-tight">ClaimOps</span>
          </Link>
          <nav className="flex items-center gap-0.5 flex-wrap">
            {NAV.map((item) => {
              const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href) && item.href.length > 1 && pathname.split("?")[0] === item.href);
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={`${item.href}?org=${orgId}`}
                  className={`px-2.5 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                    isActive ? "bg-white/15 text-white" : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/50 hidden sm:inline">Tenant</span>
            <select
              className="bg-white/10 text-white text-sm rounded-md px-2 py-1.5 border border-white/20 focus:outline-none focus:ring-2 focus:ring-teal"
              value={orgId}
              onChange={(e) => {
                const url = new URL(window.location.href);
                url.searchParams.set("org", e.target.value);
                window.location.href = url.toString();
              }}
            >
              {orgs.map((o) => (
                <option key={o.id} value={o.id} className="text-ink">
                  {o.name}
                </option>
              ))}
              {orgs.length === 0 && <option value="">No tenants yet — run npm run db:seed</option>}
            </select>
          </div>
        </div>
      </header>
      <main className="flex-1 bg-background">{children}</main>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <ShellInner>{children}</ShellInner>
    </Suspense>
  );
}
