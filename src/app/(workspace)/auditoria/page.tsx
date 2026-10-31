import { list } from "@/lib/server/data";
import { requireViewer } from "@/lib/server/auth";
import type { AuditEvent, Profile } from "@/lib/domain";
import { date } from "@/lib/format";
import { PageHeader, Section, Empty, Notice } from "@/components/ui/primitives";

const actions: Record<string, string> = {
  created: "Criação",
  updated: "Atualização",
  imported: "Importação",
  approved: "Aprovação",
  started: "Início",
  received: "Recebimento",
  stock_reserved: "Reserva de estoque",
  dispatch_recorded: "Envio registrado",
  completed: "Conclusão",
  cancelled: "Cancelamento",
  settled: "Baixa financeira",
  reversed: "Estorno",
  activated: "Efetivação",
  resolved: "Solução",
  closed: "Encerramento",
};
export default async function AuditPage() {
  const viewer = await requireViewer();
  if (viewer.role !== "admin")
    return (
      <Notice>
        O histórico geral de operações é reservado ao administrador.
      </Notice>
    );
  const [events, profiles] = await Promise.all([
    list<AuditEvent>("audit_events", { orderBy: "created_at", limit: 100 }),
    list<Profile>("profiles"),
  ]);
  return (
    <>
      <PageHeader
        eyebrow="GESTÃO"
        title="Histórico de operações"
        description="As 100 operações mais recentes, com responsável e informações da mudança. Os registros operacionais não podem ser editados pela aplicação."
      />
      <Section title="Trilha de operações" className="panel-flush">
        {events.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Responsável</th>
                  <th>Operação</th>
                  <th>Registro</th>
                  <th>Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td>{date(event.created_at, true)}</td>
                    <td>
                      {profiles.find((p) => p.id === event.created_by)?.name ??
                        "Usuário vinculado"}
                    </td>
                    <td>{actions[event.action] ?? event.action}</td>
                    <td>
                      {event.entity_type}
                      <small>{event.entity_id.slice(0, 8)}</small>
                    </td>
                    <td>
                      <details>
                        <summary className="text-link">Ver registro</summary>
                        <pre
                          style={{
                            whiteSpace: "pre-wrap",
                            maxWidth: 440,
                            maxHeight: 220,
                            overflow: "auto",
                            fontSize: 10,
                          }}
                        >
                          {JSON.stringify(event.details, null, 2)}
                        </pre>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Nenhuma operação registrada"
            description="As alterações aparecerão aqui quando os cadastros e os fluxos forem utilizados."
          />
        )}
      </Section>
    </>
  );
}
