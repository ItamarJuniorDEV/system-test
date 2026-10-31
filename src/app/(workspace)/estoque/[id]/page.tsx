import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Boxes,
  PackageCheck,
  PackageOpen,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  Notice,
  PageHeader,
  Section,
  Stat,
} from "@/components/ui/primitives";
import {
  isUuid,
  LIST_LIMIT,
  OperationBadge,
  QueryLimit,
  shortId,
} from "@/components/operations/common";
import type {
  InventoryItem,
  StockBalance,
  StockMovement,
  StockReservation,
  Supplier,
} from "@/lib/domain";
import { date, quantity } from "@/lib/format";
import { requireViewer } from "@/lib/server/auth";
import { list, one } from "@/lib/server/data";

export default async function InventoryItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireViewer();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const item = await one<InventoryItem>("inventory_items", id);
  if (!item) notFound();
  const [balanceRows, movements, reservations, supplier] = await Promise.all([
    list<StockBalance>("stock_balances", {
      filters: { inventory_item_id: id },
      limit: 1,
    }),
    list<StockMovement>("stock_movements", {
      filters: { inventory_item_id: id },
      orderBy: "created_at",
      limit: LIST_LIMIT,
    }),
    list<StockReservation>("stock_reservations", {
      filters: { inventory_item_id: id },
      orderBy: "created_at",
      limit: LIST_LIMIT,
    }),
    one<Supplier>("suppliers", item.supplier_id),
  ]);
  const balance = balanceRows[0];
  return (
    <>
      <PageHeader
        eyebrow="Operação · estoque"
        title={item.code}
        description={item.description}
        actions={
          <Button asChild variant="outline">
            <Link href="/estoque">
              <ArrowLeft size={15} /> Todos os saldos
            </Link>
          </Button>
        }
      />
      <div className="stats-grid">
        <Stat
          title="Saldo físico"
          value={balance ? quantity(balance.on_hand) : "—"}
          detail={item.unit}
          icon={<Boxes size={17} />}
        />
        <Stat
          title="Reservado"
          value={balance ? quantity(balance.reserved) : "—"}
          detail={item.unit}
          icon={<ShieldCheck size={17} />}
        />
        <Stat
          title="Disponível"
          value={balance ? quantity(balance.available) : "—"}
          detail={item.unit}
          icon={<PackageOpen size={17} />}
        />
        <Stat
          title="Reservas ativas na consulta"
          value={
            reservations.filter(
              (reservation) => reservation.status === "active",
            ).length
          }
          detail="Até 500 reservas deste item"
          icon={<PackageCheck size={17} />}
        />
      </div>
      <div className="stack">
        {!balance && (
          <Notice tone="warning">
            Não foi encontrado saldo para este item. Confira a geração do pedido
            antes de registrar uma reserva.
          </Notice>
        )}
        <Section title="Identificação do item">
          <dl className="info-pairs">
            <div>
              <dt>Fornecedor</dt>
              <dd>{supplier?.name ?? shortId(item.supplier_id)}</dd>
            </div>
            <div>
              <dt>Unidade de medida</dt>
              <dd>{item.unit}</dd>
            </div>
            <div>
              <dt>Variação</dt>
              <dd>{item.variant_key || "Sem variação informada"}</dd>
            </div>
            <div>
              <dt>Última atualização de saldo</dt>
              <dd>{date(balance?.updated_at, true)}</dd>
            </div>
          </dl>
        </Section>
        <Section
          title="Movimentações"
          description="Variações no saldo físico e na quantidade reservada são registradas separadamente."
          className="panel-flush"
        >
          {movements.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Operação</th>
                    <th>Contrato</th>
                    <th className="number">Variação física</th>
                    <th className="number">Variação reservada</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((movement) => (
                    <tr key={movement.id}>
                      <td>{date(movement.created_at, true)}</td>
                      <td>
                        <OperationBadge value={movement.kind} />
                      </td>
                      <td>
                        {movement.contract_id ? (
                          <Link
                            className="text-link"
                            href={`/contratos/${movement.contract_id}`}
                          >
                            {shortId(movement.contract_id)}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="number">
                        {quantity(movement.quantity_delta)} {item.unit}
                      </td>
                      <td className="number">
                        {quantity(movement.reserved_delta)} {item.unit}
                      </td>
                      <td style={{ whiteSpace: "normal", minWidth: 180 }}>
                        {movement.reason || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="Nenhuma movimentação"
              description="O item foi identificado, mas ainda não há recebimento, reserva ou entrega registrados."
            />
          )}
        </Section>
        <QueryLimit
          count={movements.length}
          subject="movimentações mais recentes deste item"
          indicators={false}
        />
        <Section title="Reservas do item" className="panel-flush">
          {reservations.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Contrato</th>
                    <th className="number">Quantidade</th>
                    <th>Situação</th>
                    <th>Criada em</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.map((reservation) => (
                    <tr key={reservation.id}>
                      <td>
                        <Link
                          className="text-link"
                          href={`/contratos/${reservation.contract_id}`}
                        >
                          {shortId(reservation.contract_id)}
                        </Link>
                      </td>
                      <td className="number">
                        {quantity(reservation.quantity)} {item.unit}
                      </td>
                      <td>
                        <OperationBadge value={reservation.status} />
                      </td>
                      <td>{date(reservation.created_at, true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="Nenhuma reserva registrada"
              description="Reserve os itens no estoque, escolhendo primeiro o contrato aprovado."
            />
          )}
        </Section>
        <QueryLimit
          count={reservations.length}
          subject="reservas mais recentes deste item"
          indicators={false}
        />
        <Notice>
          Uma reserva reduz a disponibilidade, sem retirar mercadoria
          fisicamente. A conclusão da entrega reduz o saldo físico e consome as
          reservas ativas do contrato. Não há ajuste manual de estoque nesta
          tela.
        </Notice>
        <div className="inline">
          <Button asChild variant="outline">
            <Link href="/estoque#reservar">Reservar para contrato</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/agenda">Consultar entregas</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
