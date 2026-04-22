"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/superadmin", label: "Estudios", exact: true },
  { href: "/superadmin/analytics", label: "Analytics" },
];

export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-0">
      {/* Sub-nav */}
      <div className="bg-amber-950/5 border border-amber-200/60 rounded-2xl mb-5 overflow-hidden">
        <div className="flex items-center gap-1 px-3 py-2 border-b border-amber-200/40">
          <span className="text-xs font-semibold text-amber-700/70 uppercase tracking-widest px-1">Superadmin</span>
          <div className="flex-1" />
          {TABS.map((tab) => {
            const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  active
                    ? "bg-amber-500 text-white shadow-sm"
                    : "text-amber-700 hover:bg-amber-100"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
