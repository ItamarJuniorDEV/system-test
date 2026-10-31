"use client";
import { useState, useTransition } from "react";
import { signIn } from "@/app/auth-actions";
import { Button } from "./ui/button";
import { Field } from "./ui/primitives";

export function LoginForm() {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        start(async () => {
          const result = await signIn(data);
          setError(result.error ?? "");
        });
      }}
    >
      <Field label="E-mail">
        <input
          name="email"
          type="email"
          autoComplete="username"
          placeholder="voce@loja.com.br"
          required
        />
      </Field>
      <Field label="Senha">
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>
      {error && (
        <div role="alert" className="form-message form-error">
          {error}
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Entrando…" : "Entrar na loja"}
      </Button>
      <p className="helper">
        Acesso liberado pelo administrador da loja. O login utiliza o Supabase
        Auth.
      </p>
    </form>
  );
}
