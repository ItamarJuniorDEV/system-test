"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="empty">
      <h1>Não foi possível abrir esta tela</h1>
      <p>
        Confira a conexão com o Supabase e se as migrações foram aplicadas. Seus
        registros não foram alterados por esta consulta.
      </p>
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  );
}
