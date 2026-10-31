import "server-only";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import type { QueryOptions, RpcResult, TableName } from "./data";
import { isLocalDemo } from "./config";
import type { Viewer } from "./auth";

export const demoViewer: Viewer = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Alex · demonstração",
  role: "admin",
  active: true,
  demo: true,
};
const globalForDemo = globalThis as unknown as {
  studioDemoDatabase?: Promise<PGlite>;
};

function ensureDemo() {
  if (!isLocalDemo())
    throw new Error("Banco de demonstração indisponível fora do modo local.");
}
function identifier(value: string) {
  if (!/^[a-z][a-z0-9_]*$/.test(value))
    throw new Error("Identificador de consulta inválido.");
  return `"${value}"`;
}
function param(key: string, value: unknown) {
  if (key === "p_environment_ids" && Array.isArray(value))
    return `{${value.join(",")}}`;
  return value !== null && typeof value === "object"
    ? JSON.stringify(value)
    : value;
}
async function call(
  tx: Transaction,
  name: string,
  args: Record<string, unknown>,
): Promise<RpcResult> {
  const entries = Object.entries(args);
  const names = entries
    .map(([key], index) => `${identifier(key)} => $${index + 1}`)
    .join(", ");
  const result = await tx.query<{ result: RpcResult }>(
    `select public.${identifier(name)}(${names}) as result`,
    entries.map(([key, value]) => param(key, value)),
  );
  return result.rows[0].result;
}

async function createDemoDatabase(): Promise<PGlite> {
  ensureDemo();
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  const root = process.cwd();
  await db.exec(
    await readFile(path.join(root, "supabase/tests/bootstrap.sql"), "utf8"),
  );
  const migrationDir = path.join(root, "supabase/migrations");
  for (const name of (await readdir(migrationDir))
    .filter((n) => n.endsWith(".sql"))
    .sort())
    await db.exec(await readFile(path.join(migrationDir, name), "utf8"));
  await db.query("insert into auth.users(id,email) values ($1,$2)", [
    demoViewer.id,
    "demo@example.invalid",
  ]);
  await db.query(
    "update public.profiles set name=$2, role='admin',active=true where id=$1",
    [demoViewer.id, demoViewer.name],
  );
  await db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      demoViewer.id,
    ]);
    await tx.exec("set local role authenticated");
    const supplier = await call(tx, "upsert_supplier", {
      p_data: {
        name: "Forma Móveis · fictício",
        email: "contato@example.invalid",
        lead_days: 35,
      },
    });
    const customer = await call(tx, "upsert_customer", {
      p_data: {
        name: "Marina Alves · fictícia",
        email: "marina@example.invalid",
        phone: "(00) 00000-0000",
        notes: "Cadastro fictício para demonstração local.",
      },
    });
    const project = await call(tx, "create_project", {
      p_customer_id: customer.id,
      p_name: "Apartamento Jardim · demonstração",
    });
    for (const [name, code, description, cost, sale, count] of [
      ["Cozinha", "COZ-001", "Módulo de cozinha · exemplo", 125000, 210000, 3],
      ["Suíte", "SUI-001", "Módulo de roupeiro · exemplo", 180000, 295000, 2],
    ] as const) {
      const environment = await call(tx, "create_environment", {
        p_project_id: project.id,
        p_supplier_id: supplier.id,
        p_name: name,
      });
      const rawXml = `<?xml version="1.0" encoding="UTF-8"?><demo><environment>${name}</environment><code>${code}</code></demo>`;
      await tx.exec("set local role service_role");
      await call(tx, "import_environment_version_verified", {
        p_actor_id: demoViewer.id,
        p_environment_id: environment.id,
        p_file_name: "seed-sintetico.xml",
        p_raw_xml: rawXml,
        p_sha256: createHash("sha256").update(rawXml).digest("hex"),
        p_snapshot: {
          name,
          items: [
            {
              code,
              description,
              quantity: count,
              unit: "UN",
              costCents: cost,
              saleCents: sale,
            },
          ],
          source:
            "Semente sintética de demonstração, sem compatibilidade Promob declarada.",
        },
      });
      await tx.exec("set local role authenticated");
    }
    await call(tx, "upsert_customer", {
      p_data: {
        name: "Rafael Lima · fictício",
        email: "rafael@example.invalid",
      },
    });
    await call(tx, "create_financial_title", {
      p_direction: "payable",
      p_description: "Aluguel da loja · demonstração",
      p_amount_cents: 350000,
      p_due_date: new Date().toISOString().slice(0, 10),
      p_customer_id: null,
      p_supplier_id: supplier.id,
    });
  });
  return db;
}

async function database() {
  ensureDemo();
  globalForDemo.studioDemoDatabase ??= createDemoDatabase();
  return globalForDemo.studioDemoDatabase;
}

export async function demoList<T>(
  table: TableName,
  options: QueryOptions,
): Promise<T[]> {
  const db = await database();
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      demoViewer.id,
    ]);
    await tx.exec("set local role authenticated");
    const entries = Object.entries(options.filters ?? {});
    const columns =
      !options.columns || options.columns === "*"
        ? "*"
        : options.columns
            .split(",")
            .map((s) => identifier(s.trim()))
            .join(",");
    const filters = entries.length
      ? ` where ${entries.map(([key], i) => `${identifier(key)} = $${i + 1}`).join(" and ")}`
      : "";
    const orderBy =
      options.orderBy ??
      (table === "stock_balances" ? "updated_at" : "created_at");
    const identity = table === "stock_balances" ? "inventory_item_id" : "id";
    const order = ` order by ${identifier(orderBy)} ${options.ascending ? "asc" : "desc"}${orderBy !== identity ? `, ${identifier(identity)} asc` : ""}`;
    const limit = Math.min(options.limit ?? 500, 1000);
    const offset = options.offset ?? 0;
    if (!Number.isSafeInteger(offset) || offset < 0)
      throw new Error("Página inválida.");
    const result = await tx.query<T>(
      `select ${columns} from public.${identifier(table)}${filters}${order} limit ${limit} offset ${offset}`,
      entries.map(([, value]) => value),
    );
    return JSON.parse(
      JSON.stringify(result.rows, (_, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    ) as T[];
  });
}

export async function demoRpc(
  name: string,
  args: Record<string, unknown>,
): Promise<RpcResult> {
  const db = await database();
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      demoViewer.id,
    ]);
    await tx.exec("set local role authenticated");
    return call(tx, name, args);
  });
}

export async function demoVerifiedImport(
  actorId: string,
  args: Record<string, unknown>,
): Promise<RpcResult> {
  const db = await database();
  return db.transaction(async (tx) => {
    await tx.exec("set local role service_role");
    return call(tx, "import_environment_version_verified", {
      p_actor_id: actorId,
      ...args,
    });
  });
}
