"use server";

import { redirect } from "next/navigation";
import { createSupabaseClient } from "@/lib/server/supabase";
import { hasSupabaseConfig, isLocalDemo } from "@/lib/server/config";

export async function signIn(form: FormData): Promise<{ error?: string }> {
  if (!hasSupabaseConfig())
    return {
      error:
        "Configure o Supabase antes de entrar. Você também pode iniciar a demonstração local pelo terminal.",
    };
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password || email.length > 254 || password.length > 200)
    return { error: "Informe seu e-mail e sua senha." };
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.user)
    return { error: "Não foi possível entrar. Confira os dados de acesso." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("active")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!profile?.active) {
    await supabase.auth.signOut();
    return {
      error:
        "Seu usuário precisa de um perfil ativo. Solicite a liberação ao administrador da loja.",
    };
  }
  redirect("/");
}

export async function signOut() {
  if (isLocalDemo()) redirect("/entrar?demo=1");
  if (hasSupabaseConfig()) {
    const supabase = await createSupabaseClient();
    await supabase.auth.signOut();
  }
  redirect("/entrar");
}
