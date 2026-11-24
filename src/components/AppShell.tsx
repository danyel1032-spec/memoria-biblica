"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Icon } from "./Icon";
import { requestPersistence } from "@/lib/db/db";

const NAV = [
  { href: "/", label: "Hoy", icon: "home" },
  { href: "/biblioteca/", label: "Biblioteca", icon: "book" },
  { href: "/versiculos/", label: "Mis versículos", icon: "list" },
  { href: "/ajustes/", label: "Ajustes", icon: "settings" },
];

/** Screens where the learner should focus: no bottom navigation. */
const FOCUS = ["/sesion", "/practicar"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "/";
  const focus = FOCUS.some((p) => path.startsWith(p));

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    requestPersistence().catch(() => {});
  }, []);

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <main className={`flex-1 px-4 pt-[max(env(safe-area-inset-top),1rem)] ${focus ? "pb-8" : "pb-28"}`}>{children}</main>
      {!focus && (
        <nav
          aria-label="Navegación principal"
          className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
        >
          <ul className="mx-auto grid max-w-2xl grid-cols-4">
            {NAV.map((n) => {
              const active = n.href === "/" ? path === "/" : path.startsWith(n.href.replace(/\/$/, ""));
              return (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex flex-col items-center gap-1 py-2.5 text-xs font-medium ${active ? "text-brand" : "text-muted"}`}
                  >
                    <Icon name={n.icon} className="h-6 w-6" />
                    {n.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
