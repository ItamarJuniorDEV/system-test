import Link from "next/link";
import {
  CheckCheck,
  CircleHelp,
  ClipboardList,
  Plus,
  UserRound,
} from "lucide-react";
import { AssistanceOpenForm } from "@/components/operations/forms";
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
import type { AssistanceTicket, Contract, Customer } from "@/lib/domain";
import { date } from "@/lib/format";
import { can, requireViewer } from "@/lib/server/auth";
import { list, one } from "@/lib/server/data";

export default async function AssistancePage({
  searchParams,
}: {
  searchParams: Promise<{ contrato?: string }>;
}) {
  const viewer = await requireViewer();
  const query = await searchParams;
  const [tickets, customers, contracts] = await Promise.all([
    list<AssistanceTicket>("assistance_tickets", {
      orderBy: "created_at",
      limit: LIST_LIMIT,
    }),
    list<Customer>("customers", {
      orderBy: "name",
      ascending: true,
      limit: LIST_LIMIT,
    }),
    list<Contract>("contracts", { orderBy: "created_at", limit: LIST_LIMIT }),
  ]);
  const selectedContract =
    query.contrato && isUuid(query.contrato)
      ? (contracts.find((contract) => contract.id === query.contrato) ??
        (await one<Contract>("contracts", query.contrato)))
      : null;
  if (
    selectedContract &&
    !contracts.some((contract) => contract.id === selectedContract.id)
  )
    contracts.unshift(selectedContract);
  if (
    selectedContract &&
    !customers.some((customer) => customer.id === selectedContract.customer_id)
  ) {
    const customer = await one<Customer>(
      "customers",
      selectedContract.customer_id,
    );
    if (customer) customers.unshift(customer);
  }
  const customerMap = new Map(
    customers.map((customer) => [customer.id, customer]),
  );
  const contractMap = new Map(
    contracts.map((contract) => [contract.id, contract]),
  );
  const canOpen = can(viewer, "operations", "commercial");
  return (
    <>
      <PageHeader
        eyebrow="Pós-venda · atendimento"
        title="Assistência técnica"
        description="Registre o problema, acompanhe cada ocorrência e documente a solução, com ou sem contrato anterior."
        actions={
          canOpen ? (
            <Button asChild>
              <Link href="#nova-assistencia">
                <Plus size={15} /> Abrir assistência
              </Link>
            </Button>
          ) : undefined
        }
      />
      <div className="stats-grid">
        <Stat
          title="Assistências na consulta"
          value={tickets.length}
          detail="Até 500 registros mais recentes"
          icon={<ClipboardList size={17} />}
        />
        <Stat
          title="Em aberto"
          value={tickets.filter((ticket) => ticket.status === "open").length}
          detail="Com tratamento em andamento"
          icon={<CircleHelp size={17} />}
        />
        <Stat
          title="Encerradas"
          value={tickets.filter((ticket) => ticket.status === "closed").length}
          icon={<CheckCheck size={17} />}
        />
        <Stat
          title="Sem contrato vinculado"
          value={tickets.filter((ticket) => !ticket.contract_id).length}
          detail="Cliente identificado em todos os casos"
          icon={<UserRound size={17} />}
        />
      </div>
      <div className="stack">
        {!canOpen && (
          <Notice>
            Seu perfil pode consultar as assistências. A abertura está
            disponível para Comercial, Operação e Administrador; o tratamento de
            ocorrências exige Operação ou Administrador.
          </Notice>
        )}
        {can(viewer, "commercial") && !can(viewer, "operations") && (
          <Notice>
            Seu perfil pode abrir uma assistência. A equipe de operação registra
            as ocorrências, soluções e o encerramento.
          </Notice>
        )}
        <Section title="Atendimentos registrados" className="panel-flush">
          {tickets.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Assistência</th>
                    <th>Cliente</th>
                    <th>Contrato</th>
                    <th>Abertura</th>
                    <th>Situação</th>
                    <th>
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td style={{ whiteSpace: "normal", minWidth: 210 }}>
                        <Link
                          className="text-link"
                          href={`/assistencia/${ticket.id}`}
                        >
                          {ticket.title}
                        </Link>
                        <small>{shortId(ticket.id)}</small>
                      </td>
                      <td>
                        {customerMap.get(ticket.customer_id)?.name ??
                          `Cliente ${shortId(ticket.customer_id)}`}
                      </td>
                      <td>
                        {ticket.contract_id ? (
                          <Link
                            className="text-link"
                            href={`/contratos/${ticket.contract_id}`}
                          >
                            {contractMap.get(ticket.contract_id)
                              ? `#${contractMap.get(ticket.contract_id)!.number}`
                              : shortId(ticket.contract_id)}
                          </Link>
                        ) : (
                          <span className="muted">Sem contrato</span>
                        )}
                      </td>
                      <td>{date(ticket.created_at)}</td>
                      <td>
                        <OperationBadge value={ticket.status} />
                      </td>
                      <td>
                        <Link
                          className="text-link"
                          href={`/assistencia/${ticket.id}`}
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
              title="Nenhuma assistência registrada"
              description="Abra um atendimento para um cliente e, em seguida, descreva as ocorrências e quem será responsável pelo custo."
            />
          )}
        </Section>
        <QueryLimit
          count={tickets.length}
          subject="assistências mais recentes"
        />
        <div id="nova-assistencia">
          <Section
            title="Abrir assistência"
            description="O contrato é opcional, mas o cliente precisa estar identificado."
          >
            {!canOpen ? (
              <Notice>Seu perfil não pode abrir assistências.</Notice>
            ) : !customers.length ? (
              <Empty
                title="Cadastre primeiro o cliente"
                description="A assistência pode ser independente de contrato, mas precisa pertencer a um cliente."
              >
                <Button asChild variant="outline">
                  <Link href="/clientes">Consultar clientes</Link>
                </Button>
              </Empty>
            ) : (
              <div className="stack">
                {query.contrato && !selectedContract && (
                  <Notice tone="warning">
                    O contrato informado não foi encontrado. Você pode
                    selecionar o cliente e abrir uma assistência sem contrato.
                  </Notice>
                )}
                <AssistanceOpenForm
                  customers={customers}
                  contracts={contracts}
                  initialCustomerId={selectedContract?.customer_id}
                  initialContractId={selectedContract?.id}
                />
                {(customers.length >= LIST_LIMIT ||
                  contracts.length >= LIST_LIMIT) && (
                  <p className="helper">
                    Os seletores consultam até 500 clientes e contratos. Um
                    contrato aberto pelo link da agenda também é carregado
                    diretamente.
                  </p>
                )}
              </div>
            )}
          </Section>
        </div>
        <Notice>
          Uma assistência pode ser resolvida por visita ou serviço, sem compra
          de peças. Nesta etapa, o pagador é registrado na ocorrência; peças,
          compras e cobranças vinculadas à ocorrência ainda não são geradas
          automaticamente.
        </Notice>
      </div>
    </>
  );
}
