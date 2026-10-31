import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CircleDollarSign,
  Landmark,
  Wallet,
} from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Empty,
  Field,
  Notice,
  PageHeader,
  Section,
  Stat,
} from "@/components/ui/primitives";
import {
  FinanceAccessNotice,
  FINANCIAL_HISTORY_LIMIT,
  isUuid,
  moneyFieldValue,
  OperationBadge,
  operationLabel,
  QueryLimit,
  saoPauloToday,
  shortId,
} from "@/components/operations/common";
import type {
  Contract,
  Customer,
  FinancialTitle,
  PurchaseOrder,
  Settlement,
  SettlementReversal,
  Supplier,
} from "@/lib/domain";
import { brl, date } from "@/lib/format";
import { can, requireViewer } from "@/lib/server/auth";
import { list, one } from "@/lib/server/data";

export default async function FinancialTitlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireViewer();
  if (!can(viewer, "finance")) return <FinanceAccessNotice />;
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const title = await one<FinancialTitle>("financial_titles", id);
  if (!title) notFound();
  const [settlements, customer, supplier, contract, order] = await Promise.all([
    list<Settlement>("settlements", {
      filters: { financial_title_id: id },
      orderBy: "paid_at",
      limit: FINANCIAL_HISTORY_LIMIT,
    }),
    title.customer_id
      ? one<Customer>("customers", title.customer_id)
      : Promise.resolve(null),
    title.supplier_id
      ? one<Supplier>("suppliers", title.supplier_id)
      : Promise.resolve(null),
    title.contract_id
      ? one<Contract>("contracts", title.contract_id)
      : Promise.resolve(null),
    title.purchase_order_id
      ? one<PurchaseOrder>("purchase_orders", title.purchase_order_id)
      : Promise.resolve(null),
  ]);
  // A reversal is unique per settlement. Query each visible settlement explicitly;
  // a bounded global list of reversals cannot prove that an older payment is active.
  const reversalRows = await Promise.all(
    settlements.map((settlement) =>
      list<SettlementReversal>("settlement_reversals", {
        filters: { settlement_id: settlement.id },
        limit: 1,
      }),
    ),
  );
  const reversalMap = new Map(
    reversalRows.flat().map((reversal) => [reversal.settlement_id, reversal]),
  );
  const canSettle =
    ["open", "partially_paid"].includes(title.status) &&
    Number(title.balance_cents) > 0;
  const activationBlocked =
    (title.origin === "contract" &&
      (!contract?.financial_approved_at || contract.status === "cancelled")) ||
    (title.origin === "purchase_order" &&
      (!order || order.status === "cancelled"));
  const receivable = title.direction === "receivable";
  return (
    <>
      <PageHeader
        eyebrow={`Controle · ${operationLabel(title.direction)}`}
        title={`Título #${title.number}`}
        description={title.description}
        actions={
          <Button asChild variant="outline">
            <Link href="/financeiro">
              <ArrowLeft size={15} /> Todos os títulos
            </Link>
          </Button>
        }
      />
      <div className="stats-grid">
        <Stat
          title="Valor original"
          value={brl(title.amount_cents)}
          detail="Não é alterado pelas baixas"
          icon={<CircleDollarSign size={17} />}
        />
        <Stat
          title="Baixado líquido"
          value={brl(title.paid_cents)}
          detail="Já descontados os estornos"
          icon={<Landmark size={17} />}
        />
        <Stat
          title="Saldo do título"
          value={brl(title.balance_cents)}
          detail={
            title.status === "forecast"
              ? "Previsão ainda não efetivada"
              : title.status === "cancelled"
                ? "Título cancelado, sem baixa disponível"
                : "Valor ainda não liquidado"
          }
          icon={<Wallet size={17} />}
        />
        <Stat
          title="Vencimento"
          value={date(title.due_date)}
          detail={operationLabel(title.status)}
          icon={<CalendarClock size={17} />}
        />
      </div>
      <div className="stack">
        <div className="two-columns">
          <Section title="Dados e vínculos">
            <dl className="info-pairs">
              <div>
                <dt>Situação</dt>
                <dd>
                  <OperationBadge value={title.status} />
                </dd>
              </div>
              <div>
                <dt>Origem</dt>
                <dd>{operationLabel(title.origin)}</dd>
              </div>
              <div>
                <dt>{receivable ? "Cliente" : "Fornecedor"}</dt>
                <dd>
                  {customer?.name ??
                    supplier?.name ??
                    (title.customer_id
                      ? shortId(title.customer_id)
                      : title.supplier_id
                        ? shortId(title.supplier_id)
                        : "—")}
                </dd>
              </div>
              <div>
                <dt>Criado em</dt>
                <dd>{date(title.created_at, true)}</dd>
              </div>
              {title.contract_id && (
                <div>
                  <dt>Contrato</dt>
                  <dd>
                    <Link
                      className="text-link"
                      href={`/contratos/${title.contract_id}`}
                    >
                      {contract
                        ? `#${contract.number}`
                        : shortId(title.contract_id)}
                    </Link>
                  </dd>
                </div>
              )}
              {title.purchase_order_id && (
                <div>
                  <dt>Pedido de compra</dt>
                  <dd>
                    <Link
                      className="text-link"
                      href={`/compras/${title.purchase_order_id}`}
                    >
                      {order
                        ? `#${order.number}`
                        : shortId(title.purchase_order_id)}
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
          </Section>
          <Section
            title={
              title.status === "forecast"
                ? "Efetivar previsão"
                : receivable
                  ? "Registrar recebimento"
                  : "Registrar pagamento"
            }
            description={
              title.status === "forecast"
                ? "A efetivação torna o título disponível para baixa, sem movimentar um pagamento."
                : "Informe o valor realmente recebido ou pago nesta operação."
            }
          >
            {title.status === "forecast" ? (
              activationBlocked ? (
                <Notice tone="warning">
                  {title.origin === "contract" ? (
                    <>
                      A previsão depende da aprovação financeira do contrato.{" "}
                      <Link
                        className="text-link"
                        href={`/contratos/${title.contract_id}`}
                      >
                        Confira as aprovações.
                      </Link>
                    </>
                  ) : (
                    "O pedido de origem não está disponível para efetivação. Confira seu estado antes de prosseguir."
                  )}
                </Notice>
              ) : (
                <ActionForm
                  command="finance.activate"
                  submitLabel="Efetivar previsão"
                  confirm="Transformar esta previsão em título efetivo? Isso não registra pagamento nem recebimento."
                >
                  <input type="hidden" name="title_id" value={id} />
                  <Notice>
                    Após efetivar, a baixa parcial ou total será feita em outra
                    operação.
                  </Notice>
                </ActionForm>
              )
            ) : canSettle ? (
              <ActionForm
                command="finance.settle"
                submitLabel={
                  receivable ? "Confirmar recebimento" : "Confirmar pagamento"
                }
                resetOnSuccess
              >
                <input type="hidden" name="title_id" value={id} />
                <div className="form-grid">
                  <Field
                    label="Valor da baixa (R$)"
                    hint={`Saldo disponível: ${brl(title.balance_cents)}. Use vírgula para os centavos.`}
                  >
                    <input
                      key={String(title.balance_cents)}
                      name="amount"
                      inputMode="decimal"
                      required
                      maxLength={20}
                      defaultValue={moneyFieldValue(title.balance_cents)}
                      placeholder="0,00"
                    />
                  </Field>
                  <Field
                    label={
                      receivable ? "Data do recebimento" : "Data do pagamento"
                    }
                  >
                    <input
                      name="paid_at"
                      type="date"
                      required
                      defaultValue={saoPauloToday()}
                    />
                  </Field>
                </div>
                <p className="helper">
                  Um valor menor que o saldo registra uma baixa parcial. Não há
                  desconto, juros ou alteração do valor original nesta operação.
                </p>
              </ActionForm>
            ) : (
              <Notice tone={title.status === "paid" ? "success" : "info"}>
                {title.status === "paid"
                  ? "Título liquidado. As baixas e seus eventuais estornos podem ser consultados abaixo."
                  : title.status === "cancelled"
                    ? "Título cancelado. Novas baixas não estão disponíveis."
                    : "Não há saldo efetivo disponível para baixa."}
              </Notice>
            )}
          </Section>
        </div>
        <Section
          title="Baixas e estornos"
          description="O estorno preserva a baixa original e registra o motivo. Cada estorno reverte integralmente a baixa selecionada."
        >
          {settlements.length ? (
            <div className="stack">
              {settlements.map((settlement) => {
                const reversal = reversalMap.get(settlement.id);
                const canReverse =
                  !reversal &&
                  ["partially_paid", "paid"].includes(title.status);
                return (
                  <article key={settlement.id} className="environment-card">
                    <div className="space-between align-start">
                      <div>
                        <h3>{brl(settlement.amount_cents)}</h3>
                        <p className="helper mt">
                          {receivable ? "Recebimento" : "Pagamento"} em{" "}
                          {date(settlement.paid_at)} · baixa{" "}
                          {shortId(settlement.id)}
                        </p>
                      </div>
                      <Badge value={reversal ? "cancelled" : "paid"}>
                        {reversal ? "Estornada" : "Registrada"}
                      </Badge>
                    </div>
                    <p className="helper mt">
                      Registro em {date(settlement.created_at, true)}.
                    </p>
                    {reversal ? (
                      <div className="mt">
                        <Notice>
                          <strong>
                            Estorno em {date(reversal.created_at, true)}
                          </strong>
                          <p
                            style={{
                              whiteSpace: "pre-wrap",
                              overflowWrap: "anywhere",
                            }}
                          >
                            {reversal.reason}
                          </p>
                          <p>
                            Registro: {shortId(reversal.id)}. O valor já foi
                            descontado do total baixado líquido acima.
                          </p>
                        </Notice>
                      </div>
                    ) : canReverse ? (
                      <details className="details-block mt">
                        <summary>
                          Estornar esta baixa de {brl(settlement.amount_cents)}
                        </summary>
                        <div>
                          <ActionForm
                            command="finance.reverse"
                            submitLabel="Confirmar estorno"
                            variant="danger"
                            confirm={`Estornar integralmente a baixa de ${brl(settlement.amount_cents)} de ${date(settlement.paid_at)}? O saldo do título será recomposto e o motivo ficará registrado.`}
                          >
                            <input
                              type="hidden"
                              name="settlement_id"
                              value={settlement.id}
                            />
                            <Field
                              label="Motivo do estorno"
                              hint="Informe pelo menos 5 caracteres. O registro original será preservado."
                            >
                              <textarea
                                name="reason"
                                required
                                minLength={5}
                                maxLength={5000}
                                placeholder="Por que esta baixa precisa ser revertida?"
                              />
                            </Field>
                            <p className="helper">
                              Este estorno altera o controle interno. Ele não
                              devolve dinheiro nem cancela uma transferência
                              bancária externa.
                            </p>
                          </ActionForm>
                        </div>
                      </details>
                    ) : (
                      <p className="helper mt">
                        O estado atual do título não permite estornar esta
                        baixa.
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <Empty
              title="Nenhuma baixa registrada"
              description={
                title.status === "forecast"
                  ? "Efetive a previsão antes de registrar um recebimento ou pagamento."
                  : "Ao registrar uma baixa, o valor, a data e os eventuais estornos aparecerão aqui."
              }
            />
          )}
        </Section>
        <QueryLimit
          count={settlements.length}
          limit={FINANCIAL_HISTORY_LIMIT}
          subject="baixas mais recentes deste título"
          indicators={false}
        />
        <p className="helper">
          Os valores original, baixado e saldo do cabeçalho vêm do título
          completo, inclusive quando o histórico exibido está limitado a 50
          baixas.
        </p>
        <Notice>
          Esta tela não altera o valor original do título e não integra bancos.
          Efetivação, baixa e estorno são operações distintas, registradas com
          seus próprios vínculos.
        </Notice>
      </div>
    </>
  );
}
