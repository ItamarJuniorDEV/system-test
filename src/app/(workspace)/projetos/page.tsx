import Link from "next/link";
import { list } from "@/lib/server/data";
import { requireViewer, can } from "@/lib/server/auth";
import type { Project, Customer, Environment } from "@/lib/domain";
import { date } from "@/lib/format";
import {
  PageHeader,
  Section,
  Badge,
  Empty,
  Field,
} from "@/components/ui/primitives";
import { ActionForm } from "@/components/action-form";

export default async function ProjectsPage() {
  const viewer = await requireViewer();
  const [projects, customers, environments] = await Promise.all([
    list<Project>("projects", { orderBy: "created_at" }),
    list<Customer>("customers"),
    list<Environment>("environments"),
  ]);
  return (
    <>
      <PageHeader
        eyebrow="COMERCIAL"
        title="Projetos e ambientes"
        description="Organize o projeto por ambientes. Cada importação XML gera uma versão independente e rastreável."
      />
      <div className="content-grid">
        <Section
          title="Projetos da loja"
          description="Até 500 projetos mais recentes."
          className="panel-flush"
        >
          {projects.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Projeto / cliente</th>
                    <th>Ambientes</th>
                    <th>Situação</th>
                    <th>Criação</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                        <small>
                          {customers.find((c) => c.id === p.customer_id)
                            ?.name ?? "Cliente vinculado"}
                        </small>
                      </td>
                      <td>
                        {
                          environments.filter((e) => e.project_id === p.id)
                            .length
                        }
                      </td>
                      <td>
                        <Badge value={p.status} />
                      </td>
                      <td>{date(p.created_at)}</td>
                      <td>
                        <Link href={`/projetos/${p.id}`} className="text-link">
                          Abrir projeto
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="Nenhum projeto cadastrado"
              description="Selecione um cliente e dê um nome ao projeto para começar."
            />
          )}
        </Section>
        {can(viewer, "commercial") && (
          <Section
            title="Novo projeto"
            description="Comece pelo cliente e depois adicione os ambientes."
          >
            {customers.length ? (
              <ActionForm command="project.create" submitLabel="Criar projeto">
                <Field label="Cliente *">
                  <select name="customer_id" required defaultValue="">
                    <option value="" disabled>
                      Selecione o cliente
                    </option>
                    {customers
                      .filter((c) => c.active)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Nome do projeto *">
                  <input
                    name="name"
                    maxLength={200}
                    required
                    placeholder="Ex.: Apartamento Jardim"
                  />
                </Field>
              </ActionForm>
            ) : (
              <Empty
                title="Cadastre um cliente primeiro"
                description="O projeto sempre tem um cliente responsável."
              >
                <Link className="text-link" href="/clientes">
                  Ir para clientes
                </Link>
              </Empty>
            )}
          </Section>
        )}
      </div>
    </>
  );
}
