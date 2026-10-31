import Link from "next/link";
import { CalendarDays, CheckCheck, Plus, Truck, Wrench } from "lucide-react";
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
  operationLabel,
  QueryLimit,
  ReadOnlyNotice,
  shortId,
} from "@/components/operations/common";
import type { Appointment, Contract, Customer, Profile } from "@/lib/domain";
import { date } from "@/lib/format";
import { can, requireViewer } from "@/lib/server/auth";
import { list, one } from "@/lib/server/data";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ contrato?: string }>;
}) {
  const viewer = await requireViewer();
  const query = await searchParams;
  const [appointments, contracts, customers, profiles] = await Promise.all([
    list<Appointment>("appointments", {
      orderBy: "created_at",
      limit: LIST_LIMIT,
    }),
    list<Contract>("contracts", { orderBy: "created_at", limit: LIST_LIMIT }),
    list<Customer>("customers", {
      orderBy: "name",
      ascending: true,
      limit: LIST_LIMIT,
    }),
    list<Profile>("profiles", {
      orderBy: "name",
      ascending: true,
      limit: LIST_LIMIT,
    }),
  ]);
  const fullyApproved = (contract: Contract) =>
    contract.status === "active" &&
    Boolean(
      contract.signed_at &&
      contract.commercial_approved_at &&
      contract.financial_approved_at,
    );
  const eligibleContracts = contracts.filter(fullyApproved);
  let selectedContract =
    query.contrato && isUuid(query.contrato)
      ? (contracts.find((contract) => contract.id === query.contrato) ??
        (await one<Contract>("contracts", query.contrato)))
      : null;
  if (selectedContract && !fullyApproved(selectedContract))
    selectedContract = null;
  if (
    selectedContract &&
    !eligibleContracts.some((contract) => contract.id === selectedContract.id)
  )
    eligibleContracts.unshift(selectedContract);
  const contractMap = new Map(
    contracts.map((contract) => [contract.id, contract]),
  );
  const customerMap = new Map(
    customers.map((customer) => [customer.id, customer]),
  );
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const sortedAppointments = [...appointments].sort((a, b) =>
    a.starts_at.localeCompare(b.starts_at),
  );
  const operate = can(viewer, "operations");
  return (
    <>
      <PageHeader
        eyebrow="Operação · execução"
        title="Agenda de entrega e montagem"
        description="Planeje horários e registre a conclusão de cada compromisso. Todas as horas são apresentadas em São Paulo."
        actions={
          operate ? (
            <Button asChild>
              <Link href="#novo-agendamento">
                <Plus size={15} /> Novo agendamento
              </Link>
            </Button>
          ) : undefined
        }
      />
      <div className="stats-grid">
        <Stat
          title="Agendados na consulta"
          value={
            appointments.filter(
              (appointment) => appointment.status === "scheduled",
            ).length
          }
          detail="Até 500 registros mais recentes"
          icon={<CalendarDays size={17} />}
        />
        <Stat
          title="Entregas pendentes"
          value={
            appointments.filter(
              (appointment) =>
                appointment.status === "scheduled" &&
                appointment.kind === "delivery",
            ).length
          }
          icon={<Truck size={17} />}
        />
        <Stat
          title="Montagens pendentes"
          value={
            appointments.filter(
              (appointment) =>
                appointment.status === "scheduled" &&
                appointment.kind === "assembly",
            ).length
          }
          icon={<Wrench size={17} />}
        />
        <Stat
          title="Concluídos na consulta"
          value={
            appointments.filter(
              (appointment) => appointment.status === "completed",
            ).length
          }
          icon={<CheckCheck size={17} />}
        />
      </div>
      <div className="stack">
        {!operate && <ReadOnlyNotice />}
        <Section
          title="Compromissos"
          description="Os registros mais recentes estão ordenados por início. Abra o compromisso para conferir seu efeito antes de concluir."
          className="panel-flush"
        >
          {sortedAppointments.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Serviço</th>
                    <th>Contrato / cliente</th>
                    <th>Início</th>
                    <th>Fim</th>
                    <th>Responsável</th>
                    <th>Situação</th>
                    <th>
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAppointments.map((appointment) => {
                    const contract = contractMap.get(appointment.contract_id);
                    return (
                      <tr key={appointment.id}>
                        <td>
                          <Link
                            className="text-link"
                            href={`/agenda/${appointment.id}`}
                          >
                            {operationLabel(appointment.kind)}
                          </Link>
                        </td>
                        <td>
                          <Link
                            className="text-link"
                            href={`/contratos/${appointment.contract_id}`}
                          >
                            {contract
                              ? `#${contract.number}`
                              : shortId(appointment.contract_id)}
                          </Link>
                          <small>
                            {contract
                              ? customerMap.get(contract.customer_id)?.name
                              : ""}
                          </small>
                        </td>
                        <td>{date(appointment.starts_at, true)}</td>
                        <td>{date(appointment.ends_at, true)}</td>
                        <td>
                          {appointment.assigned_to === viewer.id
                            ? viewer.name
                            : (profileMap.get(appointment.assigned_to)?.name ??
                              shortId(appointment.assigned_to))}
                        </td>
                        <td>
                          <OperationBadge value={appointment.status} />
                        </td>
                        <td>
                          <Link
                            className="text-link"
                            href={`/agenda/${appointment.id}`}
                          >
                            Abrir →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="Nenhum compromisso registrado"
              description="Agende uma entrega ou montagem para um contrato ativo e aprovado."
            />
          )}
        </Section>
        <QueryLimit
          count={appointments.length}
          subject="agendamentos registrados mais recentemente"
        />
        <div id="novo-agendamento">
          <Section
            title="Novo agendamento"
            description="Nesta etapa, quem registra o compromisso também é seu responsável."
          >
            {!operate ? (
              <ReadOnlyNotice />
            ) : !eligibleContracts.length ? (
              <Empty
                title="Nenhum contrato elegível"
                description="O agendamento exige contrato ativo, assinatura e aprovações comercial e financeira."
              >
                <Button asChild variant="outline">
                  <Link href="/contratos">Consultar contratos</Link>
                </Button>
              </Empty>
            ) : (
              <ActionForm
                command="appointment.create"
                submitLabel="Agendar compromisso"
                resetOnSuccess
              >
                <div className="form-grid">
                  <Field label="Contrato aprovado">
                    <select
                      name="contract_id"
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
                  <Field label="Tipo de compromisso">
                    <select name="kind" defaultValue="delivery">
                      <option value="delivery">Entrega</option>
                      <option value="assembly">Montagem</option>
                    </select>
                  </Field>
                  <Field
                    label="Data e hora de início"
                    hint="Horário de São Paulo, UTC−3."
                  >
                    <input
                      name="starts_at"
                      type="datetime-local"
                      required
                      step="60"
                    />
                  </Field>
                  <Field
                    label="Data e hora de término"
                    hint="O término precisa ser posterior ao início."
                  >
                    <input
                      name="ends_at"
                      type="datetime-local"
                      required
                      step="60"
                    />
                  </Field>
                  <Field label="Observações (opcional)" className="full-width">
                    <textarea
                      name="notes"
                      maxLength={5000}
                      placeholder="Instruções para este compromisso"
                    />
                  </Field>
                </div>
                <Notice>
                  Responsável: <strong>{viewer.name}</strong>. O sistema
                  verifica sobreposição com os seus outros compromissos
                  agendados. A seleção de equipe e capacidade de vários
                  profissionais ainda não está disponível.
                </Notice>
                {contracts.length >= LIST_LIMIT && (
                  <p className="helper">
                    A seleção mostra contratos elegíveis entre os 500 mais
                    recentes. O link de um contrato específico pode carregá-lo
                    diretamente.
                  </p>
                )}
              </ActionForm>
            )}
          </Section>
        </div>
        <Notice tone="warning">
          Concluir uma entrega consome todas as reservas ativas daquele
          contrato, mesmo que sejam parte dos itens totais. A montagem só pode
          ser concluída depois da entrega integral dos itens previstos nos
          pedidos da revisão.
        </Notice>
      </div>
    </>
  );
}
