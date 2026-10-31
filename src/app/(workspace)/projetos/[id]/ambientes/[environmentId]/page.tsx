import Link from "next/link";
import { notFound } from "next/navigation";
import { list, one } from "@/lib/server/data";
import { requireViewer, can } from "@/lib/server/auth";
import type {
  Environment,
  EnvironmentVersion,
  Project,
  Supplier,
} from "@/lib/domain";
import { brl, date, quantity } from "@/lib/format";
import {
  PageHeader,
  Section,
  Badge,
  Notice,
  Empty,
} from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { XmlImporter } from "@/components/xml-importer";

export default async function EnvironmentPage({
  params,
}: {
  params: Promise<{ id: string; environmentId: string }>;
}) {
  const { id, environmentId } = await params;
  const viewer = await requireViewer();
  const [project, environment] = await Promise.all([
    one<Project>("projects", id),
    one<Environment>("environments", environmentId),
  ]);
  if (!project || !environment || environment.project_id !== id) notFound();
  const [versions, supplier] = await Promise.all([
    list<EnvironmentVersion>("environment_versions", {
      filters: { environment_id: environmentId },
      orderBy: "version_number",
    }),
    one<Supplier>("suppliers", environment.supplier_id),
  ]);
  const current = versions[0];
  return (
    <>
      <PageHeader
        eyebrow={`PROJETO / ${project.name}`}
        title={environment.name}
        description={`${supplier?.name ?? "Fornecedor vinculado"} · ${versions.length} versão(ões) disponível(is)`}
        actions={
          <Button asChild variant="outline">
            <Link href={`/projetos/${id}`}>Voltar ao projeto</Link>
          </Button>
        }
      />
      <div className="stack">
        {can(viewer, "commercial", "operations") && (
          <Section
            title="Importar projeto por XML"
            description="Confira o layout e os itens antes de confirmar a nova versão deste ambiente."
          >
            <XmlImporter
              environmentId={environmentId}
              environmentName={environment.name}
              projectName={project.name}
            />
          </Section>
        )}
        <Section
          title={
            current
              ? `Itens da versão ${current.version_number}`
              : "Itens do ambiente"
          }
          description={
            current
              ? `${current.file_name} · Importado em ${date(current.created_at, true)}`
              : "Aguardando a primeira importação."
          }
          className="panel-flush"
        >
          {current ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Descrição</th>
                    <th className="number">Qtd.</th>
                    <th>Un.</th>
                    <th className="number">Custo unit.</th>
                    <th className="number">Venda unit.</th>
                  </tr>
                </thead>
                <tbody>
                  {current.snapshot.items.map((item, index) => (
                    <tr key={index}>
                      <td>{item.code}</td>
                      <td>{item.description}</td>
                      <td className="number">{quantity(item.quantity)}</td>
                      <td>{item.unit}</td>
                      <td className="number">{brl(item.costCents)}</td>
                      <td className="number">{brl(item.saleCents)}</td>
                    </tr>
                  ))}
                  <tr className="table-total">
                    <td colSpan={4}>Totais desta versão</td>
                    <td className="number">{brl(current.cost_cents)}</td>
                    <td className="number">{brl(current.sale_cents)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="Nenhum item importado"
              description="Selecione um XML e confira a prévia acima."
            />
          )}
        </Section>
        <Section
          title="Histórico de versões"
          description="Cada versão preserva seu conteúdo importado e a identificação do XML."
        >
          {versions.length ? (
            <div className="timeline">
              {versions.map((v) => (
                <div className="timeline-item" key={v.id}>
                  <div className="space-between">
                    <h3>
                      Versão {v.version_number} · {v.file_name}
                    </h3>
                    <Badge value={current?.id === v.id ? "active" : "draft"}>
                      {current?.id === v.id ? "Atual" : "Histórico"}
                    </Badge>
                  </div>
                  <small>
                    {date(v.created_at, true)} · {v.snapshot.items.length} itens
                    · {brl(v.sale_cents)}
                  </small>
                  <details className="mt">
                    <summary className="helper">
                      Identificação e itens desta versão
                    </summary>
                    <p
                      className="helper"
                      style={{ overflowWrap: "anywhere", marginTop: 8 }}
                    >
                      SHA-256 do conteúdo XML em UTF-8: {v.sha256}
                    </p>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Código</th>
                            <th>Descrição</th>
                            <th>Quantidade</th>
                            <th>Venda unit.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {v.snapshot.items.map((item, index) => (
                            <tr key={index}>
                              <td>{item.code}</td>
                              <td>{item.description}</td>
                              <td>
                                {quantity(item.quantity)} {item.unit}
                              </td>
                              <td>{brl(item.saleCents)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </div>
              ))}
            </div>
          ) : (
            <Notice>
              O histórico será criado na primeira importação confirmada.
            </Notice>
          )}
        </Section>
      </div>
    </>
  );
}
