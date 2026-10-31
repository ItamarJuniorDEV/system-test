import Link from "next/link";
import { notFound } from "next/navigation";
import { Upload, ArrowUpRight, Layers3 } from "lucide-react";
import { list, one } from "@/lib/server/data";
import { requireViewer, can } from "@/lib/server/auth";
import type {
  Project,
  Customer,
  Environment,
  EnvironmentVersion,
  Supplier,
  Budget,
  Contract,
} from "@/lib/domain";
import { brl, date } from "@/lib/format";
import {
  PageHeader,
  Section,
  Badge,
  Empty,
  Field,
  Notice,
} from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/action-form";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await requireViewer();
  const project = await one<Project>("projects", id);
  if (!project) notFound();
  const [customer, environments, suppliers, budgets, contracts] =
    await Promise.all([
      one<Customer>("customers", project.customer_id),
      list<Environment>("environments", {
        filters: { project_id: id },
        orderBy: "created_at",
        ascending: true,
      }),
      list<Supplier>("suppliers"),
      list<Budget>("budgets", {
        filters: { project_id: id },
        orderBy: "created_at",
      }),
      list<Contract>("contracts", { filters: { project_id: id } }),
    ]);
  const versions = (
    await Promise.all(
      environments.map((e) =>
        list<EnvironmentVersion>("environment_versions", {
          filters: { environment_id: e.id },
          orderBy: "version_number",
          limit: 1,
        }),
      ),
    )
  ).flat();
  const available = environments.filter((e) =>
    versions.some((v) => v.environment_id === e.id),
  );
  return (
    <>
      <PageHeader
        eyebrow="COMERCIAL / PROJETOS"
        title={project.name}
        description={`${customer?.name ?? "Cliente vinculado"} · Criado em ${date(project.created_at)}`}
        actions={
          <>
            <Badge value={project.status} />
            <Button asChild variant="outline">
              <Link href="/projetos">Todos os projetos</Link>
            </Button>
          </>
        }
      />
      <div className="content-grid">
        <div className="stack">
          <Section
            title="Ambientes do projeto"
            description="A versão atual de cada ambiente compõe o próximo orçamento."
          >
            {environments.length ? (
              <div className="two-columns">
                {environments.map((e) => {
                  const version = versions.find(
                    (v) => v.environment_id === e.id,
                  );
                  return (
                    <article className="environment-card" key={e.id}>
                      <div className="space-between">
                        <span className="item-icon">
                          <Layers3 size={19} />
                        </span>
                        {version ? (
                          <Badge value="active">
                            Versão {version.version_number}
                          </Badge>
                        ) : (
                          <Badge value="pending">Sem XML</Badge>
                        )}
                      </div>
                      <h3 style={{ marginTop: 16 }}>{e.name}</h3>
                      <p className="helper" style={{ marginTop: 5 }}>
                        {suppliers.find((s) => s.id === e.supplier_id)?.name}
                      </p>
                      <div className="metrics">
                        <div>
                          <span>Itens</span>
                          <strong>{version?.snapshot.items.length ?? 0}</strong>
                        </div>
                        <div>
                          <span>Valor de venda</span>
                          <strong>{brl(version?.sale_cents)}</strong>
                        </div>
                      </div>
                      <footer>
                        <small className="muted">
                          {version
                            ? date(version.created_at)
                            : "Aguardando importação"}
                        </small>
                        <Link
                          href={`/projetos/${id}/ambientes/${e.id}`}
                          className="text-link"
                        >
                          <Upload
                            size={13}
                            style={{ display: "inline", marginRight: 5 }}
                          />
                          {version ? "Abrir ambiente" : "Importar XML"}
                        </Link>
                      </footer>
                    </article>
                  );
                })}
              </div>
            ) : (
              <Empty
                title="Adicione o primeiro ambiente"
                description="Cozinha, suíte, sala: cada ambiente terá seu fornecedor, itens e histórico de importações."
              />
            )}
          </Section>
          <Section
            title="Orçamentos"
            description="Cada orçamento conserva as versões e os valores usados na sua criação."
            className="panel-flush"
          >
            {budgets.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Orçamento</th>
                      <th>Situação</th>
                      <th className="number">Total</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {budgets.map((b) => (
                      <tr key={b.id}>
                        <td>
                          <strong>{b.name}</strong>
                          <small>{date(b.created_at)}</small>
                        </td>
                        <td>
                          <Badge value={b.status} />
                        </td>
                        <td className="number">{brl(b.total_cents)}</td>
                        <td>
                          <Link
                            href={`/orcamentos/${b.id}`}
                            className="text-link"
                          >
                            Conferir{" "}
                            <ArrowUpRight
                              size={13}
                              style={{ display: "inline" }}
                            />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="Ainda não há orçamento"
                description="Importe os itens de pelo menos um ambiente e gere o orçamento para conferir os valores."
              />
            )}
          </Section>
          {contracts.length > 0 && (
            <Section title="Contratos vinculados">
              <div className="item-list">
                {contracts.map((c) => (
                  <Link
                    href={`/contratos/${c.id}`}
                    className="item-row"
                    key={c.id}
                  >
                    <div>
                      <h3>Contrato #{c.number}</h3>
                      <p>{brl(c.total_cents)}</p>
                    </div>
                    <Badge value={c.status} />
                  </Link>
                ))}
              </div>
            </Section>
          )}
        </div>
        <div className="stack">
          {can(viewer, "commercial", "operations") && (
            <Section title="Adicionar ambiente">
              {suppliers.length ? (
                <ActionForm
                  command="environment.create"
                  submitLabel="Criar ambiente"
                >
                  <input type="hidden" name="project_id" value={id} />
                  <Field label="Nome do ambiente *">
                    <input
                      name="name"
                      maxLength={200}
                      required
                      placeholder="Ex.: Cozinha"
                    />
                  </Field>
                  <Field label="Fornecedor *">
                    <select name="supplier_id" required defaultValue="">
                      <option value="" disabled>
                        Selecione o fornecedor
                      </option>
                      {suppliers
                        .filter((s) => s.active)
                        .map((s) => (
                          <option value={s.id} key={s.id}>
                            {s.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                </ActionForm>
              ) : (
                <Notice>
                  Cadastre um{" "}
                  <Link className="text-link" href="/fornecedores">
                    fornecedor
                  </Link>{" "}
                  antes de criar o ambiente.
                </Notice>
              )}
            </Section>
          )}
          {can(viewer, "commercial") && available.length > 0 && (
            <Section
              title="Gerar orçamento"
              description="Selecione os ambientes que compõem este cenário."
            >
              <ActionForm
                command="budget.create"
                submitLabel="Gerar e conferir orçamento"
              >
                <input type="hidden" name="project_id" value={id} />
                <Field label="Nome do orçamento *">
                  <input
                    name="name"
                    maxLength={200}
                    defaultValue={`Proposta ${budgets.length + 1}`}
                    required
                  />
                </Field>
                {available.map((e) => (
                  <label className="check-row" key={e.id}>
                    <input
                      type="checkbox"
                      name="environment_ids"
                      value={e.id}
                      defaultChecked
                    />
                    <span>
                      {e.name}
                      <small>
                        Versão{" "}
                        {
                          versions.find((v) => v.environment_id === e.id)
                            ?.version_number
                        }{" "}
                        ·{" "}
                        {brl(
                          versions.find((v) => v.environment_id === e.id)
                            ?.sale_cents,
                        )}
                      </small>
                    </span>
                  </label>
                ))}
              </ActionForm>
            </Section>
          )}
          <Notice>
            Importar um novo XML preserva as versões anteriores. Os orçamentos e
            contratos já criados mantêm seus itens originais.
          </Notice>
        </div>
      </div>
    </>
  );
}
