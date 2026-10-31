import Link from "next/link";
import { notFound } from "next/navigation";
import { list, listAll, one } from "@/lib/server/data";
import { requireViewer, can } from "@/lib/server/auth";
import type {
  Budget,
  BudgetItem,
  Project,
  Contract,
  Environment,
} from "@/lib/domain";
import { brl, quantity, date } from "@/lib/format";
import {
  PageHeader,
  Section,
  Badge,
  Notice,
  Stat,
} from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/action-form";
import { PrintButton } from "@/components/print-button";

export default async function BudgetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await requireViewer();
  const budget = await one<Budget>("budgets", id);
  if (!budget) notFound();
  const [items, project, contracts, environments] = await Promise.all([
    listAll<BudgetItem>("budget_items", { filters: { budget_id: id } }),
    one<Project>("projects", budget.project_id),
    list<Contract>("contracts", { filters: { budget_id: id } }),
    list<Environment>("environments", {
      filters: { project_id: budget.project_id },
    }),
  ]);
  return (
    <>
      <PageHeader
        eyebrow={`COMERCIAL / ${project?.name ?? "ORÇAMENTO"}`}
        title={budget.name}
        description={`Gerado em ${date(budget.created_at, true)}. Os itens abaixo são uma cópia das versões usadas neste orçamento.`}
        actions={
          <>
            <Badge value={budget.status} />
            <PrintButton />
            <Button asChild variant="outline">
              <Link href={`/projetos/${budget.project_id}`}>Abrir projeto</Link>
            </Button>
          </>
        }
      />
      <div className="stats-grid">
        <Stat
          title="Valor de venda"
          value={brl(budget.total_cents)}
          detail="Soma dos itens do orçamento"
        />
        <Stat
          title="Custo dos itens"
          value={brl(budget.cost_cents)}
          detail="Custo importado, sem despesas adicionais"
        />
        <Stat
          title="Diferença venda − custo"
          value={brl(Number(budget.total_cents) - Number(budget.cost_cents))}
          detail="Não representa lucro líquido"
        />
        <Stat
          title="Ambientes"
          value={new Set(items.map((i) => i.environment_id)).size}
          detail="Versões preservadas neste orçamento"
        />
      </div>
      <div className="stack">
        <Section
          title="Composição do orçamento"
          description="Preços unitários e totais em reais; quantidades conforme importação."
          className="panel-flush"
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ambiente / item</th>
                  <th>Código</th>
                  <th className="number">Qtd.</th>
                  <th className="number">Venda unit.</th>
                  <th className="number">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.description}</strong>
                      <small>
                        {environments.find((e) => e.id === item.environment_id)
                          ?.name ?? "Ambiente"}
                      </small>
                    </td>
                    <td>{item.code}</td>
                    <td className="number">
                      {quantity(item.quantity)} {item.unit}
                    </td>
                    <td className="number">{brl(item.unit_sale_cents)}</td>
                    <td className="number">{brl(item.sale_cents)}</td>
                  </tr>
                ))}
                <tr className="table-total">
                  <td colSpan={4}>Total do orçamento</td>
                  <td className="number">{brl(budget.total_cents)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>
        <div className="two-columns">
          <Section title="Formalização comercial">
            {contracts[0] ? (
              <div className="stack">
                <p>
                  Este orçamento originou o contrato #{contracts[0].number}.
                </p>
                <Button asChild>
                  <Link href={`/contratos/${contracts[0].id}`}>
                    Abrir contrato e aprovações
                  </Link>
                </Button>
              </div>
            ) : can(viewer, "commercial") ? (
              <ActionForm
                command="contract.create"
                submitLabel="Criar contrato deste orçamento"
                confirm="Criar o contrato com os itens e o valor deste orçamento? Uma previsão a receber será registrada."
              >
                <input name="budget_id" type="hidden" value={id} />
                <Notice>
                  O contrato conserva este orçamento e gera uma previsão a
                  receber. Assinatura, liberação comercial e liberação
                  financeira serão registradas separadamente.
                </Notice>
              </ActionForm>
            ) : (
              <Notice>A criação do contrato exige perfil comercial.</Notice>
            )}
          </Section>
          <Notice>
            Esta versão utiliza os preços importados. Descontos, parcelamento
            negociado, comissões e layouts contratuais personalizados estão
            organizados nas próximas fases do mapa de processos.
          </Notice>
        </div>
      </div>
    </>
  );
}
