"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, CheckCircle2, AlertCircle } from "lucide-react";
import { executeCommand, type ActionResult } from "@/app/actions";
import { Button } from "./ui/button";

export function ActionForm({
  command,
  children,
  submitLabel = "Salvar",
  className = "",
  variant = "default",
  confirm,
  resetOnSuccess = false,
}: {
  command: string;
  children?: ReactNode;
  submitLabel?: string;
  className?: string;
  variant?: "default" | "outline" | "danger";
  confirm?: string;
  resetOnSuccess?: boolean;
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const requestId = useRef<string | null>(null);
  const router = useRouter();
  return (
    <form
      className={`action-form ${className}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (pending || (confirm && !window.confirm(confirm))) return;
        const element = event.currentTarget;
        const data = new FormData(element);
        requestId.current ??= crypto.randomUUID();
        data.set("requestId", requestId.current);
        startTransition(async () => {
          try {
            const response = await executeCommand(command, data);
            setResult(response);
            if (response.ok) {
              requestId.current = null;
              if (resetOnSuccess) element.reset();
              if (response.redirectTo) router.push(response.redirectTo);
              router.refresh();
            }
          } catch {
            setResult({
              ok: false,
              message:
                "A conexão foi interrompida. Tente novamente; a chave desta operação será preservada.",
            });
          }
        });
      }}
    >
      {children}
      {result && (
        <div
          role={result.ok ? "status" : "alert"}
          className={`form-message ${result.ok ? "form-success" : "form-error"}`}
        >
          {result.ok ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
          <span>{result.message}</span>
        </div>
      )}
      <div className="form-footer">
        <Button type="submit" disabled={pending} variant={variant}>
          {pending && <LoaderCircle size={15} className="spin" />}
          {pending ? "Registrando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
