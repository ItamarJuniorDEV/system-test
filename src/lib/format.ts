const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const quantities = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 });

export function brl(cents: number | string | null | undefined): string {
  return money.format(Number(cents ?? 0) / 100);
}

export function quantity(value: number | string | null | undefined): string {
  return quantities.format(Number(value ?? 0));
}

export function date(value: string | null | undefined, time = false): string {
  if (!value) return "—";
  const d = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(d.getTime())) return "Data inválida";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(time ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(d);
}

/** Entrada monetária em pt-BR: sem arredondamento e sem inferir separador. */
export function parseMoney(value: string): number {
  const text = value.trim();
  if (
    !/^(?:0|[1-9]\d{0,10}|[1-9]\d{0,2}(?:\.\d{3}){1,3})(?:,\d{1,2})?$/.test(
      text,
    )
  ) {
    throw new Error(
      "Informe um valor como 1250,00 ou 1.250,00, com até duas casas decimais.",
    );
  }
  const [whole, fraction = ""] = text.replaceAll(".", "").split(",");
  const result = Number(BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0")));
  if (!Number.isSafeInteger(result) || result > 9_999_999_999_999)
    throw new Error("Valor acima do limite permitido.");
  return result;
}

export const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  proposal: "Em negociação",
  lead: "Em atendimento",
  active: "Ativo",
  accepted: "Aceito",
  contracted: "Contratado",
  execution: "Em execução",
  completed: "Concluído",
  cancelled: "Cancelado",
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Reprovado",
  open: "Em aberto",
  forecast: "Previsão",
  paid: "Liquidado",
  partial: "Parcial",
  settled: "Liquidado",
  sent: "Enviado",
  received: "Recebido",
  scheduled: "Agendado",
  in_progress: "Em andamento",
  done: "Concluído",
  resolved: "Resolvido",
  closed: "Encerrado",
  receivable: "A receber",
  payable: "A pagar",
  signature: "Assinatura",
  commercial: "Comercial",
  financial: "Financeiro",
  admin: "Administrador",
  operations: "Operação",
  finance: "Financeiro",
  delivery: "Entrega",
  assembly: "Montagem",
  customer: "Cliente",
  store: "Loja",
  factory: "Fábrica",
  carrier: "Transportadora",
  blocked: "Com diferenças",
  superseded: "Substituída",
  partially_received: "Recebido parcialmente",
  partially_paid: "Baixa parcial",
  fulfilled: "Atendida",
  released: "Liberada",
  receipt: "Recebimento",
  reserve: "Reserva",
  release: "Liberação",
};
export function label(value: string) {
  return STATUS_LABELS[value] ?? value;
}
