import { Badge, Notice, PageHeader, Section } from "@/components/ui/primitives";
import { label } from "@/lib/format";

export const LIST_LIMIT = 500;
export const FINANCIAL_HISTORY_LIMIT = 50;

const extraLabels: Record<string, string> = {
  partially_received: "Recebimento parcial",
  partially_paid: "Baixa parcial",
  fulfilled: "Atendida",
  released: "Liberada",
  blocked: "Bloqueada",
  superseded: "Substituída",
  receipt: "Recebimento",
  reserve: "Reserva",
  release: "Liberação",
  manual: "Manual",
  contract: "Contrato",
  purchase_order: "Pedido de compra",
};

export function operationLabel(value: string): string {
  return extraLabels[value] ?? label(value);
}

export function OperationBadge({ value }: { value: string }) {
  const tone =
    value === "partially_received" || value === "partially_paid"
      ? "partial"
      : value === "fulfilled"
        ? "completed"
        : value === "released" || value === "superseded"
          ? "cancelled"
          : value;
  return <Badge value={tone}>{operationLabel(value)}</Badge>;
}

export function QueryLimit({
  count,
  limit = LIST_LIMIT,
  subject = "registros",
  indicators = true,
}: {
  count: number;
  limit?: number;
  subject?: string;
  indicators?: boolean;
}) {
  if (count >= limit) {
    return (
      <Notice tone="warning">
        Exibindo o limite de {limit} {subject}. Pode haver outros registros fora
        desta consulta.
        {indicators &&
          " Os indicadores desta tela consideram apenas o recorte exibido."}
      </Notice>
    );
  }
  return (
    <p className="helper">
      {count} {subject} nesta consulta · limite de {limit}.
      {indicators && " Os indicadores consideram o recorte exibido."}
    </p>
  );
}

export function ReadOnlyNotice() {
  return (
    <Notice>
      Seu perfil pode consultar os registros. Para registrar esta operação, é
      necessário um perfil de Operação ou Administrador.
    </Notice>
  );
}

export function FinanceAccessNotice() {
  return (
    <>
      <PageHeader
        eyebrow="Controle da loja"
        title="Financeiro"
        description="Títulos, baixas e estornos com acesso por perfil."
      />
      <Section title="Acesso restrito ao financeiro">
        <Notice>
          Seu perfil não tem acesso aos dados financeiros. Solicite ao
          administrador um perfil Financeiro ou Administrador, se essa atividade
          fizer parte da sua função.
        </Notice>
      </Section>
    </>
  );
}

export function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function quantityRemainder(
  total: string | number,
  used: string | number,
): number {
  return Math.max(
    0,
    Math.round((Number(total) - Number(used)) * 10_000) / 10_000,
  );
}

export function saoPauloToday(): string {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function moneyFieldValue(cents: string | number): string {
  return (Number(cents) / 100).toFixed(2).replace(".", ",");
}
