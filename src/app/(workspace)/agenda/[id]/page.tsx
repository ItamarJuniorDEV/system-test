import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Button } from "@/components/ui/button";
import { Empty, Notice, PageHeader, Section } from "@/components/ui/primitives";
import {
  isUuid,
  OperationBadge,
  operationLabel,
  ReadOnlyNotice,
  shortId,
} from "@/components/operations/common";
import type {
  Appointment,
  Contract,
  Customer,
  InventoryItem,
  Profile,
  StockReservation,
} from "@/lib/domain";
import { date, quantity } from "@/lib/format";
import { can, requireViewer } from "@/lib/server/auth";
import { listAll, one } from "@/lib/server/data";

export default async function AppointmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireViewer();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const appointment = await one<Appointment>("appointments", id);
  if (!appointment) notFound();
  const [contract, assigned, reservations, inventory] = await Promise.all([
    one<Contract>("contracts", appointment.contract_id),
    one<Profile>("profiles", appointment.assigned_to),
    listAll<StockReservation>("stock_reservations", {
      filters: { contract_id: appointment.contract_id, status: "active" },
      orderBy: "created_at",
    }),
    listAll<InventoryItem>("inventory_items"),
  ]);
  const customer = contract
    ? await one<Customer>("customers", contract.customer_id)
    : null;
  const itemMap = new Map(inventory.map((item) => [item.id, item]));
  const operate = can(viewer, "operations");
  const delivery = appointment.kind === "delivery";
  return (
    <>
      <PageHeader
        eyebrow="Operação · agenda"
        title={operationLabel(appointment.kind)}
        description={`${contract ? `Contrato #${contract.number}` : shortId(appointment.contract_id)}${customer ? ` · ${customer.name}` : ""}`}
        actions={
          <Button asChild variant="outline">
            <Link href="/agenda">
              <ArrowLeft size={15} /> Voltar à agenda
            </Link>
          </Button>
        }
      />
      <div className="stack">
        {!operate && <ReadOnlyNotice />}
        <div className="two-columns">
          <Section title="Dados do compromisso">
            <dl className="info-pairs">
              <div>
                <dt>Situação</dt>
                <dd>
                  <OperationBadge value={appointment.status} />
                </dd>
              </div>
              <div>
                <dt>Responsável</dt>
                <dd>
                  {appointment.assigned_to === viewer.id
                    ? viewer.name
                    : (assigned?.name ?? shortId(appointment.assigned_to))}
                </dd>
              </div>
              <div>
                <dt>Início · São Paulo</dt>
                <dd>{date(appointment.starts_at, true)}</dd>
              </div>
              <div>
                <dt>Término · São Paulo</dt>
                <dd>{date(appointment.ends_at, true)}</dd>
              </div>
              <div>
                <dt>Contrato</dt>
                <dd>
                  <Link
                    className="text-link"
                    href={`/contratos/${appointment.contract_id}`}
                  >
                    {contract
                      ? `#${contract.number}`
                      : shortId(appointment.contract_id)}
                  </Link>
                </dd>
              </div>
              <div>
                <dt>Conclusão registrada</dt>
                <dd>{date(appointment.completed_at, true)}</dd>
              </div>
            </dl>
            {appointment.notes && (
              <p className="helper mt" style={{ whiteSpace: "pre-wrap" }}>
                {appointment.notes}
              </p>
            )}
          </Section>
          <Section
            title="Concluir compromisso"
            description="Confira os efeitos antes de registrar a execução."
          >
            <div className="stack">
              {appointment.status === "completed" ? (
                <Notice tone="success">
                  Compromisso concluído em{" "}
                  {date(appointment.completed_at, true)}. A ação não precisa ser
                  repetida.
                </Notice>
              ) : appointment.status === "cancelled" ? (
                <Notice>Este compromisso está cancelado.</Notice>
              ) : (
                <>
                  <Notice tone="warning">
                    {delivery
                      ? "Esta conclusão consome todas as reservas ativas do contrato e retira essas quantidades do saldo físico. Para uma entrega parcial, deixe reservadas somente as quantidades que serão entregues agora."
                      : "A montagem exige a entrega integral dos itens previstos nos pedidos não cancelados do contrato. Sua conclusão também conclui o contrato; não registra automaticamente um pagamento."}
                  </Notice>
                  {operate ? (
                    delivery && reservations.length === 0 ? (
                      <p className="helper">
                        Não há reserva ativa para entregar.{" "}
                        <Link
                          className="text-link"
                          href={`/estoque?contrato=${appointment.contract_id}`}
                        >
                          Confira o estoque e as reservas.
                        </Link>
                      </p>
                    ) : (
                      <ActionForm
                        command="appointment.complete"
                        submitLabel={
                          delivery ? "Confirmar entrega" : "Concluir montagem"
                        }
                        confirm={
                          delivery
                            ? "Confirmar a entrega de TODAS as reservas ativas deste contrato? Essas quantidades serão retiradas do estoque."
                            : "Confirmar a conclusão da montagem? A entrega integral será validada e o contrato será concluído."
                        }
                      >
                        <input type="hidden" name="appointment_id" value={id} />
                      </ActionForm>
                    )
                  ) : (
                    <p className="helper">
                      Seu perfil pode consultar, mas não concluir este
                      compromisso.
                    </p>
                  )}
                </>
              )}
            </div>
          </Section>
        </div>
        {delivery && appointment.status === "scheduled" && (
          <Section
            title="Reservas que serão entregues"
            description="Todas as reservas ativas deste contrato estão incluídas nesta conclusão."
            className="panel-flush"
          >
            {reservations.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th className="number">Quantidade</th>
                      <th>Reservado em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.map((reservation) => (
                      <tr key={reservation.id}>
                        <td>
                          <Link
                            className="text-link"
                            href={`/estoque/${reservation.inventory_item_id}`}
                          >
                            {itemMap.get(reservation.inventory_item_id)?.code ??
                              shortId(reservation.inventory_item_id)}
                          </Link>
                          <small>
                            {
                              itemMap.get(reservation.inventory_item_id)
                                ?.description
                            }
                          </small>
                        </td>
                        <td className="number">
                          {quantity(reservation.quantity)}{" "}
                          {itemMap.get(reservation.inventory_item_id)?.unit}
                        </td>
                        <td>{date(reservation.created_at, true)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="Nenhuma reserva ativa"
                description="É necessário reservar os itens antes de concluir esta entrega."
              />
            )}
          </Section>
        )}
        <div className="inline">
          <Button asChild variant="outline">
            <Link href={`/estoque?contrato=${appointment.contract_id}`}>
              Ver reservas do contrato
            </Link>
          </Button>
          {contract && (
            <Button asChild variant="outline">
              <Link href={`/assistencia?contrato=${contract.id}`}>
                Abrir assistência, se necessário
              </Link>
            </Button>
          )}
        </div>
        <p className="helper">
          Não há cancelamento, reagendamento nem devolução física por esta tela.
          Se houver divergência, resolva a pendência antes de confirmar a
          execução.
        </p>
      </div>
    </>
  );
}
