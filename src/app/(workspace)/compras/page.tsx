import Link from "next/link";
import {
  ArrowUpRight,
  PackageCheck,
  ShoppingCart,
  Truck,
  Wallet,
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
  LIST_LIMIT,
  OperationBadge,
  QueryLimit,
  ReadOnlyNotice,
  shortId,
} from "@/components/operations/common";
import type { Contract, PurchaseOrder, Supplier } from "@/lib/domain";
import { brl, date } from "@/lib/format";
import { can, requireViewer } from "@/lib/server/auth";
import { list } from "@/lib/server/data";

export default async function PurchasesPage() {
  const viewer = await requireViewer();
  const [orders, suppliers, contracts] = await Promise.all([
    list<PurchaseOrder>("purchase_orders", {
      orderBy: "created_at",
      limit: LIST_LIMIT,
    }),
    list<Supplier>("suppliers", {
      orderBy: "name",
      ascending: true,
      limit: LIST_LIMIT,
    }),
    list<Contract>("contracts", { orderBy: "created_at", limit: LIST_LIMIT }),
  ]);
  const supplierMap = new Map(
    suppliers.map((supplier) => [supplier.id, supplier]),
  );
  const contractMap = new Map(
    contracts.map((contract) => [contract.id, contract]),
  );
  const active = orders.filter((order) => order.status !== "cancelled");
  return (
    <>
      <PageHeader
        eyebrow="Operação · compras"
        title="Pedidos de compra"
        description="Acompanhe o pedido, registre o envio local e confira as quantidades recebidas."
        actions={
          <Button asChild variant="outline">
            <Link href="/contratos">
              Ver contratos <ArrowUpRight size={15} />
            </Link>
          </Button>
        }
      />
      <div className="stats-grid">
        <Stat
          title="Pedidos na consulta"
          value={orders.length}
          detail="Até 500 pedidos mais recentes"
          icon={<ShoppingCart size={17} />}
        />
        <Stat
          title="Aguardando envio"
          value={orders.filter((order) => order.status === "draft").length}
          detail="Rascunhos locais"
          icon={<Truck size={17} />}
        />
        <Stat
          title="Recebimento parcial"
          value={
            orders.filter((order) => order.status === "partially_received")
              .length
          }
          detail="Ainda há itens pendentes"
          icon={<PackageCheck size={17} />}
        />
        <Stat
          title="Valor dos pedidos ativos"
          value={brl(
            active.reduce((sum, order) => sum + Number(order.total_cents), 0),
          )}
          detail="Somente o recorte desta consulta"
          icon={<Wallet size={17} />}
        />
      </div>
      <div className="stack">
        {!can(viewer, "operations") && <ReadOnlyNotice />}
        <Notice>
          Os pedidos desta etapa são gerados a partir de uma revisão aprovada,
          no detalhe do contrato, e separados por fornecedor. Marcar como
          enviado registra uma decisão local; não transmite o pedido à fábrica.
        </Notice>
        <Section
          title="Pedidos registrados"
          description="Abra um pedido para conferir seus itens e registrar um recebimento parcial ou total."
          className="panel-flush"
        >
          {orders.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Pedido</th>
                    <th>Fornecedor</th>
                    <th>Contrato</th>
                    <th>Criado em</th>
                    <th>Situação</th>
                    <th className="number">Total</th>
                    <th>
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <Link
                          className="text-link"
                          href={`/compras/${order.id}`}
                        >
                          #{order.number}
                        </Link>
                      </td>
                      <td>
                        {supplierMap.get(order.supplier_id)?.name ??
                          `Fornecedor ${shortId(order.supplier_id)}`}
                      </td>
                      <td>
                        <Link
                          className="text-link"
                          href={`/contratos/${order.contract_id}`}
                        >
                          {contractMap.has(order.contract_id)
                            ? `#${contractMap.get(order.contract_id)!.number}`
                            : shortId(order.contract_id)}
                        </Link>
                      </td>
                      <td>{date(order.created_at)}</td>
                      <td>
                        <OperationBadge value={order.status} />
                      </td>
                      <td className="number">{brl(order.total_cents)}</td>
                      <td>
                        <Link
                          className="text-link"
                          href={`/compras/${order.id}`}
                          aria-label={`Abrir pedido ${order.number}`}
                        >
                          Abrir →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="Nenhum pedido registrado"
              description="Conclua a revisão de um contrato para gerar os pedidos por fornecedor."
            >
              <Button asChild variant="outline">
                <Link href="/contratos">Consultar contratos</Link>
              </Button>
            </Empty>
          )}
        </Section>
        <QueryLimit count={orders.length} subject="pedidos mais recentes" />
      </div>
    </>
  );
}
