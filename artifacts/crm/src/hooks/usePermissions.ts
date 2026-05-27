import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getSettings, DEFAULT_PERMISSIONS, RolePermissions, ModuleKey } from "@/lib/firestore";

export function usePermissions() {
  const { user } = useAuth();
  const [rolePermissions, setRolePermissions] = useState<RolePermissions | null>(null);

  useEffect(() => {
    if (!user?.companyId) return;
    getSettings(user.companyId).then((s) => {
      setRolePermissions(s?.rolePermissions ?? null);
    });
  }, [user?.companyId]);

  function canAccess(module: ModuleKey): boolean {
    const role = user?.role;
    if (!role || role === "owner") return true;
    const roleKey = role as keyof RolePermissions;
    if (!(roleKey in DEFAULT_PERMISSIONS)) return false;
    const defaults = DEFAULT_PERMISSIONS[roleKey];
    const custom = rolePermissions?.[roleKey];
    return custom ? (custom[module] ?? defaults[module] ?? false) : (defaults[module] ?? false);
  }

  const isTechnician = user?.role === "technician";
  const isOwner = user?.role === "owner";
  const isAdmin = user?.role === "admin" || isOwner;
  const isManager = user?.role === "manager" || isAdmin;

  return { canAccess, isTechnician, isOwner, isAdmin, isManager, rolePermissions };
}
