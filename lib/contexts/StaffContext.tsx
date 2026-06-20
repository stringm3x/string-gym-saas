"use client";

import { createContext, useContext, type ReactNode } from "react";
import { hasPermission } from "@/lib/permissions";
import type { Staff, Permission } from "@/lib/types/staff";

interface StaffContextValue {
  staff: Staff | null;
  isOwner: boolean;
  isReceptionist: boolean;
  can: (permission: Permission) => boolean;
}

const StaffContext = createContext<StaffContextValue>({
  staff: null,
  isOwner: false,
  isReceptionist: false,
  can: () => false,
});

export function StaffProvider({
  children,
  staff,
}: {
  children: ReactNode;
  staff: Staff | null;
}) {
  const value: StaffContextValue = {
    staff,
    isOwner: staff?.rol === "owner",
    isReceptionist: staff?.rol === "receptionist",
    can: (permission) => (staff ? hasPermission(staff.rol, permission) : false),
  };

  return (
    <StaffContext.Provider value={value}>{children}</StaffContext.Provider>
  );
}

export function useStaff() {
  return useContext(StaffContext);
}

export function useCan(permission: Permission): boolean {
  const { can } = useStaff();
  return can(permission);
}
