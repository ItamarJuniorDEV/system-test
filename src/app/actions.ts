"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { rpc } from "@/lib/server/data";
import { requireViewer } from "@/lib/server/auth";
import { parseMoney } from "@/lib/format";
import {
  parseOperationalQuantity,
  parseStoreDateTime,
} from "@/lib/operational-input";

export type ActionResult = {
  ok: boolean;
  message: string;
  redirectTo?: string;
  id?: string;
};
const textSchema = z
  .string()
  .trim()
  .min(1, "Preencha os campos obrigatórios.")
  .max(5000);
const uuid = z.uuid("Selecione um registro válido.");

/** Allowlist de comandos. A permissão definitiva e os totais são verificados também no PostgreSQL. */
export async function executeCommand(
  command: string,
  form: FormData,
): Promise<ActionResult> {
  await requireViewer();
  try {
    const raw = (key: string) => String(form.get(key) ?? "");
    const str = (key: string, max = 5000) =>
      textSchema.max(max).parse(raw(key));
    const id = (key: string) => uuid.parse(raw(key));
    const optionalId = (key: string) => (raw(key) ? id(key) : null);
    const day = (key: string) =>
      z.iso.date("Informe uma data válida.").parse(raw(key));
    const cents = (key: string) => {
      const n = parseMoney(raw(key));
      if (n <= 0) throw new Error("O valor deve ser maior que zero.");
      return n;
    };
    const requestId = () => id("requestId");
    let functionName: string;
    let args: Record<string, unknown>;
    let redirectBase: string | undefined;
    switch (command) {
      case "customer.save":
      case "supplier.save": {
        functionName =
          command === "customer.save" ? "upsert_customer" : "upsert_supplier";
        const email = raw("email").trim();
        if (email) z.email("Informe um e-mail válido.").parse(email);
        const data: Record<string, unknown> = {
          name: str("name", 200),
          document: raw("document").trim().slice(0, 30),
          email,
          phone: raw("phone").trim().slice(0, 40),
          notes: raw("notes").trim().slice(0, 5000),
        };
        if (raw("id")) data.id = id("id");
        if (command === "supplier.save")
          data.lead_days = z.coerce
            .number()
            .int()
            .min(1)
            .max(730)
            .parse(raw("lead_days") || 30);
        args = { p_data: data };
        break;
      }
      case "project.create":
        functionName = "create_project";
        args = { p_customer_id: id("customer_id"), p_name: str("name", 200) };
        redirectBase = "/projetos/";
        break;
      case "environment.create":
        functionName = "create_environment";
        args = {
          p_project_id: id("project_id"),
          p_supplier_id: id("supplier_id"),
          p_name: str("name", 200),
        };
        redirectBase = `/projetos/${id("project_id")}/ambientes/`;
        break;
      case "budget.create":
        functionName = "create_budget";
        args = {
          p_project_id: id("project_id"),
          p_name: str("name", 200),
          p_environment_ids: z
            .array(uuid)
            .min(1, "Selecione pelo menos um ambiente.")
            .max(100)
            .parse(form.getAll("environment_ids")),
        };
        redirectBase = "/orcamentos/";
        break;
      case "contract.create":
        functionName = "create_contract";
        args = { p_budget_id: id("budget_id") };
        redirectBase = "/contratos/";
        break;
      case "contract.approve":
        functionName = "set_contract_approval";
        args = {
          p_contract_id: id("contract_id"),
          p_approval: z
            .enum(["signature", "commercial", "financial"])
            .parse(raw("approval")),
          p_approved: raw("approved") === "true",
        };
        break;
      case "contract.cancel":
        functionName = "cancel_contract";
        args = {
          p_contract_id: id("contract_id"),
          p_reason: str("reason"),
          p_request_id: requestId(),
        };
        break;
      case "review.start":
        functionName = "start_technical_review";
        args = { p_contract_id: id("contract_id") };
        break;
      case "review.approve":
        functionName = "complete_technical_review";
        args = {
          p_review_id: id("review_id"),
          p_accept_difference: raw("accept_difference") === "on",
          p_reason: raw("reason").trim() || null,
        };
        break;
      case "purchase.create":
        functionName = "create_purchase_order";
        args = { p_review_id: id("review_id") };
        redirectBase = "/compras/";
        break;
      case "purchase.send":
        functionName = "send_purchase_order";
        args = { p_order_id: id("order_id") };
        break;
      case "purchase.cancel":
        functionName = "cancel_purchase_order";
        args = {
          p_order_id: id("order_id"),
          p_reason: str("reason"),
          p_request_id: requestId(),
        };
        break;
      case "purchase.receive":
      case "stock.reserve": {
        const entries = [...form.entries()].filter(
          ([key, value]) =>
            key.startsWith("quantity:") &&
            String(value).trim() &&
            Number(String(value).replace(",", ".")) !== 0,
        );
        const items = entries.map(([key, value]) => ({
          [command === "purchase.receive" ? "itemId" : "inventoryItemId"]:
            uuid.parse(key.slice(9)),
          quantity: parseOperationalQuantity(String(value)),
        }));
        if (!items.length)
          throw new Error(
            "Informe uma quantidade maior que zero em pelo menos um item.",
          );
        functionName =
          command === "purchase.receive"
            ? "receive_purchase_order"
            : "reserve_stock";
        args = {
          [command === "purchase.receive" ? "p_order_id" : "p_contract_id"]:
            command === "purchase.receive" ? id("order_id") : id("contract_id"),
          p_items: items,
          p_request_id: requestId(),
        };
        break;
      }
      case "appointment.create": {
        const instant = (key: string) => parseStoreDateTime(raw(key));
        functionName = "create_appointment";
        args = {
          p_contract_id: id("contract_id"),
          p_kind: z.enum(["delivery", "assembly"]).parse(raw("kind")),
          p_starts_at: instant("starts_at"),
          p_ends_at: instant("ends_at"),
          p_notes: raw("notes").trim().slice(0, 5000) || null,
        };
        break;
      }
      case "appointment.complete":
        functionName = "complete_appointment";
        args = { p_appointment_id: id("appointment_id") };
        break;
      case "assistance.open":
        functionName = "open_assistance";
        args = {
          p_contract_id: optionalId("contract_id"),
          p_customer_id: id("customer_id"),
          p_title: str("title", 300),
        };
        redirectBase = "/assistencia/";
        break;
      case "assistance.add":
        functionName = "add_assistance_occurrence";
        args = {
          p_ticket_id: id("ticket_id"),
          p_description: str("description"),
          p_payer: z
            .enum(["customer", "store", "factory", "carrier"])
            .parse(raw("payer")),
        };
        break;
      case "assistance.resolve":
        functionName = "resolve_assistance_occurrence";
        args = {
          p_occurrence_id: id("occurrence_id"),
          p_resolution: str("resolution"),
        };
        break;
      case "assistance.close":
        functionName = "close_assistance";
        args = { p_ticket_id: id("ticket_id") };
        break;
      case "finance.create":
        functionName = "create_financial_title";
        args = {
          p_direction: z
            .enum(["receivable", "payable"])
            .parse(raw("direction")),
          p_description: str("description", 300),
          p_amount_cents: cents("amount"),
          p_due_date: day("due_date"),
          p_customer_id: optionalId("customer_id"),
          p_supplier_id: optionalId("supplier_id"),
        };
        redirectBase = "/financeiro/";
        break;
      case "finance.activate":
        functionName = "activate_financial_title";
        args = { p_title_id: id("title_id") };
        break;
      case "finance.settle":
        functionName = "settle_financial_title";
        args = {
          p_title_id: id("title_id"),
          p_amount_cents: cents("amount"),
          p_paid_at: day("paid_at"),
          p_request_id: requestId(),
        };
        break;
      case "finance.reverse":
        functionName = "reverse_settlement";
        args = {
          p_settlement_id: id("settlement_id"),
          p_reason: str("reason"),
          p_request_id: requestId(),
        };
        break;
      case "profile.save":
        functionName = "set_user_profile";
        args = {
          p_user_id: id("user_id"),
          p_name: str("name", 200),
          p_role: z
            .enum(["admin", "commercial", "operations", "finance"])
            .parse(raw("role")),
          p_active: raw("active") === "on",
        };
        break;
      default:
        throw new Error("Operação não reconhecida.");
    }
    const result = await rpc(functionName, args);
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: result.duplicate
        ? "Esta operação já havia sido registrada. Nenhum efeito foi duplicado."
        : "Operação registrada com sucesso.",
      id: result.id,
      ...(redirectBase && result.id
        ? { redirectTo: `${redirectBase}${result.id}` }
        : {}),
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof z.ZodError
          ? error.issues.map((i) => i.message).join(" ")
          : error instanceof Error
            ? error.message
            : "Não foi possível concluir a operação.",
    };
  }
}
