import Link from "next/link";
import { list } from "@/lib/server/data";
import { requireViewer, can } from "@/lib/server/auth";
import type { Supplier } from "@/lib/domain";
import { PageHeader, Section, Badge, Empty } from "@/components/ui/primitives";
import { ContactForm } from "@/components/contact-form";

export default async function SuppliersPage() {
  const viewer = await requireViewer();
  const suppliers = await list<Supplier>("suppliers", {
    orderBy: "created_at",
  });
  return (
    <>
      <PageHeader
        eyebrow="OPERAÇÃO"
        title="Fornecedores"
        description="Cada ambiente tem um fornecedor responsável pela compra dos seus itens."
      />
      <div className="content-grid">
        <Section
          title="Fornecedores cadastrados"
          description="Até 500 cadastros mais recentes."
          className="panel-flush"
        >
          {suppliers.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fornecedor</th>
                    <th>Contato</th>
                    <th>Prazo</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.name}</strong>
                        <small>{s.document || "Documento não informado"}</small>
                      </td>
                      <td>
                        {s.email || "—"}
                        <small>{s.phone}</small>
                      </td>
                      <td>
                        <Badge>{s.lead_days} dias</Badge>
                      </td>
                      <td>
                        <Link
                          className="text-link"
                          href={`/fornecedores/${s.id}`}
                        >
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
              title="Nenhum fornecedor cadastrado"
              description="Cadastre os fornecedores antes de criar ambientes e pedidos de compra."
            />
          )}
        </Section>
        {can(viewer, "operations") && (
          <Section title="Novo fornecedor">
            <ContactForm supplier />
          </Section>
        )}
      </div>
    </>
  );
}
