import Link from "next/link";
import { Boxes, PackageCheck, PackageOpen, ShieldCheck } from "lucide-react";
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
  LIST_LIMIT,
  OperationBadge,
  quantityRemainder,
  QueryLimit,
  ReadOnlyNotice,
  shortId,
} from "@/components/operations/common";
import type {
  Contract,
  Customer,
  InventoryItem,
  PurchaseItem,
  PurchaseOrder,
  StockBalance,
  StockReservation,
} from "@/lib/domain";
import { date, quantity } from "@/lib/format";
import { can, requireViewer } from "@/lib/server/auth";
import { list, listAll, one } from "@/lib/server/data";

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ contrato?: string }>;
}) {
  const viewer = await requireViewer();
  const query = await searchParams;
  const [balances, items, contracts, customers, reservations] =
    await Promise.all([
      list<StockBalance>("stock_balances", {
        orderBy: "updated_at",
        limit: LIST_LIMIT,
      }),
      listAll<InventoryItem>("inventory_items", { orderBy: "created_at" }),
      list<Contract>("contracts", { orderBy: "created_at", limit: LIST_LIMIT }),
      list<Customer>("customers", {
        orderBy: "name",
        ascending: true,
        limit: LIST_LIMIT,
      }),
      list<StockReservation>("stock_reservations", {
        filters: { status: "active" },
        orderBy: "created_at",
        limit: LIST_LIMIT,
      }),
    ]);
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const contractMap = new Map(
    contracts.map((contract) => [contract.id, contract]),
  );
  const customerMap = new Map(
    customers.map((customer) => [customer.id, customer]),
  );
  const balanceMap = new Map(
    balances.map((balance) => [balance.inventory_item_id, balance]),
  );
  const fullyApproved = (contract: Contract) =>
    contract.status === "active" &&
    Boolean(
      contract.signed_at &&
      contract.commercial_approved_at &&
      contract.financial_approved_at,
    );
  const eligibleContracts = contracts.filter(fullyApproved);
  let selectedContract: Contract | null = null;
  if (query.contrato && isUuid(query.contrato)) {
    const candidate =
      contractMap.get(query.contrato) ??
      (await one<Contract>("contracts", query.contrato));
    if (candidate && fullyApproved(candidate)) {
      selectedContract = candidate;
      if (!eligibleContracts.some((contract) => contract.id === candidate.id))
        eligibleContracts.unshift(candidate);
      contractMap.set(candidate.id, candidate);
    }
  }
  let contractOrders: PurchaseOrder[] = [];
  let orderItems: PurchaseItem[][] = [];
  let contractReservations: StockReservation[] = [];
  if (selectedContract) {
    [contractOrders, contractReservations] = await Promise.all([
      listAll<PurchaseOrder>("purchase_orders", {
        filters: { contract_id: selectedContract.id },
        orderBy: "created_at",
      }),
      listAll<StockReservation>("stock_reservations", {
        filters: { contract_id: selectedContract.id },
      }),
    ]);
    orderItems = await Promise.all(
      contractOrders
        .filter((order) => order.status !== "cancelled")
        .map((order) =>
          listAll<PurchaseItem>("purchase_order_items", {
            filters: { purchase_order_id: order.id },
          }),
        ),
    );
  }
  const eligibleItems = new Map<string, PurchaseItem>();
  const needed = new Map<string, number>();
  for (const item of orderItems.flat()) {
    eligibleItems.set(item.inventory_item_id, item);
    needed.set(
      item.inventory_item_id,
      (needed.get(item.inventory_item_id) ?? 0) + Number(item.quantity),
    );
  }
  const allocated = new Map<string, number>();
  for (const reservation of contractReservations) {
    if (["active", "fulfilled"].includes(reservation.status))
      allocated.set(
        reservation.inventory_item_id,
        (allocated.get(reservation.inventory_item_id) ?? 0) +
          Number(reservation.quantity),
      );
  }
  const pendingReservation = (id: string) =>
    quantityRemainder(needed.get(id) ?? 0, allocated.get(id) ?? 0);
  if ([...eligibleItems.keys()].some((id) => !balanceMap.has(id))) {
    const allBalances = await listAll<StockBalance>("stock_balances");
    for (const balance of allBalances)
      balanceMap.set(balance.inventory_item_id, balance);
  }
  const reserveItems = [...eligibleItems.values()];
  const hasPending = reserveItems.some(
    (item) => pendingReservation(item.inventory_item_id) > 0,
  );
  const hasAvailable = reserveItems.some(
    (item) =>
      Number(balanceMap.get(item.inventory_item_id)?.available ?? 0) > 0 &&
      pendingReservation(item.inventory_item_id) > 0,
  );
  const operate = can(viewer, "operations");
  return (
    <>
      <PageHeader
        eyebrow="Operação · estoque"
        title="Saldos e reservas"
        description="Diferencie o que está fisicamente na loja, o que está reservado e o que pode ser destinado a um contrato."
        actions={
          <Button asChild variant="outline">
            <Link href="/compras">Registrar recebimento</Link>
          </Button>
        }
      />
      <div className="stats-grid">
        <Stat
          title="Itens na consulta"
          value={balances.length}
          detail="Saldos alterados mais recentemente"
          icon={<Boxes size={17} />}
        />
        <Stat
          title="Com saldo disponível"
          value={
            balances.filter((balance) => Number(balance.available) > 0).length
          }
          detail="Quantidade de itens, não de unidades"
          icon={<PackageOpen size={17} />}
        />
        <Stat
          title="Com quantidade reservada"
          value={
            balances.filter((balance) => Number(balance.reserved) > 0).length
          }
          detail="Itens com compromisso de entrega"
          icon={<ShieldCheck size={17} />}
        />
        <Stat
          title="Reservas ativas listadas"
          value={reservations.length}
          detail="Até 500 reservas mais recentes"
          icon={<PackageCheck size={17} />}
        />
      </div>
      <div className="stack">
        {!operate && <ReadOnlyNotice />}
        <Section
          title="Disponibilidade por item"
          description="As unidades permanecem separadas. Não somamos peças, metros e outras medidas em um único saldo."
          className="panel-flush"
        >
          {balances.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Un.</th>
                    <th className="number">Físico</th>
                    <th className="number">Reservado</th>
                    <th className="number">Disponível</th>
                    <th>Atualizado em</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.map((balance) => {
                    const item = itemMap.get(balance.inventory_item_id);
                    return (
                      <tr key={balance.inventory_item_id}>
                        <td>
                          <Link
                            className="text-link"
                            href={`/estoque/${balance.inventory_item_id}`}
                          >
                            {item?.code ??
                              `Item ${shortId(balance.inventory_item_id)}`}
                          </Link>
                          <small>
                            {item?.description ??
                              "Abra o item para consultar o cadastro completo."}
                          </small>
                        </td>
                        <td>{item?.unit ?? "—"}</td>
                        <td className="number">{quantity(balance.on_hand)}</td>
                        <td className="number">{quantity(balance.reserved)}</td>
                        <td className="number">
                          <strong>{quantity(balance.available)}</strong>
                        </td>
                        <td>{date(balance.updated_at, true)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="Ainda não há itens em estoque"
              description="Os itens são identificados ao gerar compras. O recebimento confirmado acrescenta as quantidades ao saldo físico."
            >
              <Button asChild variant="outline">
                <Link href="/compras">Consultar pedidos</Link>
              </Button>
            </Empty>
          )}
        </Section>
        <QueryLimit count={balances.length} subject="saldos mais recentes" />
        <div id="reservar">
          <Section
            title="Reservar para um contrato"
            description="A reserva é explícita: receber a mercadoria não a destina automaticamente ao cliente."
          >
            <div className="stack">
              <form method="get" action="/estoque" className="form-grid">
                <Field
                  label="Contrato aprovado"
                  hint="Exige assinatura e aprovações comercial e financeira ativas."
                >
                  <select
                    name="contrato"
                    required
                    defaultValue={selectedContract?.id ?? ""}
                  >
                    <option value="">Selecione o contrato</option>
                    {eligibleContracts.map((contract) => (
                      <option key={contract.id} value={contract.id}>
                        #{contract.number} ·{" "}
                        {customerMap.get(contract.customer_id)?.name ??
                          shortId(contract.customer_id)}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="inline" style={{ alignSelf: "end" }}>
                  <Button type="submit" variant="outline">
                    Consultar itens do contrato
                  </Button>
                </div>
              </form>
              {contracts.length >= LIST_LIMIT && (
                <Notice tone="warning">
                  A seleção considera os 500 contratos mais recentes. Um
                  contrato acessado pelo link do próprio pedido também pode ser
                  carregado diretamente.
                </Notice>
              )}
              {query.contrato && !selectedContract && (
                <Notice tone="warning">
                  O contrato solicitado não está disponível para reserva.
                  Confira se está ativo, assinado e com as duas aprovações
                  registradas.
                </Notice>
              )}
              {!selectedContract ? (
                <p className="helper">
                  Selecione um contrato para exibir os itens dos seus pedidos
                  não cancelados.
                </p>
              ) : (
                <>
                  <p className="helper">
                    Contrato{" "}
                    <Link
                      className="text-link"
                      href={`/contratos/${selectedContract.id}`}
                    >
                      #{selectedContract.number}
                    </Link>
                    . Só aparecem itens vinculados aos seus pedidos. Quantidades
                    já reservadas ou entregues continuam contando para o limite
                    do contrato.
                  </p>
                  {operate && reserveItems.length && hasAvailable ? (
                    <ActionForm
                      command="stock.reserve"
                      submitLabel="Confirmar reserva"
                      resetOnSuccess
                      confirm="Reservar estas quantidades para o contrato selecionado? O saldo disponível será reduzido; o saldo físico só muda na entrega."
                    >
                      <input
                        type="hidden"
                        name="contract_id"
                        value={selectedContract.id}
                      />
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Item do contrato</th>
                              <th>Un.</th>
                              <th className="number">Pendente de reserva</th>
                              <th className="number">Disponível</th>
                              <th>Reservar agora</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reserveItems.map((item) => {
                              const balance = balanceMap.get(
                                item.inventory_item_id,
                              );
                              const available = Number(balance?.available ?? 0);
                              const remaining = pendingReservation(
                                item.inventory_item_id,
                              );
                              return (
                                <tr key={item.inventory_item_id}>
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
                                  <td className="number">
                                    {quantity(remaining)}
                                  </td>
                                  <td className="number">
                                    {balance
                                      ? quantity(balance.available)
                                      : "Saldo indisponível"}
                                  </td>
                                  <td>
                                    {available > 0 && remaining > 0 ? (
                                      <input
                                        className="table-input"
                                        type="number"
                                        name={`quantity:${item.inventory_item_id}`}
                                        aria-label={`Quantidade a reservar de ${item.code}`}
                                        min="0"
                                        max={Math.min(
                                          available,
                                          remaining,
                                          1_000_000,
                                        )}
                                        step="0.0001"
                                        placeholder="0"
                                      />
                                    ) : (
                                      <span className="muted">
                                        {remaining === 0
                                          ? "Já reservado ou entregue"
                                          : "Sem disponibilidade"}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <p className="helper">
                        Deixe em branco os itens que não serão reservados. A
                        operação valida o saldo e o limite ainda necessário para
                        o contrato.
                      </p>
                    </ActionForm>
                  ) : (
                    <Notice>
                      {!operate
                        ? "Seu perfil pode consultar os itens, mas não registrar reservas."
                        : !reserveItems.length
                          ? "Este contrato ainda não tem itens em pedidos de compra disponíveis para reserva."
                          : !hasPending
                            ? "Todos os itens dos pedidos deste contrato já estão reservados ou entregues."
                            : "Os itens ainda pendentes de reserva não têm saldo disponível. Confira os recebimentos e as reservas existentes."}
                    </Notice>
                  )}
                </>
              )}
            </div>
          </Section>
        </div>
        <Section
          title="Reservas ativas"
          description="A conclusão de uma entrega consome todas as reservas ativas do contrato correspondente."
          className="panel-flush"
        >
          {reservations.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Contrato</th>
                    <th>Item</th>
                    <th className="number">Quantidade</th>
                    <th>Situação</th>
                    <th>Reservado em</th>
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
                          {contractMap.get(reservation.contract_id)
                            ? `#${contractMap.get(reservation.contract_id)!.number}`
                            : shortId(reservation.contract_id)}
                        </Link>
                      </td>
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
              title="Nenhuma reserva ativa"
              description="Selecione um contrato aprovado e reserve explicitamente as quantidades necessárias para sua entrega."
            />
          )}
        </Section>
        <QueryLimit
          count={reservations.length}
          subject="reservas ativas mais recentes"
        />
      </div>
    </>
  );
}
