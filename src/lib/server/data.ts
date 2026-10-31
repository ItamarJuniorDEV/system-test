import "server-only";
import { requireViewer } from "./auth";
import { isLocalDemo } from "./config";
import { createSupabaseClient, createTrustedImportClient } from "./supabase";

export const TABLES = [
  "profiles",
  "customers",
  "suppliers",
  "projects",
  "environments",
  "environment_versions",
  "budgets",
  "budget_items",
  "contracts",
  "technical_reviews",
  "purchase_orders",
  "purchase_order_items",
  "inventory_items",
  "stock_balances",
  "stock_movements",
  "stock_reservations",
  "appointments",
  "assistance_tickets",
  "assistance_occurrences",
  "financial_titles",
  "settlements",
  "settlement_reversals",
  "audit_events",
] as const;
export type TableName = (typeof TABLES)[number];
export type QueryOptions = {
  filters?: Record<string, string | number>;
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
  offset?: number;
  columns?: string;
};

/** Tabelas e campos são definidos no servidor. Não expor esta função como Server Action. */
export async function list<T>(
  table: TableName,
  options: QueryOptions = {},
): Promise<T[]> {
  await requireViewer();
  if (!TABLES.includes(table)) throw new Error("Consulta não permitida.");
  if (isLocalDemo()) {
    const { demoList } = await import("./demo");
    return demoList<T>(table, options);
  }
  const supabase = await createSupabaseClient();
  let query = supabase.from(table).select(options.columns ?? "*");
  for (const [key, value] of Object.entries(options.filters ?? {}))
    query = query.eq(key, value);
  const orderBy =
    options.orderBy ??
    (table === "stock_balances" ? "updated_at" : "created_at");
  query = query.order(orderBy, { ascending: options.ascending ?? false });
  const identity = table === "stock_balances" ? "inventory_item_id" : "id";
  if (orderBy !== identity) query = query.order(identity, { ascending: true });
  const offset = options.offset ?? 0;
  const { data, error } = await query.range(
    offset,
    offset + Math.min(options.limit ?? 500, 1000) - 1,
  );
  if (error)
    throw new Error(
      `Não foi possível consultar os registros de ${table}. Confira a configuração do banco e as permissões.`,
    );
  return (data ?? []) as unknown as T[];
}

/** Coleções filhas precisam ser completas para conferência, sem truncar os itens silenciosamente. */
export async function listAll<T>(
  table: TableName,
  options: Omit<QueryOptions, "limit" | "offset"> = {},
): Promise<T[]> {
  const result: T[] = [];
  for (let offset = 0; offset <= 10000; offset += 1000) {
    const page = await list<T>(table, { ...options, limit: 1000, offset });
    result.push(...page);
    if (result.length > 10000)
      throw new Error(
        "A coleção excede 10.000 registros. Divida a conferência por ambiente.",
      );
    if (page.length < 1000) return result;
  }
  return result;
}

export async function one<T>(table: TableName, id: string): Promise<T | null> {
  const rows = await list<T>(table, { filters: { id }, limit: 1 });
  return rows[0] ?? null;
}

export type RpcResult = {
  id?: string;
  duplicate?: boolean;
  orders?: { id: string }[];
  [key: string]: unknown;
};
export async function rpc(
  name: string,
  args: Record<string, unknown>,
): Promise<RpcResult> {
  await requireViewer();
  if (!/^[a-z][a-z_]+$/.test(name)) throw new Error("Operação inválida.");
  if (isLocalDemo()) {
    const { demoRpc } = await import("./demo");
    return demoRpc(name, args);
  }
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    if (error.code === "42501")
      throw new Error("Seu perfil não tem permissão para esta operação.");
    if (error.code === "23505")
      throw new Error(
        "Este registro já existe. Atualize a tela para conferir.",
      );
    if (error.code === "23503")
      throw new Error(
        "Um dos registros selecionados não existe ou já não está disponível.",
      );
    if (
      error.code === "P0001" ||
      error.code === "22023" ||
      error.code === "23514"
    )
      throw new Error(error.message);
    throw new Error(
      "A operação não foi concluída. Atualize a tela e confira os dados antes de tentar novamente.",
    );
  }
  return data as RpcResult;
}

/** Fronteira confiável: só recebe o snapshot reparsed pela Server Action, nunca uma prévia do cliente. */
export async function persistVerifiedXml(args: {
  p_environment_id: string;
  p_file_name: string;
  p_raw_xml: string;
  p_sha256: string;
  p_snapshot: unknown;
}): Promise<RpcResult> {
  const actor = await requireViewer();
  if (isLocalDemo()) {
    const { demoVerifiedImport } = await import("./demo");
    return demoVerifiedImport(actor.id, args);
  }
  const client = createTrustedImportClient();
  const { data, error } = await client.rpc(
    "import_environment_version_verified",
    { p_actor_id: actor.id, ...args },
  );
  if (error) {
    if (error.code === "42501")
      throw new Error("Seu perfil não tem permissão para importar versões.");
    if (
      error.code === "P0001" ||
      error.code === "22023" ||
      error.code === "23514"
    )
      throw new Error(error.message);
    throw new Error(
      "Não foi possível registrar o XML. Confira a chave privada do servidor e a migração de importação confiável.",
    );
  }
  return data as RpcResult;
}
