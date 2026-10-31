import Link from "next/link";
import {
  ArrowUpRight,
  Plus,
  FolderKanban,
  ClipboardCheck,
  CalendarDays,
  Wallet,
  ChevronRight,
  ArrowRight,
  Wrench,
} from "lucide-react";
import { list, rpc } from "@/lib/server/data";
import { requireViewer, can } from "@/lib/server/auth";
import type { Project, Customer, Contract, Appointment } from "@/lib/domain";
import { brl, date } from "@/lib/format";
import {
  PageHeader,
  Stat,
  Section,
  Badge,
  Empty,
} from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";

export default async function Dashboard() {
  const viewer = await requireViewer();
  const [metrics, projects, customers, contracts, appointments] =
    await Promise.all([
      rpc("dashboard_metrics", {}),
      list<Project>("projects", { orderBy: "created_at", limit: 6 }),
      list<Customer>("customers"),
      list<Contract>("contracts"),
      list<Appointment>("appointments", {
        filters: { status: "scheduled" },
        orderBy: "starts_at",
        ascending: true,
        limit: 5,
      }),
    ]);
  const customerMap = new Map(customers.map((c) => [c.id, c]));
  return (
    <>
      <PageHeader
        eyebrow="SEU DIA NA LOJA"
        title="Visão geral"
        description="Uma visão do que está em andamento e das próximas entregas da sua loja."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/mapa">
                Mapa dos processos <ArrowUpRight size={14} />
              </Link>
            </Button>
            <Button asChild>
              <Link href="/projetos">
                <Plus size={15} /> Novo projeto
              </Link>
            </Button>
          </>
        }
      />
      <div className="stats-grid">
        <Stat
          title="Projetos em andamento"
          value={String(metrics.projects ?? 0)}
          detail="Em atendimento e execução"
          icon={<FolderKanban size={16} />}
        />
        <Stat
          title="Contratos em acompanhamento"
          value={String(metrics.contracts ?? 0)}
          detail="Rascunhos e contratos ativos"
          icon={<ClipboardCheck size={16} />}
        />
        <Stat
          title="Serviços agendados"
          value={String(metrics.scheduled_appointments ?? 0)}
          detail="Entregas e montagens pendentes"
          icon={<CalendarDays size={16} />}
        />
        {can(viewer, "finance") ? (
          <Stat
            title="Saldo a receber"
            value={brl(String(metrics.receivable_cents ?? 0))}
            detail="Títulos efetivados, descontadas as baixas"
            icon={<Wallet size={16} />}
          />
        ) : (
          <Stat
            title="Assistências abertas"
            value={String(metrics.open_assistance ?? 0)}
            detail="Ocorrências em acompanhamento"
            icon={<Wrench size={16} />}
          />
        )}
      </div>
      <div className="content-grid">
        <div className="stack">
          <Section
            title="Projetos recentes"
            description="Acompanhe os ambientes e a evolução de cada projeto."
            className="panel-flush"
            actions={
              <Link className="text-link" href="/projetos">
                Ver todos <ArrowRight size={13} style={{ display: "inline" }} />
              </Link>
            }
          >
            {projects.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Projeto / Cliente</th>
                      <th>Situação</th>
                      <th>Criação</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <Link href={`/projetos/${p.id}`}>
                            <strong>{p.name}</strong>
                            <small>
                              {customerMap.get(p.customer_id)?.name ??
                                "Cliente vinculado"}
                            </small>
                          </Link>
                        </td>
                        <td>
                          <Badge value={p.status} />
                        </td>
                        <td>{date(p.created_at)}</td>
                        <td>
                          <Link
                            href={`/projetos/${p.id}`}
                            className="text-link"
                            aria-label={`Abrir ${p.name}`}
                          >
                            <ChevronRight size={17} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="Seu primeiro projeto começa aqui"
                description="Cadastre um cliente e crie um projeto para organizar os ambientes e importar os itens."
              >
                <Button asChild>
                  <Link href="/clientes">Cadastrar cliente</Link>
                </Button>
              </Empty>
            )}
          </Section>
          <Section
            title="Um processo, etapas conectadas"
            description="Cada etapa preserva seus registros e exige as liberações correspondentes."
          >
            <div className="flow-grid">
              {[
                ["01", "Projeto e XML", "Ambientes e versões", "/projetos"],
                ["02", "Contrato", "Orçamento e aprovações", "/contratos"],
                ["03", "Operação", "Revisão, compra e estoque", "/compras"],
                ["04", "Pós-venda", "Entrega, montagem e suporte", "/agenda"],
              ].map(([n, title, sub, href]) => (
                <Link href={href} className="flow-card" key={n}>
                  <b>{n}</b>
                  <div>
                    <strong>{title}</strong>
                    <small>{sub}</small>
                  </div>
                </Link>
              ))}
            </div>
          </Section>
        </div>
        <div className="stack">
          <Section
            title="Próximos serviços"
            description="Agenda operacional da loja"
          >
            {appointments.length ? (
              <div className="item-list">
                {appointments.map((a) => (
                  <Link className="item-row" href="/agenda" key={a.id}>
                    <div>
                      <Badge value={a.kind} />
                      <h3 style={{ marginTop: 6 }}>
                        Contrato #
                        {contracts.find((c) => c.id === a.contract_id)
                          ?.number ?? "—"}
                      </h3>
                      <p>{date(a.starts_at, true)}</p>
                    </div>
                    <ChevronRight size={16} />
                  </Link>
                ))}
              </div>
            ) : (
              <Empty
                title="Agenda livre"
                description="Programe entregas e montagens a partir de um contrato liberado."
              />
            )}
          </Section>
          <Section title="Pontos de atenção">
            <div className="item-list">
              <Link href="/contratos" className="item-row">
                <div className="inline">
                  <span className="item-icon">
                    <ClipboardCheck size={17} />
                  </span>
                  <div>
                    <h3>Revisões em aberto</h3>
                    <p>Conferência antes da compra</p>
                  </div>
                </div>
                <strong>{String(metrics.pending_reviews ?? 0)}</strong>
              </Link>
              <Link href="/assistencia" className="item-row">
                <div className="inline">
                  <span className="item-icon">
                    <Wrench size={17} />
                  </span>
                  <div>
                    <h3>Assistências</h3>
                    <p>Solicitações não encerradas</p>
                  </div>
                </div>
                <strong>{String(metrics.open_assistance ?? 0)}</strong>
              </Link>
            </div>
          </Section>
          <p className="helper">
            Valores financeiros consideram títulos efetivados. Previsões
            aparecem separadamente no financeiro. Datas em horário de São Paulo.
          </p>
        </div>
      </div>
    </>
  );
}
