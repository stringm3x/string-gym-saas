"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LuLayoutDashboard,
  LuBuilding2,
  LuInbox,
  LuScrollText,
  LuUserCog,
} from "react-icons/lu";

const NAV = [
  { href: "/admin", label: "Panel", icon: LuLayoutDashboard },
  { href: "/admin/tenants", label: "Gimnasios", icon: LuBuilding2 },
  { href: "/admin/solicitudes", label: "Solicitudes", icon: LuInbox },
  { href: "/admin/eventos", label: "Bitácora", icon: LuScrollText },
  { href: "/admin/cuenta", label: "Mi cuenta", icon: LuUserCog },
];

// Misma regla que SidebarLink del gym: activo = fondo lleno + texto ácido.
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col">
      {NAV.map((item) => {
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex h-11 items-center gap-3 px-5 text-sm transition-colors ${
              active
                ? "bg-surface-hover font-medium text-brand-green"
                : "text-text-secondary hover:bg-surface-hover/60 hover:text-text-primary"
            }`}
          >
            <Icon
              size={18}
              className={active ? "text-brand-green" : "text-text-muted"}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
