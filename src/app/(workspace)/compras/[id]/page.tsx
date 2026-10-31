import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Boxes,
  CheckCheck,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import { ActionForm } from "@/components/action-form";
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
  isUuid,
  OperationBadge,
  quantityRemainder,
  ReadOnlyNotice,
  shortId,
} from "@/components/operations/common";
import type {
  Contract,
  PurchaseItem,
  PurchaseOrder,
  Supplier,
} from "@/lib/domain";
import { brl, date, quantity } from "@/lib/format";
import { can, requireViewer } from "@/lib/server/auth";
import { listAll, one } from "@/lib/server/data";

export default async function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireViewer();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const order = await one<PurchaseOrder>("purchase_orders", id);
  if (!order) notFound();
  const [items, supplier, contract] = await Promise.all([
    listAll<PurchaseItem>("purchase_order_items", {
      filters: { purchase_order_id: id },
      orderBy: "created_at",
      ascending: true,
    }),
    one<Supplier>("suppliers", order.supplier_id),
    one<Contract>("contracts", order.contract_id),
  ]);
  const operate = can(viewer, "operations");
  const canReceive = ["sent", "partially_received"].includes(order.status);
  const pending = items.filter(
    (item) => quantityRemainder(item.quantity, item.received_quantity) > 0,
  );
  return (
    <>
      <PageHeader
        eyebrow="Operação · compras"
        title={`Pedido #${order.number}`}
        description={
          supplier?.name ?? `Fornecedor ${shortId(order.supplier_id)}`
        }
        actions={
          <Button asChild variant="outline">
            <Link href="/compras">
              <ArrowLeft size={15} /> Todos os pedidos
            </Link>
          </Button>
        }
      />
      <div className="stats-grid">
        <Stat
          title="Valor do pedido"
          value={brl(order.total_cents)}
          detail="Total registrado na compra"
          icon={<Wallet size={17} />}
        />
        <Stat
          title="Linhas consultadas"
          value={items.length}
          detail="Quantidades detalhadas abaixo"
          icon={<ShoppingCart size={17} />}
        />
        <Stat
          title="Linhas pendentes"
          value={pending.length}
          detail="Ainda não recebidas integralmente"
          icon={<Boxes size={17} />}
        />
        <Stat
          title="Situação"
          value={<OperationBadge value={order.status} />}
          detail={
            order.sent_at
              ? `Envio local: ${date(order.sent_at, true)}`
              : "Envio ainda não registrado"
          }
          icon={<CheckCheck size={17} />}
        />
      </div>
      <div className="stack">
        {!operate && <ReadOnlyNotice />}
        <div className="two-columns">
          <Section title="Origem do pedido">
            <dl className="info-pairs">
              <div>
                <dt>Contrato</dt>
                <dd>
                  <Link
                    className="text-link"
                    href={`/contratos/${order.contract_id}`}
                  >
                    {contract
                      ? `Contrato #${contract.number}`
                      : shortId(order.contract_id)}
                  </Link>
                </dd>
              </div>
              <div>
                <dt>Criado em</dt>
                <dd>{date(order.created_at, true)}</dd>
              </div>
              <div>
                <dt>Fornecedor</dt>
                <dd>{supplier?.name ?? shortId(order.supplier_id)}</dd>
              </div>
              <div>
                <dt>Revisão de origem</dt>
                <dd>{shortId(order.technical_review_id)}</dd>
              </div>
            </dl>
          </Section>
          <Section
            title="Envio ao fornecedor"
            description="Controle local da decisão de envio."
          >
            <div className="stack">
              <Notice>
                Esta ação não envia e-mail, arquivo ou ordem à fábrica. Combine
                o envio com o fornecedor pelo canal utilizado pela loja.
              </Notice>
              {operate && order.status === "draft" ? (
                <ActionForm
                  command="purchase.send"
                  submitLabel="Marcar como enviado"
                  confirm="Registrar que o pedido foi enviado pelo canal da loja? Esta ação não transmite dados ao fornecedor."
                >
                  <input type="hidden" name="order_id" value={id} />
                </ActionForm>
              ) : (
                <p className="helper">
                  {order.sent_at
                    ? `Envio local registrado em ${date(order.sent_at, true)}.`
                    : order.status === "cancelled"
                      ? "Pedido cancelado. O envio está indisponível."
                      : "Somente o perfil de operação pode registrar o envio de um rascunho."}
                </p>
              )}
            </div>
          </Section>
        </div>
        <Section
          title="Itens do pedido"
          description="Pedido, recebimento e reserva são controles separados."
          className="panel-flush"
        >
          {items.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Un.</th>
                    <th className="number">Pedido</th>
                    <th className="number">Recebido</th>
                    <th className="number">Pendente</th>
                    <th className="number">Custo un.</th>
                    <th className="number">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <Link
                          className="text-link"
                          href={`/estoque/${item.inventory_item_id}`}
                        >
                          {item.code}
                        </Link>
                        <small>{item.description}</small>
                      </td>
                      <td>{item.unit}</td>
                      <td className="number">{quantity(item.quantity)}</td>
                      <td className="number">
                        {quantity(item.received_quantity)}
                      </td>
                      <td className="number">
                        {quantity(
                          quantityRemainder(
                            item.quantity,
                            item.received_quantity,
                          ),
                        )}
                      </td>
                      <td className="number">{brl(item.unit_cost_cents)}</td>
                      <td className="number">{brl(item.total_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="Nenhum item encontrado"
              description="Não é possível receber um pedido sem itens. Confira a revisão e a geração do pedido."
            />
          )}
        </Section>
        <p className="helper">
          Todos os {items.length} itens deste pedido foram carregados para a
          conferência.
        </p>
        <Section
          title="Registrar recebimento"
          description="Informe apenas as quantidades que chegaram agora. Itens deixados em branco não serão recebidos."
        >
          {operate && canReceive && pending.length ? (
            <ActionForm
              command="purchase.receive"
              submitLabel="Confirmar recebimento"
              resetOnSuccess
              confirm="Confirmar as quantidades recebidas agora? O saldo físico será atualizado, sem reserva automática para entrega."
            >
              <input type="hidden" name="order_id" value={id} />
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Un.</th>
                      <th className="number">Pendente</th>
                      <th>Receber agora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.code}</strong>
                          <small>{item.description}</small>
                        </td>
                        <td>{item.unit}</td>
                        <td className="number">
                          {quantity(
                            quantityRemainder(
                              item.quantity,
                              item.received_quantity,
                            ),
                          )}
                        </td>
                        <td>
                          <input
                            className="table-input"
                            type="number"
                            name={`quantity:${item.id}`}
                            aria-label={`Quantidade a receber de ${item.code}`}
                            min="0"
                            max={Math.min(
                              1_000_000,
                              quantityRemainder(
                                item.quantity,
                                item.received_quantity,
                              ),
                            )}
                            step="0.0001"
                            placeholder="0"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="helper">
                Recebimentos parciais mantêm o restante pendente. A reserva para
                um contrato é feita separadamente no estoque.
              </p>
            </ActionForm>
          ) : (
            <Notice tone={order.status === "draft" ? "warning" : "info"}>
              {order.status === "draft"
                ? "Registre primeiro o envio local do pedido para liberar o recebimento."
                : order.status === "received"
                  ? "Todos os itens deste pedido já foram recebidos."
                  : order.status === "cancelled"
                    ? "Pedido cancelado. Nenhum recebimento pode ser registrado."
                    : !operate
                      ? "Seu perfil tem acesso somente à consulta desta operação."
                      : "Não há quantidades pendentes no recorte consultado."}
            </Notice>
          )}
        </Section>
        <div className="inline">
          <Button asChild variant="outline">
            <Link href={`/estoque?contrato=${order.contract_id}`}>
              Reservar para este contrato
            </Link>
          </Button>
          {can(viewer, "finance") && (
            <Button asChild variant="outline">
              <Link href="/financeiro">Conferir financeiro</Link>
            </Button>
          )}
        </div>
        {operate && ["draft", "sent"].includes(order.status) && (
          <details className="details-block">
            <summary>Cancelar este pedido</summary>
            <div>
              <ActionForm
                command="purchase.cancel"
                submitLabel="Cancelar pedido"
                variant="danger"
                confirm="Cancelar este pedido e os efeitos permitidos pelo seu estado? O histórico será preservado. A operação será recusada se houver recebimento, baixa ou entrega que impeça o cancelamento."
              >
                <input type="hidden" name="order_id" value={id} />
                <Notice tone="warning">
                  O cancelamento exige ausência de recebimento, baixa e entrega.
                  Para refazer a revisão, todos os pedidos existentes dela
                  precisam estar cancelados. O pedido e seu histórico não serão
                  apagados.
                </Notice>
                <Field
                  label="Motivo do cancelamento"
                  hint="Descreva o motivo com pelo menos 10 caracteres."
                >
                  <textarea
                    name="reason"
                    required
                    minLength={10}
                    maxLength={5000}
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
