import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";
import { list, listAll, one } from "@/lib/server/data";
import { requireViewer, can, type Role } from "@/lib/server/auth";
import type {
  Contract,
  Customer,
  Project,
  TechnicalReview,
  PurchaseOrder,
  Environment,
  EnvironmentVersion,
  BudgetItem,
} from "@/lib/domain";
import { brl, date } from "@/lib/format";
import {
  compareTechnicalReview,
  assertComparisonTotals,
} from "@/lib/review-comparison";
import {
  PageHeader,
  Section,
  Badge,
  Notice,
  Field,
  Empty,
} from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/action-form";
import { PrintButton } from "@/components/print-button";
import { ReviewComparison } from "@/components/review-comparison";

export default async function ContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await requireViewer();
  const contract = await one<Contract>("contracts", id);
  if (!contract) notFound();
  const [customer, project, reviews, orders, budgetItems] = await Promise.all([
    one<Customer>("customers", contract.customer_id),
    one<Project>("projects", contract.project_id),
    list<TechnicalReview>("technical_reviews", {
      filters: { contract_id: id },
      orderBy: "revision_number",
    }),
    list<PurchaseOrder>("purchase_orders", { filters: { contract_id: id } }),
    listAll<BudgetItem>("budget_items", {
      filters: { budget_id: contract.budget_id },
    }),
  ]);
  const environmentIds = [
    ...new Set(budgetItems.map((item) => item.environment_id)),
  ];
  const environmentRows = await Promise.all(
    environmentIds.map((environmentId) =>
      one<Environment>("environments", environmentId),
    ),
  );
  const environments = environmentRows.filter(
    (environment): environment is Environment => environment !== null,
  );
  const approvals: {
    key: string;
    title: string;
    at: string | null;
    role: Role;
    help: string;
  }[] = [
    {
      key: "signature",
      title: "Assinatura registrada",
      at: contract.signed_at,
      role: "commercial",
      help: "Registro de conferência da assinatura do cliente.",
    },
    {
      key: "commercial",
      title: "Liberação comercial",
      at: contract.commercial_approved_at,
      role: "commercial",
      help: "Confirmação das condições comerciais.",
    },
    {
      key: "financial",
      title: "Liberação financeira",
      at: contract.financial_approved_at,
      role: "finance",
      help: "Autorização do responsável financeiro.",
    },
  ];
  const fullyApproved = approvals.every((a) => a.at);
  const currentReview = reviews.find((r) => r.status !== "superseded");
  const activeOrders = orders.filter((o) => o.status !== "cancelled");
  let comparison: ReturnType<typeof compareTechnicalReview> | null = null;
  let comparisonError = "";
  let versionNumbers: Record<string, number> = {};
  if (currentReview) {
    try {
      const result = compareTechnicalReview(
        budgetItems,
        currentReview.snapshot,
      );
      assertComparisonTotals(result, {
        contractSaleCents: contract.total_cents,
        reviewSaleCents: currentReview.sale_cents,
        reviewCostCents: currentReview.cost_cents,
        differenceCents: currentReview.difference_cents,
      });
      const versionIds = [
        ...new Set(result.environments.flatMap((e) => e.beforeVersionIds)),
      ];
      const versions = await Promise.all(
        versionIds.map(async (versionId) => {
          const [version] = await list<
            Pick<EnvironmentVersion, "id" | "version_number">
          >("environment_versions", {
            filters: { id: versionId },
            columns: "id,version_number",
            limit: 1,
          });
          if (!version)
            throw new Error(
              "Uma versão contratada não está disponível para conferência.",
            );
          return version;
        }),
      );
      versionNumbers = Object.fromEntries(
        versions.map((version) => [version.id, version.version_number]),
      );
      comparison = result;
    } catch (error) {
      comparisonError =
        error instanceof Error
          ? error.message
          : "Não foi possível conferir os itens desta revisão.";
    }
  }
  return (
    <>
      <PageHeader
        eyebrow={`CONTRATOS / ${project?.name ?? "PROJETO"}`}
        title={`Contrato #${contract.number}`}
        description={`${customer?.name ?? "Cliente vinculado"} · ${brl(contract.total_cents)} · Criado em ${date(contract.created_at)}`}
        actions={
          <>
            <Badge value={contract.status} />
            <PrintButton />
            <Button asChild variant="outline">
              <Link href={`/orcamentos/${contract.budget_id}`}>
                Ver orçamento
              </Link>
            </Button>
          </>
        }
      />
      <div className="stack">
        {contract.status === "cancelled" && (
          <Notice tone="warning">
            Contrato cancelado. Motivo:{" "}
            {contract.cancellation_reason || "Registrado no histórico."}
          </Notice>
        )}
        <Section
          title="Formalização e aprovações"
          description="As três confirmações são independentes. A revisão exige todas elas nesta configuração."
        >
          <div className="approval-grid">
            {approvals.map((a) => (
              <article
                className={`approval-card ${a.at ? "is-approved" : ""}`}
                key={a.key}
              >
                <div className="inline">
                  {a.at ? (
                    <CheckCircle2 size={19} color="#218663" />
                  ) : (
                    <Circle size={19} color="#9cacbf" />
                  )}
                  <h3>{a.title}</h3>
                </div>
                <p>{a.help}</p>
                <Badge value={a.at ? "approved" : "pending"}>
                  {a.at ? date(a.at, true) : "Aguardando registro"}
                </Badge>
                {can(viewer, a.role) &&
                  !["cancelled", "completed"].includes(contract.status) && (
                    <ActionForm
                      command="contract.approve"
                      submitLabel={
                        a.at
                          ? "Retirar aprovação"
                          : a.key === "signature"
                            ? "Registrar assinatura"
                            : "Aprovar"
                      }
                      variant={a.at ? "outline" : "default"}
                      className="compact"
                      confirm={
                        a.at
                          ? "Retirar esta aprovação? A operação será bloqueada se já houver efeitos incompatíveis."
                          : undefined
                      }
                    >
                      <input type="hidden" name="contract_id" value={id} />
                      <input type="hidden" name="approval" value={a.key} />
                      <input
                        type="hidden"
                        name="approved"
                        value={String(!a.at)}
                      />
                    </ActionForm>
                  )}
              </article>
            ))}
          </div>
        </Section>
        <div className="content-grid contract-layout">
          <div className="stack">
            <Section
              title="Revisão executiva"
              description="Conferência das versões atuais dos ambientes em relação ao que foi contratado."
              actions={
                fullyApproved &&
                can(viewer, "operations") &&
                activeOrders.length === 0 && (
                  <ActionForm
                    command="review.start"
                    submitLabel={
                      currentReview ? "Atualizar revisão" : "Iniciar revisão"
                    }
                    className="compact"
                    variant="outline"
                  >
                    <input name="contract_id" type="hidden" value={id} />
                  </ActionForm>
                )
              }
            >
              {!fullyApproved && contract.status !== "cancelled" && (
                <Notice tone="warning">
                  Registre a assinatura e as liberações comercial e financeira
                  para iniciar a revisão.
                </Notice>
              )}
              {!currentReview ? (
                <Empty
                  title="Revisão ainda não iniciada"
                  description="A revisão compara as versões atuais dos ambientes com as versões utilizadas no contrato."
                />
              ) : (
                <div className="stack">
                  <div className="space-between">
                    <div>
                      <h3>Revisão {currentReview.revision_number}</h3>
                      <p className="helper">
                        Criada em {date(currentReview.created_at, true)}
                      </p>
                    </div>
                    <Badge value={currentReview.status} />
                  </div>
                  <div className="info-pairs">
                    <div>
                      <dt>Valor contratado</dt>
                      <dd>{brl(contract.total_cents)}</dd>
                    </div>
                    <div>
                      <dt>Valor da versão executiva</dt>
                      <dd>{brl(currentReview.sale_cents)}</dd>
                    </div>
                    <div>
                      <dt>Diferença de venda</dt>
                      <dd>{brl(currentReview.difference_cents)}</dd>
                    </div>
                    <div>
                      <dt>Custo executivo</dt>
                      <dd>{brl(currentReview.cost_cents)}</dd>
                    </div>
                  </div>
                  {currentReview.has_difference && (
                    <Notice tone="warning">
                      Foram identificadas mudanças de versão ou valor. A
                      aprovação exige um administrador e uma justificativa. O
                      aceite da revisão mantém o valor original do contrato;
                      complementos comerciais precisam de uma negociação
                      separada, ainda prevista no mapa.
                    </Notice>
                  )}
                  {comparison ? (
                    <ReviewComparison
                      key={currentReview.id}
                      comparison={comparison}
                      versionNumbers={versionNumbers}
                    />
                  ) : (
                    <Notice tone="warning">
                      A comparação não está disponível. {comparisonError} A
                      aprovação nesta tela depende de uma conferência completa.
                    </Notice>
                  )}
                  {currentReview.status !== "approved" &&
                    comparison !== null &&
                    can(viewer, "operations") && (
                      <ActionForm
                        key={`review-approval:${currentReview.id}`}
                        command="review.approve"
                        submitLabel="Aprovar revisão executiva"
                      >
                        <input
                          name="review_id"
                          type="hidden"
                          value={currentReview.id}
                        />
                        {currentReview.has_difference && (
                          <>
                            <label className="check-row">
                              <input
                                type="checkbox"
                                name="accept_difference"
                                required
                              />
                              <span>
                                Conferi as diferenças e autorizo esta versão
                                executiva.
                                <small>
                                  Exige administrador. Este aceite não altera o
                                  valor cobrado do cliente.
                                </small>
                              </span>
                            </label>
                            <Field label="Justificativa das diferenças *">
                              <textarea
                                name="reason"
                                minLength={10}
                                required
                                maxLength={5000}
                              />
                            </Field>
                          </>
                        )}
                      </ActionForm>
                    )}
                  {currentReview.difference_reason && (
                    <Notice>
                      Justificativa registrada:{" "}
                      {currentReview.difference_reason}
                    </Notice>
                  )}
                  {currentReview.status === "approved" &&
                    can(viewer, "operations") &&
                    !orders.some(
                      (o) => o.technical_review_id === currentReview.id,
                    ) && (
                      <ActionForm
                        command="purchase.create"
                        submitLabel="Gerar pedidos por fornecedor"
                        confirm="Gerar os pedidos de compra desta revisão? Serão criadas previsões a pagar por fornecedor."
                      >
                        <input
                          type="hidden"
                          name="review_id"
                          value={currentReview.id}
                        />
                        <Notice tone="success">
                          Revisão aprovada. Os itens serão agrupados por
                          fornecedor, preservando a origem de cada ambiente.
                        </Notice>
                      </ActionForm>
                    )}
                </div>
              )}
            </Section>
            {reviews.length > 1 && (
              <Section title="Revisões anteriores">
                <div className="item-list">
                  {reviews
                    .filter((r) => r.id !== currentReview?.id)
                    .map((r) => (
                      <div className="item-row" key={r.id}>
                        <div>
                          <h3>Revisão {r.revision_number}</h3>
                          <p>
                            {date(r.created_at, true)} · {brl(r.sale_cents)}
                          </p>
                        </div>
                        <Badge value={r.status} />
                      </div>
                    ))}
                </div>
              </Section>
            )}
          </div>
          <div className="contract-related">
            <Section title="Ambientes vinculados">
              <div className="item-list">
                {environments.map((e) => (
                  <Link
                    className="item-row text-link"
                    href={`/projetos/${contract.project_id}/ambientes/${e.id}`}
                    key={e.id}
                  >
                    {e.name}
                    <span>Ver versões</span>
                  </Link>
                ))}
              </div>
            </Section>
            <Section title="Pedidos de compra">
              {orders.length ? (
                <div className="item-list">
                  {orders.map((o) => (
                    <Link
                      className="item-row"
                      href={`/compras/${o.id}`}
                      key={o.id}
                    >
                      <div>
                        <h3>Pedido #{o.number}</h3>
                        <p>{brl(o.total_cents)}</p>
                      </div>
                      <Badge value={o.status} />
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="helper">
                  Os pedidos serão gerados depois da aprovação da revisão
                  executiva.
                </p>
              )}
            </Section>
            <Section title="Continuidade da operação">
              <div className="stack">
                <Button asChild variant="outline">
                  <Link href="/estoque">Conferir estoque e reservas</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/agenda">Agendar entrega ou montagem</Link>
                </Button>
                {can(viewer, "finance") && (
                  <Button asChild variant="outline">
                    <Link href="/financeiro">Acompanhar financeiro</Link>
                  </Button>
                )}
              </div>
            </Section>
          </div>
        </div>
        {can(viewer, "commercial") &&
          !["cancelled", "completed"].includes(contract.status) && (
            <details className="details-block">
              <summary>Cancelamento do contrato</summary>
              <div>
                <ActionForm
                  command="contract.cancel"
                  submitLabel="Cancelar contrato"
                  variant="danger"
                  confirm="Cancelar este contrato e suas previsões pendentes? O histórico será preservado. Efeitos já executados podem bloquear a operação."
                >
                  <input type="hidden" name="contract_id" value={id} />
                  <Notice tone="warning">
                    O cancelamento verifica pagamentos, recebimentos e entregas
                    antes de alterar os registros. Efeitos já executados exigem
                    o tratamento correspondente.
                  </Notice>
                  <Field label="Motivo do cancelamento *">
                    <textarea
                      name="reason"
                      minLength={10}
                      maxLength={5000}
                      required
                    />
                  </Field>
                </ActionForm>
              </div>
            </details>
          )}
      </div>
    </>
  );
}
