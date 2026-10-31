import "server-only";

export function isLocalDemo(): boolean {
  if (process.env.ERP_LOCAL_DEMO !== "1") return false;
  if (process.env.NODE_ENV === "production")
    throw new Error(
      "A demonstração local está bloqueada em produção. Remova ERP_LOCAL_DEMO.",
    );
  return true;
}

export function hasSupabaseConfig(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
