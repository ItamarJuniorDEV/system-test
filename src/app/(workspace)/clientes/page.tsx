import Link from "next/link";
import { Search } from "lucide-react";
import { list } from "@/lib/server/data";
import { requireViewer, can } from "@/lib/server/auth";
import type { Customer } from "@/lib/domain";
import { PageHeader, Section, Badge, Empty } from "@/components/ui/primitives";
import { ContactForm } from "@/components/contact-form";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const viewer = await requireViewer();
  const { q = "" } = await searchParams;
  const customers = await list<Customer>("customers", {
    orderBy: "created_at",
  });
  const visible = customers.filter((c) =>
    `${c.name} ${c.document ?? ""} ${c.email ?? ""}`
      .toLocaleLowerCase("pt-BR")
      .includes(q.toLocaleLowerCase("pt-BR")),
  );
  return (
    <>
      <PageHeader
        eyebrow="COMERCIAL"
        title="Clientes"
        description="Organize os contatos e mantenha cada projeto conectado ao cliente."
      />
      <div className="content-grid">
        <Section
          title="Carteira de clientes"
          description="Até 500 cadastros mais recentes."
        >
          <form className="search-box">
            <Search size={15} />
            <input
              name="q"
              defaultValue={q}
              aria-label="Buscar cliente"
              placeholder="Buscar por nome, documento ou e-mail"
            />
          </form>
          {visible.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Contato</th>
                    <th>Situação</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.name}</strong>
                        <small>{c.document || "Documento não informado"}</small>
                      </td>
                      <td>
                        {c.email || "—"}
                        <small>{c.phone}</small>
                      </td>
                      <td>
                        <Badge value={c.active ? "active" : "cancelled"} />
                      </td>
                      <td>
                        <Link className="text-link" href={`/clientes/${c.id}`}>
                          Abrir
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="Nenhum cliente encontrado"
              description="Cadastre o primeiro cliente ou ajuste sua busca."
            />
          )}
        </Section>
        {can(viewer, "commercial") && (
          <Section
            title="Novo cliente"
            description="Os campos com * são obrigatórios."
          >
            <ContactForm />
          </Section>
        )}
      </div>
    </>
  );
}
