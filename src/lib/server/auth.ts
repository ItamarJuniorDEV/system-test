import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseClient } from "./supabase";
import { hasSupabaseConfig, isLocalDemo } from "./config";

export type Role = "admin" | "commercial" | "operations" | "finance";
export type Viewer = {
  id: string;
  name: string;
  role: Role;
  active: boolean;
  demo: boolean;
};

export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (isLocalDemo()) {
    const { demoViewer } = await import("./demo");
    return demoViewer;
  }
  if (!hasSupabaseConfig()) return null;
  const supabase = await createSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id,name,role,active")
    .eq("id", user.id)
    .maybeSingle();
  if (
    !profile?.active ||
    !["admin", "commercial", "operations", "finance"].includes(profile.role)
  )
    return null;
  return { ...profile, demo: false } as Viewer;
});

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/entrar");
  return viewer;
}

export function can(viewer: Viewer, ...roles: Role[]): boolean {
  return viewer.role === "admin" || roles.includes(viewer.role);
}
