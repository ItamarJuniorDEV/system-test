import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCheck,
  CircleHelp,
  ClipboardList,
  UserRound,
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
  operationLabel,
  ReadOnlyNotice,
  shortId,
} from "@/components/operations/common";
import type {
  AssistanceOccurrence,
  AssistanceTicket,
  Contract,
  Customer,
} from "@/lib/domain";
import { date } from "@/lib/format";
import { can, requireViewer } from "@/lib/server/auth";
import { listAll, one } from "@/lib/server/data";

export default async function AssistanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireViewer();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const ticket = await one<AssistanceTicket>("assistance_tickets", id);
  if (!ticket) notFound();
  const [customer, contract, occurrences] = await Promise.all([
    one<Customer>("customers", ticket.customer_id),
    ticket.contract_id
      ? one<Contract>("contracts", ticket.contract_id)
      : Promise.resolve(null),
    listAll<AssistanceOccurrence>("assistance_occurrences", {
      filters: { ticket_id: id },
      orderBy: "created_at",
      ascending: true,
    }),
  ]);
  const operate = can(viewer, "operations");
  const pending = occurrences.filter(
    (occurrence) => occurrence.status !== "resolved",
  );
  const canClose =
    ticket.status === "open" && occurrences.length > 0 && pending.length === 0;
  return (
    <>
      <PageHeader
        eyebrow={`Pós-venda · assistência ${shortId(id)}`}
        title={ticket.title}
        description={customer?.name ?? `Cliente ${shortId(ticket.customer_id)}`}
        actions={
          <Button asChild variant="outline">
            <Link href="/assistencia">
              <ArrowLeft size={15} /> Todos os atendimentos
            </Link>
          </Button>
        }
      />
      <div className="stats-grid">
        <Stat
          title="Ocorrências"
          value={occurrences.length}
          detail="Todas as ocorrências deste atendimento"
          icon={<ClipboardList size={17} />}
        />
        <Stat
          title="Pendentes"
          value={pending.length}
          icon={<CircleHelp size={17} />}
        />
        <Stat
          title="Resolvidas"
          value={occurrences.length - pending.length}
          icon={<CheckCheck size={17} />}
        />
        <Stat
          title="Situação da assistência"
          value={<OperationBadge value={ticket.status} />}
          detail={`Abertura: ${date(ticket.created_at)}`}
          icon={<UserRound size={17} />}
        />
      </div>
      <div className="stack">
        {!operate && <ReadOnlyNotice />}
        <div className="two-columns">
          <Section title="Vínculos do atendimento">
            <dl className="info-pairs">
              <div>
                <dt>Cliente</dt>
                <dd>{customer?.name ?? shortId(ticket.customer_id)}</dd>
              </div>
              <div>
                <dt>Contrato</dt>
                <dd>
                  {ticket.contract_id ? (
                    <Link
                      className="text-link"
                      href={`/contratos/${ticket.contract_id}`}
                    >
                      {contract
                        ? `#${contract.number}`
                        : shortId(ticket.contract_id)}
                    </Link>
                  ) : (
                    "Assistência independente de contrato"
                  )}
                </dd>
              </div>
              <div>
                <dt>Aberta em</dt>
                <dd>{date(ticket.created_at, true)}</dd>
              </div>
              <div>
                <dt>Encerrada em</dt>
                <dd>{date(ticket.closed_at, true)}</dd>
              </div>
            </dl>
          </Section>
          <Section
            title="Encerramento"
            description="A assistência só é encerrada depois da solução de todas as ocorrências."
          >
            {ticket.status === "closed" ? (
              <Notice tone="success">
                Atendimento encerrado em {date(ticket.closed_at, true)}. As
                ocorrências e soluções permanecem disponíveis para consulta.
              </Notice>
            ) : canClose && operate ? (
              <ActionForm
                command="assistance.close"
                submitLabel="Encerrar assistência"
                confirm="Encerrar a assistência com todas as ocorrências resolvidas? Não há reabertura disponível nesta etapa."
              >
                <input type="hidden" name="ticket_id" value={id} />
                <Notice tone="success">
                  Todas as {occurrences.length} ocorrências estão resolvidas.
                  Confira as soluções registradas antes de encerrar.
                </Notice>
              </ActionForm>
            ) : (
              <Notice>
                {!occurrences.length
                  ? "Registre ao menos uma ocorrência e sua solução antes de encerrar."
                  : pending.length
                    ? `Ainda há ${pending.length} ocorrência(s) pendente(s).`
                    : "Seu perfil pode consultar, mas o encerramento exige Operação ou Administrador."}
              </Notice>
            )}
          </Section>
        </div>
        <Section
          title="Ocorrências e soluções"
          description="Cliente, loja, fábrica ou transportadora podem ser registrados como responsáveis pelo custo."
        >
          {occurrences.length ? (
            <div className="stack">
              {occurrences.map((occurrence, index) => (
                <article className="environment-card" key={occurrence.id}>
                  <div className="space-between align-start">
                    <div>
                      <h3>Ocorrência {index + 1}</h3>
                      <p className="helper mt">
                        Pagador:{" "}
                        <strong>{operationLabel(occurrence.payer)}</strong> ·{" "}
                        {date(occurrence.created_at, true)}
                      </p>
                    </div>
                    <OperationBadge value={occurrence.status} />
                  </div>
                  <p
                    className="mt"
                    style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                  >
                    {occurrence.description}
                  </p>
                  {occurrence.status === "resolved" ? (
                    <div className="mt">
                      <Notice tone="success">
                        <strong>Solução registrada</strong>
                        <p style={{ whiteSpace: "pre-wrap" }}>
                          {occurrence.resolution}
                        </p>
                      </Notice>
                    </div>
                  ) : operate && ticket.status === "open" ? (
                    <details className="details-block mt">
                      <summary>Registrar solução desta ocorrência</summary>
                      <div>
                        <ActionForm
                          command="assistance.resolve"
                          submitLabel="Marcar ocorrência como resolvida"
                          confirm="Confirmar a solução desta ocorrência? A solução registrada não pode ser alterada por esta tela."
                        >
                          <input
                            type="hidden"
                            name="occurrence_id"
                            value={occurrence.id}
                          />
                          <Field
                            label="Solução realizada"
                            hint="Descreva o serviço ou ajuste efetivamente executado."
                          >
                            <textarea
                              name="resolution"
                              required
                              maxLength={2000}
                              placeholder="O que foi feito para resolver o problema?"
                            />
                          </Field>
                        </ActionForm>
                      </div>
                    </details>
                  ) : (
                    <p className="helper mt">
                      A solução deve ser registrada pela equipe de operação
                      enquanto a assistência estiver aberta.
                    </p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <Empty
              title="Descreva a primeira ocorrência"
              description="Uma ocorrência identifica o problema e seu pagador. A solução pode ser um serviço sem reposição de peças."
            />
          )}
        </Section>
        {ticket.status === "open" && operate && (
          <Section title="Adicionar ocorrência">
            <ActionForm
              command="assistance.add"
              submitLabel="Adicionar ocorrência"
              resetOnSuccess
            >
              <input type="hidden" name="ticket_id" value={id} />
              <div className="form-grid">
                <Field
                  label="Quem será responsável pelo custo?"
                  hint="Este registro não gera cobrança nem pagamento automático."
                >
                  <select name="payer" required defaultValue="store">
                    <option value="store">Loja</option>
                    <option value="customer">Cliente</option>
                    <option value="factory">Fábrica</option>
                    <option value="carrier">Transportadora</option>
                  </select>
                </Field>
                <Field label="Descrição do problema" className="full-width">
                  <textarea
                    name="description"
                    required
                    maxLength={2000}
                    placeholder="Informe o ambiente, item ou situação que precisa de atendimento."
                  />
                </Field>
              </div>
            </ActionForm>
          </Section>
        )}
        <Notice>
          Abertura, ocorrências, solução e encerramento estão disponíveis aqui.
          Compra de peças, agenda técnica específica, repasses e cobrança
          integrada da assistência continuam fora desta etapa.
        </Notice>
      </div>
    </>
  );
}
