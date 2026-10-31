import Link from "next/link";
import { notFound } from "next/navigation";
import { one, list } from "@/lib/server/data";
import { requireViewer, can } from "@/lib/server/auth";
import type { Customer, Project } from "@/lib/domain";
import { PageHeader, Section, Badge, Empty } from "@/components/ui/primitives";
import { ContactForm } from "@/components/contact-form";
import { Button } from "@/components/ui/button";

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await requireViewer();
  const [customer, projects] = await Promise.all([
    one<Customer>("customers", id),
    list<Project>("projects", { filters: { customer_id: id } }),
  ]);
  if (!customer) notFound();
  return (
    <>
      <PageHeader
        eyebrow="COMERCIAL / CLIENTES"
        title={customer.name}
        description="Dados de atendimento e projetos relacionados."
        actions={
          <Button asChild variant="outline">
            <Link href="/clientes">Voltar aos clientes</Link>
          </Button>
        }
      />
      <div className="two-columns">
        <Section title="Dados do cliente">
          {can(viewer, "commercial") ? (
            <ContactForm record={customer} />
          ) : (
            <dl className="info-pairs">
              <div>
                <dt>E-mail</dt>
                <dd>{customer.email || "—"}</dd>
              </div>
              <div>
                <dt>Telefone</dt>
                <dd>{customer.phone || "—"}</dd>
              </div>
              <div>
                <dt>Documento</dt>
                <dd>{customer.document || "—"}</dd>
              </div>
            </dl>
          )}
        </Section>
        <Section title="Projetos do cliente">
          {projects.length ? (
            <div className="item-list">
              {projects.map((p) => (
                <Link
                  className="item-row"
                  href={`/projetos/${p.id}`}
                  key={p.id}
                >
                  <strong>{p.name}</strong>
                  <Badge value={p.status} />
                </Link>
              ))}
            </div>
          ) : (
            <Empty
              title="Sem projetos ainda"
              description="Crie um projeto e selecione este cliente para iniciar."
            />
          )}
        </Section>
      </div>
    </>
  );
}
