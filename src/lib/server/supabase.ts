import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { hasSupabaseConfig } from "./config";

export async function createSupabaseClient() {
  if (!hasSupabaseConfig())
    throw new Error(
      "Configure a URL e a chave publicável do Supabase em .env.local.",
    );
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(values) {
          try {
            values.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* Server Components não gravam cookies; proxy atualiza a sessão. */
          }
        },
      },
    },
  );
}

/** Somente para a persistência do XML já interpretado no servidor. Nunca enviar esta chave ao navegador. */
export function createTrustedImportClient() {
  if (!hasSupabaseConfig())
    throw new Error("Configure o projeto Supabase no servidor.");
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key)
    throw new Error(
      "A importação precisa da SUPABASE_SECRET_KEY configurada exclusivamente no servidor. Consulte a instalação no README.",
    );
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
