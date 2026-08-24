"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ORGANIZATIONS } from "@/lib/seed-data";
import { Suspense } from "react";

const NAV = [
  { href: "/onboarding", label: "Onboarding", persona: "FDE / Implementation" },
  { href: "/adjuster", label: "Claims Queue", persona: "Adjuster" },
  { href: "/executive", label: "Dashboard", persona: "Executive" },
];

function ShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const orgId = searchParams.get("org") ?? ORGANIZATIONS[0].id;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-navy text-white">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-display font-semibold text-lg tracking-tight">
              ClaimOps
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {NAV.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={`${item.href}?org=${orgId}`}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    active
                      ? "bg-white/15 text-white"
                      : "text-white/70 hover:text-white hover:bg-white/10"
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
              {ORGANIZATIONS.map((o) => (
                <option key={o.id} value={o.id} className="text-ink">
                  {o.name}
                </option>
              ))}
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
