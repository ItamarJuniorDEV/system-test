import Link from "next/link";
import { list } from "@/lib/server/data";
import type { Contract, Customer, Project } from "@/lib/domain";
import { brl, date } from "@/lib/format";
import { PageHeader, Section, Badge, Empty } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";

export default async function ContractsPage() {
  const [contracts, customers, projects] = await Promise.all([
    list<Contract>("contracts", { orderBy: "created_at" }),
    list<Customer>("customers"),
    list<Project>("projects"),
  ]);
  return (
    <>
      <PageHeader
        eyebrow="COMERCIAL E PÓS-VENDA"
        title="Contratos e revisões"
        description="Acompanhe a formalização, as liberações e a revisão executiva de cada venda."
        actions={
          <Button asChild variant="outline">
            <Link href="/orcamentos">Abrir orçamentos</Link>
          </Button>
        }
      />
      <Section
        title="Contratos da loja"
        description="Até 500 contratos mais recentes."
        className="panel-flush"
      >
        {contracts.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Contrato / cliente</th>
                  <th>Projeto</th>
                  <th>Liberações</th>
                  <th>Situação</th>
                  <th className="number">Valor</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>
                        #{c.number} ·{" "}
                        {customers.find((x) => x.id === c.customer_id)?.name ??
                          "Cliente"}
                      </strong>
                      <small>{date(c.created_at)}</small>
                    </td>
                    <td>{projects.find((p) => p.id === c.project_id)?.name}</td>
                    <td>
                      {
                        [
                          c.signed_at,
                          c.commercial_approved_at,
                          c.financial_approved_at,
                        ].filter(Boolean).length
                      }
                      /3
                    </td>
                    <td>
                      <Badge value={c.status} />
                    </td>
                    <td className="number">{brl(c.total_cents)}</td>
                    <td>
                      <Link href={`/contratos/${c.id}`} className="text-link">
                        Acompanhar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Nenhum contrato criado"
            description="A criação do contrato começa na conferência de um orçamento."
          />
        )}
      </Section>
    </>
  );
}
