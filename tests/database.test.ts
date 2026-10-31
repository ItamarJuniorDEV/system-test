import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const actors = {
  admin: "10000000-0000-4000-8000-000000000001",
  commercial: "10000000-0000-4000-8000-000000000002",
  operations: "10000000-0000-4000-8000-000000000003",
  finance: "10000000-0000-4000-8000-000000000004",
  inactive: "10000000-0000-4000-8000-000000000005",
};
type Actor = keyof typeof actors;
type Result = { id: string; [key: string]: unknown }; // PostgreSQL JSON RPC boundary, checked per scenario.
let db: PGlite;

async function rpc(
  name: string,
  args: Record<string, unknown> = {},
  actor: Actor = "admin",
  sqlRole: "authenticated" | "service_role" = "authenticated",
): Promise<Result> {
  if (
    !/^[a-z_]+$/.test(name) ||
    Object.keys(args).some((key) => !/^p_[a-z0-9_]+$/.test(key))
  ) {
    throw new Error("Invalid test RPC identifier");
  }
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [
      sqlRole === "service_role" ? "" : actors[actor],
    ]);
    const claims = JSON.stringify(sqlRole === "service_role"
      ? { role: "service_role" }
      : { role: "authenticated", sub: actors[actor] });
    await tx.query("select set_config('request.jwt.claims', $1, true)", [claims]);
    await tx.exec(`set local role ${sqlRole}`);
    const keys = Object.keys(args);
    const values = keys.map((key) => {
      const value = args[key];
      if (key === "p_environment_ids" && Array.isArray(value))
        return `{${value.join(",")}}`;
      return value !== null && typeof value === "object"
        ? JSON.stringify(value)
        : value;
    });
    const result = await tx.query<{ result: Result }>(
      `select public.${name}(${keys.map((key, index) => `${key} => $${index + 1}`).join(", ")}) as result`,
      values,
    );
    if (sqlRole === "service_role") {
      const restored = await tx.query<{ sub: string; claims: string }>(
        "select current_setting('request.jwt.claim.sub') as sub, current_setting('request.jwt.claims') as claims",
      );
      expect(restored.rows[0]).toEqual({ sub: "", claims });
    }
    return result.rows[0].result;
  });
}

// Represents the trusted server AFTER XML parsing and verified Auth lookup.
// SQL fixtures supply parsed snapshots; parser correctness has its own test suite.
async function importVersion(args: Record<string, unknown>, actor: Actor = "admin") {
  return rpc("import_environment_version_verified", { p_actor_id: actors[actor], ...args }, actor, "service_role");
}

async function deliverAndAssemble(contractId: string) {
  for (const [kind, day] of [["delivery", "01"], ["assembly", "02"]]) {
    const appointment = await rpc("create_appointment", {
      p_contract_id: contractId, p_kind: kind,
      p_starts_at: `2026-11-${day}T09:00:00Z`, p_ends_at: `2026-11-${day}T10:00:00Z`,
    }, "operations");
    await rpc("complete_appointment", { p_appointment_id: appointment.id }, "operations");
  }
}

async function scalar(sql: string, values: unknown[] = []): Promise<unknown> {
  const result = await db.query(sql, values);
  return Object.values(result.rows[0] as Record<string, unknown>)[0];
}

function importArgs(
  environmentId: string,
  suffix = "v1",
  price = 1500,
  extra: Record<string, unknown> = {},
) {
  const xml = `<project version="${suffix}"><item code="CAB-1" quantity="2"/></project>`;
  return {
    p_environment_id: environmentId,
    p_file_name: `${suffix}.xml`,
    p_raw_xml: xml,
    p_sha256: createHash("sha256").update(xml).digest("hex"),
    p_snapshot: {
      name: "Cozinha",
      items: [
        {
          code: "CAB-1",
          description: "Armário",
          quantity: 2,
          unit: "UN",
          costCents: 1000,
          saleCents: price,
          metadata: {},
        },
      ],
      ...extra,
    },
  };
}

async function projectFixture(options: { variants?: boolean; supplierId?: string } = {}) {
  const customer = await rpc(
    "upsert_customer",
    { p_data: { name: "Cliente de teste" } },
    "commercial",
  );
  const supplier = options.supplierId ? { id: options.supplierId } : await rpc(
    "upsert_supplier",
    { p_data: { name: "Fornecedor de teste" } },
    "operations",
  );
  const project = await rpc(
    "create_project",
    { p_customer_id: customer.id, p_name: "Projeto de teste" },
    "commercial",
  );
  const environment = await rpc(
    "create_environment",
    { p_project_id: project.id, p_supplier_id: supplier.id, p_name: "Cozinha" },
    "commercial",
  );
  const imported = importArgs(environment.id);
  if (options.variants) {
    imported.p_snapshot.items = [
      {
        ...imported.p_snapshot.items[0],
        quantity: 1,
        metadata: { height: "18" },
      },
      {
        ...imported.p_snapshot.items[0],
        quantity: 1,
        metadata: { height: "20" },
      },
    ];
  }
  const version = await importVersion(imported,
    "commercial",
  );
  const budget = await rpc(
    "create_budget",
    {
      p_project_id: project.id,
      p_name: "Proposta 1",
      p_environment_ids: [environment.id],
    },
    "commercial",
  );
  const contract = await rpc(
    "create_contract",
    { p_budget_id: budget.id },
    "commercial",
  );
  return {
    customer,
    supplier,
    project,
    environment,
    version,
    budget,
    contract,
  };
}

async function approveContract(contractId: string) {
  await rpc(
    "set_contract_approval",
    { p_contract_id: contractId, p_approval: "signature", p_approved: true },
    "commercial",
  );
  await rpc(
    "set_contract_approval",
    { p_contract_id: contractId, p_approval: "commercial", p_approved: true },
    "commercial",
  );
  await rpc(
    "set_contract_approval",
    { p_contract_id: contractId, p_approval: "financial", p_approved: true },
    "finance",
  );
}

async function purchaseFixture(options: { supplierId?: string } = {}) {
  const f = await projectFixture(options);
  await approveContract(f.contract.id);
  const review = await rpc(
    "start_technical_review",
    { p_contract_id: f.contract.id },
    "operations",
  );
  await rpc(
    "complete_technical_review",
    { p_review_id: review.id },
    "operations",
  );
  const order = await rpc(
    "create_purchase_order",
    { p_review_id: review.id },
    "operations",
  );
  await rpc("send_purchase_order", { p_order_id: order.id }, "operations");
  const line = (
    await db.query<{ id: string; inventory_item_id: string }>(
      "select id, inventory_item_id from purchase_order_items where purchase_order_id=$1 order by id",
      [order.id],
    )
  ).rows[0];
  return { ...f, review, order, line };
}

beforeEach(async () => {
  db = new PGlite();
  await db.exec(
    await readFile(resolve("supabase/tests/bootstrap.sql"), "utf8"),
  );
  const migrations = (await readdir(resolve("supabase/migrations")))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of migrations)
    await db.exec(await readFile(resolve("supabase/migrations", file), "utf8"));
  for (const [role, id] of Object.entries(actors)) {
    await db.query("insert into auth.users (id, email) values ($1, $2)", [
      id,
      `${role}@example.test`,
    ]);
    await db.query(
      "update public.profiles set name = $1, role = $2, active = $3 where id = $4",
      [
        role,
        role === "inactive" ? "commercial" : role,
        role !== "inactive",
        id,
      ],
    );
  }
});

afterEach(async () => {
  if (db) await db.close();
});

describe("PostgreSQL core (PGlite with isolated Auth stub, not Supabase end-to-end)", () => {
  it("preserves imported versions and frozen budget/contract totals; re-imports are deterministic", async () => {
    const f = await projectFixture();
    expect(Number(f.budget.total_cents)).toBe(3000);
    const duplicate = await importVersion(importArgs(f.environment.id),
    );
    expect(duplicate.id).toBe(f.version.id);
    expect(duplicate.duplicate).toBe(true);
    const selection = await importVersion(importArgs(f.environment.id, "v1", 1500, { sourceEnvironmentIndex: 1 }),
    );
    expect(selection.id).not.toBe(f.version.id);
    expect(selection.version_number).toBe(2);
    await importVersion(importArgs(f.environment.id, "v2", 2100),
    );
    expect(
      Number(
        await scalar("select total_cents from budgets where id = $1", [
          f.budget.id,
        ]),
      ),
    ).toBe(3000);
    expect(
      Number(
        await scalar("select total_cents from contracts where id = $1", [
          f.contract.id,
        ]),
      ),
    ).toBe(3000);
    expect(
      (await rpc("create_contract", { p_budget_id: f.budget.id })).id,
    ).toBe(f.contract.id);
    expect(
      Number(
        await scalar(
          "select count(*) from financial_titles where contract_id=$1 and origin='contract'",
          [f.contract.id],
        ),
      ),
    ).toBe(1);
    await expect(
      db.query("update environment_versions set file_name = $1 where id = $2", [
        "edited.xml",
        f.version.id,
      ]),
    ).rejects.toThrow(/imutável/i);
    await expect(
      db.query("delete from budget_items where budget_id=$1", [f.budget.id]),
    ).rejects.toThrow(/imutável/i);
  });

  it("validates XML hashes and rejects invalid money/quantity without creating a version", async () => {
    const f = await projectFixture();
    await expect(
      importVersion({
        ...importArgs(f.environment.id, "bad"),
        p_sha256: "0".repeat(64),
      }),
    ).rejects.toThrow(/hash/i);
    const invalid = importArgs(f.environment.id, "bad");
    invalid.p_snapshot.items[0].quantity = -1;
    await expect(importVersion(invalid)).rejects.toThrow(
      /quantidade/i,
    );
    expect(
      Number(
        await scalar(
          "select count(*) from environment_versions where environment_id=$1",
          [f.environment.id],
        ),
      ),
    ).toBe(1);
  });

  it("requires an active profile and denies direct writes despite table visibility", async () => {
    await expect(
      rpc("upsert_customer", { p_data: { name: "Forbidden" } }, "inactive"),
    ).rejects.toThrow(/ativo|permissão/i);
    await expect(
      db.transaction(async (tx) => {
        await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [
          actors.commercial,
        ]);
        await tx.exec("set local role authenticated");
        await tx.exec("insert into customers(name) values ('Bypass')");
      }),
    ).rejects.toThrow(/permission denied/i);
  });

  it("separates approval powers and blocks changed executive versions until explicit administrative acceptance", async () => {
    const f = await projectFixture();
    await expect(
      rpc(
        "start_technical_review",
        { p_contract_id: f.contract.id },
        "operations",
      ),
    ).rejects.toThrow(/assinatura|aprovações/i);
    await expect(
      rpc(
        "set_contract_approval",
        {
          p_contract_id: f.contract.id,
          p_approval: "financial",
          p_approved: true,
        },
        "commercial",
      ),
    ).rejects.toThrow(/permissão/i);
    await approveContract(f.contract.id);
    await importVersion(importArgs(f.environment.id, "executive", 1600),
      "operations",
    );
    const review = await rpc(
      "start_technical_review",
      { p_contract_id: f.contract.id },
      "operations",
    );
    expect(review.status).toBe("blocked");
    expect(Number(review.difference_cents)).toBe(200);
    await expect(
      rpc("create_purchase_order", { p_review_id: review.id }, "operations"),
    ).rejects.toThrow(/revisão/i);
    await expect(
      rpc(
        "complete_technical_review",
        { p_review_id: review.id },
        "operations",
      ),
    ).rejects.toThrow(/diferença/i);
    await expect(
      rpc(
        "complete_technical_review",
        {
          p_review_id: review.id,
          p_accept_difference: true,
          p_reason: "Aceitar variação da revisão",
        },
        "operations",
      ),
    ).rejects.toThrow(/permissão/i);
    await rpc("complete_technical_review", {
      p_review_id: review.id,
      p_accept_difference: true,
      p_reason: "Margem revisada e aceita pelo administrador",
    });
    const order = await rpc(
      "create_purchase_order",
      { p_review_id: review.id },
      "operations",
    );
    expect(
      (
        await rpc(
          "create_purchase_order",
          { p_review_id: review.id },
          "operations",
        )
      ).id,
    ).toBe(order.id);
    expect(
      Number(
        await scalar(
          "select count(*) from financial_titles where purchase_order_id=$1",
          [order.id],
        ),
      ),
    ).toBe(1);
    expect(
      Number(
        await scalar("select total_cents from contracts where id=$1", [
          f.contract.id,
        ]),
      ),
    ).toBe(3000);
  });

  it("refuses approval of a stale executive snapshot and preserves the superseded review", async () => {
    const f = await projectFixture();
    await approveContract(f.contract.id);
    const first = await rpc(
      "start_technical_review",
      { p_contract_id: f.contract.id },
      "operations",
    );
    await importVersion(importArgs(f.environment.id, "newer"),
      "operations",
    );
    await expect(
      rpc("complete_technical_review", { p_review_id: first.id }, "operations"),
    ).rejects.toThrow(/desatualizada/i);
    const second = await rpc(
      "start_technical_review",
      { p_contract_id: f.contract.id },
      "operations",
    );
    expect(second.id).not.toBe(first.id);
    expect(
      await scalar("select status from technical_reviews where id=$1", [
        first.id,
      ]),
    ).toBe("superseded");
  });

  it("receives partially, rejects over-receipts, deduplicates commands and prevents over-reservation", async () => {
    const f = await purchaseFixture();
    const request = "20000000-0000-4000-8000-000000000001";
    const receive = {
      p_order_id: f.order.id,
      p_items: [{ itemId: f.line.id, quantity: 1 }],
      p_request_id: request,
    };
    expect(
      (await rpc("receive_purchase_order", receive, "operations")).status,
    ).toBe("partially_received");
    await rpc("receive_purchase_order", receive, "operations");
    expect(
      Number(
        await scalar(
          "select on_hand from stock_balances where inventory_item_id=$1",
          [f.line.inventory_item_id],
        ),
      ),
    ).toBe(1);
    await expect(
      rpc(
        "receive_purchase_order",
        { ...receive, p_items: [{ itemId: f.line.id, quantity: 2 }] },
        "operations",
      ),
    ).rejects.toThrow(/request_id/i);
    await expect(
      rpc(
        "receive_purchase_order",
        {
          ...receive,
          p_items: [{ itemId: f.line.id, quantity: 2 }],
          p_request_id: "20000000-0000-4000-8000-000000000002",
        },
        "operations",
      ),
    ).rejects.toThrow(/pendente|excede/i);
    const reserve = {
      p_contract_id: f.contract.id,
      p_items: [{ inventoryItemId: f.line.inventory_item_id, quantity: 1 }],
      p_request_id: "20000000-0000-4000-8000-000000000003",
    };
    const reservation = await rpc("reserve_stock", reserve, "operations");
    expect((await rpc("reserve_stock", reserve, "operations")).id).toBe(
      reservation.id,
    );
    await expect(
      rpc(
        "reserve_stock",
        { ...reserve, p_request_id: "20000000-0000-4000-8000-000000000004" },
        "operations",
      ),
    ).rejects.toThrow(/disponível/i);
    expect(
      Number(
        await scalar(
          "select reserved from stock_balances where inventory_item_id=$1",
          [f.line.inventory_item_id],
        ),
      ),
    ).toBe(1);
    expect(
      Number(
        await scalar(
          "select count(*) from stock_movements where kind='receipt'",
        ),
      ),
    ).toBe(1);
  });

  it("consumes only active reservations on partial delivery and requires full delivery before assembly", async () => {
    const f = await purchaseFixture();
    await rpc(
      "receive_purchase_order",
      {
        p_order_id: f.order.id,
        p_items: [{ itemId: f.line.id, quantity: 1 }],
        p_request_id: "30000000-0000-4000-8000-000000000001",
      },
      "operations",
    );
    await rpc(
      "reserve_stock",
      {
        p_contract_id: f.contract.id,
        p_items: [{ inventoryItemId: f.line.inventory_item_id, quantity: 1 }],
        p_request_id: "30000000-0000-4000-8000-000000000002",
      },
      "operations",
    );
    const delivery = await rpc(
      "create_appointment",
      {
        p_contract_id: f.contract.id,
        p_kind: "delivery",
        p_starts_at: "2026-11-01T09:00:00Z",
        p_ends_at: "2026-11-01T10:00:00Z",
      },
      "operations",
    );
    await expect(
      rpc(
        "create_appointment",
        {
          p_contract_id: f.contract.id,
          p_kind: "assembly",
          p_starts_at: "2026-11-01T09:30:00Z",
          p_ends_at: "2026-11-01T11:00:00Z",
        },
        "operations",
      ),
    ).rejects.toThrow(/conflito/i);
    const assembly = await rpc(
      "create_appointment",
      {
        p_contract_id: f.contract.id,
        p_kind: "assembly",
        p_starts_at: "2026-11-02T09:00:00Z",
        p_ends_at: "2026-11-02T10:00:00Z",
      },
      "operations",
    );
    await rpc(
      "complete_appointment",
      { p_appointment_id: delivery.id },
      "operations",
    );
    await rpc(
      "complete_appointment",
      { p_appointment_id: delivery.id },
      "operations",
    );
    expect(
      Number(
        await scalar(
          "select on_hand from stock_balances where inventory_item_id=$1",
          [f.line.inventory_item_id],
        ),
      ),
    ).toBe(0);
    expect(
      Number(
        await scalar(
          "select reserved from stock_balances where inventory_item_id=$1",
          [f.line.inventory_item_id],
        ),
      ),
    ).toBe(0);
    await expect(
      rpc(
        "complete_appointment",
        { p_appointment_id: assembly.id },
        "operations",
      ),
    ).rejects.toThrow(/entrega integral/i);
    await rpc(
      "receive_purchase_order",
      {
        p_order_id: f.order.id,
        p_items: [{ itemId: f.line.id, quantity: 1 }],
        p_request_id: "30000000-0000-4000-8000-000000000003",
      },
      "operations",
    );
    await rpc(
      "reserve_stock",
      {
        p_contract_id: f.contract.id,
        p_items: [{ inventoryItemId: f.line.inventory_item_id, quantity: 1 }],
        p_request_id: "30000000-0000-4000-8000-000000000004",
      },
      "operations",
    );
    const delivery2 = await rpc(
      "create_appointment",
      {
        p_contract_id: f.contract.id,
        p_kind: "delivery",
        p_starts_at: "2026-11-01T12:00:00Z",
        p_ends_at: "2026-11-01T13:00:00Z",
      },
      "operations",
    );
    await rpc(
      "complete_appointment",
      { p_appointment_id: delivery2.id },
      "operations",
    );
    await rpc(
      "complete_appointment",
      { p_appointment_id: assembly.id },
      "operations",
    );
    expect(
      await scalar("select status from contracts where id=$1", [f.contract.id]),
    ).toBe("completed");
    expect(
      Number(
        await scalar(
          "select count(*) from stock_movements where kind='delivery'",
        ),
      ),
    ).toBe(2);
  });

  it("supports assistance without a prior contract and closes only after every occurrence has a resolution", async () => {
    const f = await projectFixture();
    const ticket = await rpc(
      "open_assistance",
      {
        p_contract_id: null,
        p_customer_id: f.customer.id,
        p_title: "Ajuste de portas",
      },
      "operations",
    );
    const a = await rpc(
      "add_assistance_occurrence",
      {
        p_ticket_id: ticket.id,
        p_description: "Porta desalinhada",
        p_payer: "store",
      },
      "operations",
    );
    const b = await rpc(
      "add_assistance_occurrence",
      {
        p_ticket_id: ticket.id,
        p_description: "Dobradiça com defeito",
        p_payer: "factory",
      },
      "operations",
    );
    await expect(
      rpc("close_assistance", { p_ticket_id: ticket.id }, "operations"),
    ).rejects.toThrow(/ocorrências/i);
    await rpc(
      "resolve_assistance_occurrence",
      { p_occurrence_id: a.id, p_resolution: "Regulagem concluída" },
      "operations",
    );
    await expect(
      rpc("close_assistance", { p_ticket_id: ticket.id }, "operations"),
    ).rejects.toThrow(/ocorrências/i);
    await rpc(
      "resolve_assistance_occurrence",
      { p_occurrence_id: b.id, p_resolution: "Dobradiça substituída" },
      "operations",
    );
    expect(
      (await rpc("close_assistance", { p_ticket_id: ticket.id }, "operations"))
        .status,
    ).toBe("closed");
    await expect(
      rpc(
        "add_assistance_occurrence",
        {
          p_ticket_id: ticket.id,
          p_description: "Novo problema",
          p_payer: "customer",
        },
        "operations",
      ),
    ).rejects.toThrow(/encerrada/i);
  });

  it("settles partially and reverses once while retaining original financial history", async () => {
    const f = await projectFixture();
    const title = await rpc(
      "create_financial_title",
      {
        p_direction: "receivable",
        p_description: "Serviço avulso",
        p_amount_cents: 5000,
        p_due_date: "2026-12-01",
        p_customer_id: f.customer.id,
      },
      "finance",
    );
    expect(title.status).toBe("open");
    const paymentArgs = {
      p_title_id: title.id,
      p_amount_cents: 1500,
      p_paid_at: "2026-10-31",
      p_request_id: "40000000-0000-4000-8000-000000000001",
    };
    const payment = await rpc("settle_financial_title", paymentArgs, "finance");
    expect(
      (await rpc("settle_financial_title", paymentArgs, "finance")).id,
    ).toBe(payment.id);
    expect(
      await scalar("select status from financial_titles where id=$1", [
        title.id,
      ]),
    ).toBe("partially_paid");
    await expect(
      rpc(
        "settle_financial_title",
        {
          ...paymentArgs,
          p_amount_cents: 4000,
          p_request_id: "40000000-0000-4000-8000-000000000002",
        },
        "finance",
      ),
    ).rejects.toThrow(/saldo/i);
    await rpc(
      "settle_financial_title",
      {
        ...paymentArgs,
        p_amount_cents: 3500,
        p_request_id: "40000000-0000-4000-8000-000000000003",
      },
      "finance",
    );
    expect(
      await scalar("select status from financial_titles where id=$1", [
        title.id,
      ]),
    ).toBe("paid");
    const reversalArgs = {
      p_settlement_id: payment.id,
      p_reason: "Lançamento duplicado identificado",
      p_request_id: "40000000-0000-4000-8000-000000000004",
    };
    const reversal = await rpc("reverse_settlement", reversalArgs, "finance");
    expect((await rpc("reverse_settlement", reversalArgs, "finance")).id).toBe(
      reversal.id,
    );
    expect(
      (
        await rpc(
          "reverse_settlement",
          {
            ...reversalArgs,
            p_request_id: "40000000-0000-4000-8000-000000000005",
          },
          "finance",
        )
      ).id,
    ).toBe(reversal.id);
    expect(
      Number(
        await scalar("select balance_cents from financial_titles where id=$1", [
          title.id,
        ]),
      ),
    ).toBe(1500);
    expect(
      Number(
        await scalar(
          "select count(*) from settlements where financial_title_id=$1",
          [title.id],
        ),
      ),
    ).toBe(2);
    expect(
      Number(
        await scalar(
          "select count(*) from settlement_reversals where settlement_id=$1",
          [payment.id],
        ),
      ),
    ).toBe(1);
    await expect(db.exec("delete from settlements")).rejects.toThrow(
      /imutável/i,
    );
  });

  it("rejects cancelling paid contracts until reversal and preserves cancelled financial records", async () => {
    const f = await projectFixture();
    await approveContract(f.contract.id);
    const titleId = String(
      await scalar(
        "select id from financial_titles where contract_id=$1 and origin='contract'",
        [f.contract.id],
      ),
    );
    const payment = await rpc(
      "settle_financial_title",
      {
        p_title_id: titleId,
        p_amount_cents: 500,
        p_paid_at: "2026-10-31",
        p_request_id: "50000000-0000-4000-8000-000000000001",
      },
      "finance",
    );
    const cancelArgs = {
      p_contract_id: f.contract.id,
      p_reason: "Cliente desistiu antes da compra",
      p_request_id: "50000000-0000-4000-8000-000000000002",
    };
    await expect(
      rpc("cancel_contract", cancelArgs, "commercial"),
    ).rejects.toThrow(/pagamentos|baixas/i);
    await rpc(
      "reverse_settlement",
      {
        p_settlement_id: payment.id,
        p_reason: "Estorno para cancelar o contrato",
        p_request_id: "50000000-0000-4000-8000-000000000003",
      },
      "finance",
    );
    expect(
      (await rpc("cancel_contract", cancelArgs, "commercial")).status,
    ).toBe("cancelled");
    expect((await rpc("cancel_contract", cancelArgs, "commercial")).id).toBe(
      f.contract.id,
    );
    expect(
      await scalar("select status from financial_titles where id=$1", [
        titleId,
      ]),
    ).toBe("cancelled");
    expect(
      Number(
        await scalar(
          "select count(*) from settlements where financial_title_id=$1",
          [titleId],
        ),
      ),
    ).toBe(1);
  });

  it("requires a new review after cancelling purchase orders and blocks cancellation after receiving", async () => {
    const f = await purchaseFixture();
    const cancel = {
      p_order_id: f.order.id,
      p_reason: "Fornecedor solicitou reemissão do pedido",
      p_request_id: "60000000-0000-4000-8000-000000000001",
    };
    expect(
      (await rpc("cancel_purchase_order", cancel, "operations")).status,
    ).toBe("cancelled");
    await expect(
      rpc("create_purchase_order", { p_review_id: f.review.id }, "operations"),
    ).rejects.toThrow(/cancelados/i);
    const review = await rpc(
      "start_technical_review",
      { p_contract_id: f.contract.id },
      "operations",
    );
    expect(review.id).not.toBe(f.review.id);
    await rpc(
      "complete_technical_review",
      { p_review_id: review.id },
      "operations",
    );
    const replacement = await rpc(
      "create_purchase_order",
      { p_review_id: review.id },
      "operations",
    );
    expect(replacement.id).not.toBe(f.order.id);
    await rpc(
      "send_purchase_order",
      { p_order_id: replacement.id },
      "operations",
    );
    const lineId = String(
      await scalar(
        "select id from purchase_order_items where purchase_order_id=$1 limit 1",
        [replacement.id],
      ),
    );
    await rpc(
      "receive_purchase_order",
      {
        p_order_id: replacement.id,
        p_items: [{ itemId: lineId, quantity: 1 }],
        p_request_id: "60000000-0000-4000-8000-000000000002",
      },
      "operations",
    );
    await expect(
      rpc(
        "cancel_purchase_order",
        {
          ...cancel,
          p_order_id: replacement.id,
          p_request_id: "60000000-0000-4000-8000-000000000003",
        },
        "operations",
      ),
    ).rejects.toThrow(/recebimento|recebidos/i);
    await expect(
      rpc("cancel_contract", {
        p_contract_id: f.contract.id,
        p_reason: "Cancelar com estoque já recebido",
        p_request_id: "60000000-0000-4000-8000-000000000004",
      }),
    ).rejects.toThrow(/recebimento|recebidos/i);
  });

  it("restricts financial visibility and preserves at least one active administrator", async () => {
    const f = await projectFixture();
    const visible = await db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [
        actors.commercial,
      ]);
      await tx.exec("set local role authenticated");
      return tx.query("select id from financial_titles");
    });
    expect(visible.rows).toHaveLength(0);
    await expect(
      rpc("set_user_profile", {
        p_user_id: actors.admin,
        p_name: "Admin",
        p_role: "admin",
        p_active: false,
      }),
    ).rejects.toThrow(/auto-desativação/i);
    await expect(
      rpc("set_user_profile", {
        p_user_id: actors.admin,
        p_name: "Admin",
        p_role: "finance",
        p_active: true,
      }),
    ).rejects.toThrow(/último administrador/i);
    await expect(
      rpc(
        "set_user_profile",
        {
          p_user_id: actors.operations,
          p_name: "Ops",
          p_role: "admin",
          p_active: true,
        },
        "commercial",
      ),
    ).rejects.toThrow(/permissão/i);
    await rpc("set_user_profile", {
      p_user_id: actors.operations,
      p_name: "Segundo administrador",
      p_role: "admin",
      p_active: true,
    });
    await rpc(
      "set_user_profile",
      {
        p_user_id: actors.admin,
        p_name: "Financeiro",
        p_role: "finance",
        p_active: true,
      },
      "operations",
    );
    expect(
      Number(
        await scalar(
          "select count(*) from profiles where active and role='admin'",
        ),
      ),
    ).toBe(1);
    expect(f.contract.id).toBeTruthy();
  });

  it("keeps dimensional variants separate and rolls back an entire invalid receipt batch", async () => {
    const f = await projectFixture({ variants: true });
    await approveContract(f.contract.id);
    const review = await rpc("start_technical_review", {
      p_contract_id: f.contract.id,
    });
    await rpc("complete_technical_review", { p_review_id: review.id });
    const order = await rpc("create_purchase_order", {
      p_review_id: review.id,
    });
    await rpc("send_purchase_order", { p_order_id: order.id });
    expect(
      Number(
        await scalar(
          "select count(distinct inventory_item_id) from purchase_order_items where purchase_order_id=$1",
          [order.id],
        ),
      ),
    ).toBe(2);
    const lines = (
      await db.query<{ id: string }>(
        "select id from purchase_order_items where purchase_order_id=$1 order by inventory_item_id,id",
        [order.id],
      )
    ).rows;
    const args = {
      p_order_id: order.id,
      p_items: [
        { itemId: lines[0].id, quantity: 1 },
        { itemId: lines[1].id, quantity: 2 },
      ],
      p_request_id: "70000000-0000-4000-8000-000000000001",
    };
    await expect(rpc("receive_purchase_order", args)).rejects.toThrow(
      /pendente/i,
    );
    expect(
      Number(await scalar("select sum(on_hand) from stock_balances")),
    ).toBe(0);
    expect(
      Number(
        await scalar(
          "select count(*) from stock_movements where kind='receipt'",
        ),
      ),
    ).toBe(0);
    expect(
      Number(
        await scalar(
          "select count(*) from command_receipts where request_id=$1",
          [args.p_request_id],
        ),
      ),
    ).toBe(0);
    args.p_items[1].quantity = 1;
    expect((await rpc("receive_purchase_order", args)).status).toBe("received");
  });

  it("preserves a UTF-8 BOM in the auditable XML and hashes the original bytes", async () => {
    const f = await projectFixture();
    const args = importArgs(f.environment.id, "bom");
    args.p_raw_xml = `\uFEFF${args.p_raw_xml}`;
    args.p_sha256 = createHash("sha256").update(args.p_raw_xml).digest("hex");
    const version = await importVersion(args);
    // PGlite's text decoder strips a leading BOM on an individual returned text column.
    // Verify bytes inside Postgres instead of confusing transport decoding with storage.
    expect(
      await scalar(
        "select encode(convert_to(raw_xml,'UTF8'),'hex') from environment_versions where id=$1",
        [version.id],
      ),
    ).toBe(Buffer.from(args.p_raw_xml).toString("hex"));
    expect(version.sha256).toBe(args.p_sha256);
  });

  it("protects frozen commercial and financial values even from accidental administrative SQL", async () => {
    const f = await projectFixture();
    await expect(
      db.query("update budgets set total_cents=4000 where id=$1", [
        f.budget.id,
      ]),
    ).rejects.toThrow(/imutável/i);
    await expect(
      db.query("update contracts set total_cents=4000 where id=$1", [
        f.contract.id,
      ]),
    ).rejects.toThrow(/imutável/i);
    await expect(
      db.query(
        "update financial_titles set amount_cents=4000 where contract_id=$1",
        [f.contract.id],
      ),
    ).rejects.toThrow(/imutável/i);
  });

  it("revokes anonymous RPC execution even when the platform starts with permissive default grants", async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.exec("set local role anon");
        await tx.query("select public.upsert_customer($1::jsonb)", [
          JSON.stringify({ name: "Anonymous" }),
        ]);
      }),
    ).rejects.toThrow(/permission denied for function/i);
  });

  it("rejects user-authored XML snapshots and rechecks the verified import actor", async () => {
    const f = await projectFixture();
    const injected = { ...importArgs(f.environment.id, "injected"), p_raw_xml: "<x/>" };
    injected.p_sha256 = createHash("sha256").update(injected.p_raw_xml).digest("hex");
    await expect(rpc("import_environment_version", injected, "commercial"))
      .rejects.toThrow(/permission denied for function/i);
    await expect(rpc("import_environment_version_verified", { p_actor_id: actors.admin, ...injected }, "commercial"))
      .rejects.toThrow(/permission denied for function/i);
    await expect(importVersion(importArgs(f.environment.id, "finance"), "finance"))
      .rejects.toThrow(/ativo|permissão/i);
    await expect(importVersion(importArgs(f.environment.id, "inactive"), "inactive"))
      .rejects.toThrow(/ativo|permissão/i);
    const version = await importVersion(importArgs(f.environment.id, "verified"), "commercial");
    expect(version.created_by).toBe(actors.commercial);
    expect(await scalar("select created_by from audit_events where entity_id=$1 and action='imported'", [version.id]))
      .toBe(actors.commercial);
    expect(Number(await scalar("select count(*) from environment_versions where environment_id=$1", [f.environment.id])))
      .toBe(2);
  });

  it("accepts late dispatch and receipt of a draft purchase after global stock fulfilled the contract", async () => {
    const first = await purchaseFixture();
    // C2 deliberately has a draft order: purchaseFixture would already dispatch it.
    const secondProject = await projectFixture({ supplierId: first.supplier.id });
    await approveContract(secondProject.contract.id);
    const review = await rpc("start_technical_review", { p_contract_id: secondProject.contract.id }, "operations");
    await rpc("complete_technical_review", { p_review_id: review.id }, "operations");
    const order = await rpc("create_purchase_order", { p_review_id: review.id }, "operations");
    const line = (await db.query<{ id: string; inventory_item_id: string }>(
      "select id, inventory_item_id from purchase_order_items where purchase_order_id=$1 order by id",
      [order.id],
    )).rows[0];
    const second = { ...secondProject, review, order, line };
    expect(await scalar("select status from purchase_orders where id=$1", [second.order.id])).toBe("draft");
    expect(second.line.inventory_item_id).toBe(first.line.inventory_item_id);
    await rpc("receive_purchase_order", {
      p_order_id: first.order.id, p_items: [{ itemId: first.line.id, quantity: 2 }],
      p_request_id: "70000000-0000-4000-8000-000000000001",
    }, "operations");
    await rpc("reserve_stock", {
      p_contract_id: second.contract.id,
      p_items: [{ inventoryItemId: second.line.inventory_item_id, quantity: 2 }],
      p_request_id: "70000000-0000-4000-8000-000000000002",
    }, "operations");
    await deliverAndAssemble(second.contract.id);
    expect(await scalar("select status from contracts where id=$1", [second.contract.id])).toBe("completed");
    expect(Number(await scalar("select on_hand from stock_balances where inventory_item_id=$1", [second.line.inventory_item_id]))).toBe(0);
    expect(await scalar("select status from purchase_orders where id=$1", [second.order.id])).toBe("draft");
    const dispatch = await rpc("send_purchase_order", { p_order_id: second.order.id }, "operations");
    expect(dispatch.status).toBe("sent");
    const repeatedDispatch = await rpc("send_purchase_order", { p_order_id: second.order.id }, "operations");
    expect(repeatedDispatch.id).toBe(dispatch.id);
    expect(repeatedDispatch.sent_at).toBe(dispatch.sent_at);
    expect(Number(await scalar("select count(*) from audit_events where entity_id=$1 and action='dispatch_recorded'", [second.order.id]))).toBe(1);
    expect(Number(await scalar("select count(*) from purchase_orders where technical_review_id=$1", [second.review.id]))).toBe(1);
    const receipt = await rpc("receive_purchase_order", {
      p_order_id: second.order.id, p_items: [{ itemId: second.line.id, quantity: 2 }],
      p_request_id: "70000000-0000-4000-8000-000000000003",
    }, "operations");
    expect(receipt.status).toBe("received");
    expect(Number(await scalar("select on_hand from stock_balances where inventory_item_id=$1", [second.line.inventory_item_id]))).toBe(2);
    await expect(rpc("start_technical_review", { p_contract_id: second.contract.id }, "operations"))
      .rejects.toThrow(/Contrato exige/i);
    await expect(rpc("create_purchase_order", { p_review_id: second.review.id }, "operations"))
      .rejects.toThrow(/Contrato exige/i);
    await expect(rpc("reserve_stock", {
      p_contract_id: second.contract.id,
      p_items: [{ inventoryItemId: second.line.inventory_item_id, quantity: 1 }],
      p_request_id: "70000000-0000-4000-8000-000000000004",
    }, "operations")).rejects.toThrow(/Contrato exige/i);
  });

  it("keeps a project open when a draft budget remains after assembly", async () => {
    const f = await purchaseFixture();
    const draft = await rpc("create_budget", {
      p_project_id: f.project.id, p_name: "Orçamento pendente",
      p_environment_ids: [f.environment.id],
    }, "commercial");
    await rpc("receive_purchase_order", {
      p_order_id: f.order.id, p_items: [{ itemId: f.line.id, quantity: 2 }],
      p_request_id: "80000000-0000-4000-8000-000000000001",
    }, "operations");
    await rpc("reserve_stock", {
      p_contract_id: f.contract.id,
      p_items: [{ inventoryItemId: f.line.inventory_item_id, quantity: 2 }],
      p_request_id: "80000000-0000-4000-8000-000000000002",
    }, "operations");
    await deliverAndAssemble(f.contract.id);
    expect(await scalar("select status from contracts where id=$1", [f.contract.id])).toBe("completed");
    expect(await scalar("select status from budgets where id=$1", [draft.id])).toBe("draft");
    expect(await scalar("select status from projects where id=$1", [f.project.id])).toBe("in_progress");
    const subsequent = await rpc("create_contract", { p_budget_id: draft.id }, "commercial");
    expect(subsequent.status).toBe("draft");
    expect((await rpc("create_contract", { p_budget_id: draft.id }, "commercial")).id).toBe(subsequent.id);
  });
});
