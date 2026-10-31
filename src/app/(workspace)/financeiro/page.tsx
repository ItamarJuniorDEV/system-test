import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  ChartNoAxesCombined,
  Plus,
} from "lucide-react";
import { FinancialTitleForm } from "@/components/operations/forms";
import { Button } from "@/components/ui/button";
import {
  Empty,
  Field,
  Notice,
  PageHeader,
  Section,
  Stat,
} from "@/components/ui/primitives";
import {
  FinanceAccessNotice,
  LIST_LIMIT,
  OperationBadge,
  operationLabel,
  QueryLimit,
  saoPauloToday,
  shortId,
} from "@/components/operations/common";
import type { Customer, FinancialTitle, Supplier } from "@/lib/domain";
import { brl, date } from "@/lib/format";
import { can, requireViewer } from "@/lib/server/auth";
import { list } from "@/lib/server/data";

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; situacao?: string; busca?: string }>;
}) {
  const viewer = await requireViewer();
  if (!can(viewer, "finance")) return <FinanceAccessNotice />;
  const query = await searchParams;
  const direction =
    typeof query.tipo === "string" &&
    ["receivable", "payable"].includes(query.tipo)
      ? query.tipo
      : "";
  const status =
    typeof query.situacao === "string" &&
    ["forecast", "open", "partially_paid", "paid", "cancelled"].includes(
      query.situacao,
    )
      ? query.situacao
      : "";
  const search =
    typeof query.busca === "string" ? query.busca.trim().slice(0, 200) : "";
  const filters: Record<string, string> = {};
  if (direction) filters.direction = direction;
  if (status) filters.status = status;
  const [loadedTitles, customers, suppliers] = await Promise.all([
    list<FinancialTitle>("financial_titles", {
      filters,
      orderBy: "created_at",
      limit: LIST_LIMIT,
    }),
    list<Customer>("customers", {
      orderBy: "name",
      ascending: true,
      limit: LIST_LIMIT,
    }),
    list<Supplier>("suppliers", {
      orderBy: "name",
      ascending: true,
      limit: LIST_LIMIT,
    }),
  ]);
  const customerMap = new Map(
    customers.map((customer) => [customer.id, customer]),
  );
  const supplierMap = new Map(
    suppliers.map((supplier) => [supplier.id, supplier]),
  );
  const normalizedSearch = search.toLocaleLowerCase("pt-BR");
  const titles = normalizedSearch
    ? loadedTitles.filter((title) =>
        `${title.number} ${title.description} ${title.customer_id ? (customerMap.get(title.customer_id)?.name ?? "") : ""} ${title.supplier_id ? (supplierMap.get(title.supplier_id)?.name ?? "") : ""}`
          .toLocaleLowerCase("pt-BR")
          .includes(normalizedSearch),
      )
    : loadedTitles;
  const effective = titles.filter((title) =>
    ["open", "partially_paid"].includes(title.status),
  );
  const today = saoPauloToday();
  return (
    <>
      <PageHeader
        eyebrow="Controle · financeiro"
        title="Contas a receber e a pagar"
        description="Previsões, títulos efetivos, baixas parciais e estornos com seus vínculos preservados."
        actions={
          <Button asChild>
            <Link href="#novo-titulo">
              <Plus size={15} /> Novo título
            </Link>
          </Button>
        }
      />
      <div className="stats-grid">
        <Stat
          title="A receber · efetivo"
          value={brl(
            effective
              .filter((title) => title.direction === "receivable")
              .reduce((sum, title) => sum + Number(title.balance_cents), 0),
          )}
          detail="Saldo do recorte exibido"
          icon={<ArrowDownLeft size={17} />}
        />
        <Stat
          title="A pagar · efetivo"
          value={brl(
            effective
              .filter((title) => title.direction === "payable")
              .reduce((sum, title) => sum + Number(title.balance_cents), 0),
          )}
          detail="Saldo do recorte exibido"
          icon={<ArrowUpRight size={17} />}
        />
        <Stat
          title="Previsões"
          value={titles.filter((title) => title.status === "forecast").length}
          detail="Ainda não disponíveis para baixa"
          icon={<ChartNoAxesCombined size={17} />}
        />
        <Stat
          title="Títulos vencidos"
          value={
            effective.filter(
              (title) =>
                title.due_date < today && Number(title.balance_cents) > 0,
            ).length
          }
          detail="Efetivos com saldo e vencimento anterior a hoje"
          icon={<CalendarClock size={17} />}
        />
      </div>
      <div className="stack">
        <Section
          title="Filtrar títulos"
          description="Tipo e situação são consultados no banco. A busca por texto atua nos até 500 resultados carregados."
        >
          <form method="get" action="/financeiro" className="form-grid">
            <Field label="Tipo">
              <select name="tipo" defaultValue={direction}>
                <option value="">Receber e pagar</option>
                <option value="receivable">A receber</option>
                <option value="payable">A pagar</option>
              </select>
            </Field>
            <Field label="Situação">
              <select name="situacao" defaultValue={status}>
                <option value="">Todas as situações</option>
                <option value="forecast">Previsão</option>
                <option value="open">Em aberto</option>
                <option value="partially_paid">Baixa parcial</option>
                <option value="paid">Liquidado</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </Field>
            <Field
              label="Buscar no recorte"
              hint="Número, descrição ou nome do cliente/fornecedor."
            >
              <input
                name="busca"
                maxLength={200}
                defaultValue={search}
                placeholder="Ex.: contrato, aluguel ou número"
              />
            </Field>
            <div className="inline" style={{ alignSelf: "end" }}>
              <Button type="submit" variant="outline">
                Aplicar filtros
              </Button>
              {(direction || status || search) && (
                <Link className="text-link" href="/financeiro">
                  Limpar
                </Link>
              )}
            </div>
          </form>
        </Section>
        <Section
          title="Títulos registrados"
          description={`${titles.length} título(s) exibido(s). Abra um registro para efetivar uma previsão, registrar baixa ou consultar estornos.`}
          className="panel-flush"
        >
          {titles.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Título</th>
                    <th>Tipo / origem</th>
                    <th>Cliente ou fornecedor</th>
                    <th>Vencimento</th>
                    <th>Situação</th>
                    <th className="number">Valor</th>
                    <th className="number">Baixado líquido</th>
                    <th className="number">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {titles.map((title) => (
                    <tr key={title.id}>
                      <td style={{ whiteSpace: "normal", minWidth: 200 }}>
                        <Link
                          className="text-link"
                          href={`/financeiro/${title.id}`}
                        >
                          #{title.number} · {title.description}
                        </Link>
                      </td>
                      <td>
                        {operationLabel(title.direction)}
                        <small>{operationLabel(title.origin)}</small>
                      </td>
                      <td>
                        {title.customer_id
                          ? (customerMap.get(title.customer_id)?.name ??
                            `Cliente ${shortId(title.customer_id)}`)
                          : title.supplier_id
                            ? (supplierMap.get(title.supplier_id)?.name ??
                              `Fornecedor ${shortId(title.supplier_id)}`)
                            : "—"}
                      </td>
                      <td>
                        {date(title.due_date)}
                        {["open", "partially_paid"].includes(title.status) &&
                          title.due_date < today &&
                          Number(title.balance_cents) > 0 && (
                            <small>Vencido</small>
                          )}
                      </td>
                      <td>
                        <OperationBadge value={title.status} />
                      </td>
                      <td className="number">{brl(title.amount_cents)}</td>
                      <td className="number">{brl(title.paid_cents)}</td>
                      <td className="number">
                        <strong>{brl(title.balance_cents)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title={
                search || direction || status
                  ? "Nenhum título neste filtro"
                  : "Nenhum título registrado"
              }
              description={
                search || direction || status
                  ? "Revise os filtros. A busca textual considera somente os registros carregados nesta consulta."
                  : "Contratos e pedidos geram seus vínculos financeiros. Você também pode cadastrar um título manual."
              }
            />
          )}
        </Section>
        <QueryLimit
          count={loadedTitles.length}
          subject="títulos mais recentes que atendem aos filtros"
        />
        <div id="novo-titulo">
          <Section
            title="Novo título manual"
            description="Use para obrigações que não foram geradas por um contrato ou pedido."
          >
            {customers.length || suppliers.length ? (
              <div className="stack">
                <FinancialTitleForm
                  customers={customers}
                  suppliers={suppliers}
                  today={today}
                />
                {(!customers.length || !suppliers.length) && (
                  <Notice>
                    {!customers.length
                      ? "Cadastre um cliente para criar títulos a receber. "
                      : ""}
                    {!suppliers.length
                      ? "Cadastre um fornecedor para criar títulos a pagar."
                      : ""}
                  </Notice>
                )}
                {(customers.length >= LIST_LIMIT ||
                  suppliers.length >= LIST_LIMIT) && (
                  <p className="helper">
                    Os seletores exibem até 500 clientes e fornecedores por
                    consulta.
                  </p>
                )}
              </div>
            ) : (
              <Empty
                title="Cadastre a contraparte"
                description="Um título a receber exige cliente; um título a pagar exige fornecedor."
              >
                <div className="inline">
                  <Button asChild variant="outline">
                    <Link href="/clientes">Clientes</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/fornecedores">Fornecedores</Link>
                  </Button>
                </div>
              </Empty>
            )}
          </Section>
        </div>
        <Notice>
          As baixas registram o controle interno da loja. Esta etapa não executa
          transferências bancárias, conciliação, TEF, juros automáticos ou
          emissão fiscal.
        </Notice>
      </div>
    </>
  );
}
