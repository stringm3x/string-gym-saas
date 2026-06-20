"use client";

import { useState } from "react";
import { LuUserPlus } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { StaffCard } from "./StaffCard";
import { InviteStaffModal } from "./InviteStaffModal";
import type { Staff } from "@/lib/types/staff";

interface StaffManagerProps {
  staff: Staff[];
  gymNombre: string;
}

export function StaffManager({ staff, gymNombre }: StaffManagerProps) {
  const [inviteOpen, setInviteOpen] = useState(false);

  // Owner primero, luego por fecha de creación.
  const ordenado = [...staff].sort((a, b) => {
    if (a.rol === "owner" && b.rol !== "owner") return -1;
    if (b.rol === "owner" && a.rol !== "owner") return 1;
    return a.created_at.localeCompare(b.created_at);
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            Equipo de {gymNombre}
          </h3>
          <p className="text-xs text-text-secondary">
            Invita recepcionistas para que ayuden a operar tu gimnasio.
          </p>
        </div>
        <Button
          leftIcon={<LuUserPlus className="h-4 w-4" />}
          onClick={() => setInviteOpen(true)}
          size="sm"
        >
          Invitar recepcionista
        </Button>
      </div>

      <div className="space-y-2">
        {ordenado.map((s) => (
          <StaffCard key={s.id} staff={s} />
        ))}
      </div>

      <InviteStaffModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
