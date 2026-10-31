import Link from "next/link";
import { list } from "@/lib/server/data";
import type { Budget, Project } from "@/lib/domain";
import { brl, date } from "@/lib/format";
import { PageHeader, Section, Badge, Empty } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";

export default async function BudgetsPage() {
  const [budgets, projects] = await Promise.all([
    list<Budget>("budgets", { orderBy: "created_at" }),
    list<Project>("projects"),
  ]);
  return (
    <>
      <PageHeader
        eyebrow="COMERCIAL"
        title="Orçamentos"
        description="Cenários de venda com os itens e as versões escolhidas em cada projeto."
        actions={
          <Button asChild>
            <Link href="/projetos">Gerar a partir de um projeto</Link>
          </Button>
        }
      />
      <Section
        title="Orçamentos da loja"
        description="Até 500 orçamentos mais recentes."
        className="panel-flush"
      >
        {budgets.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Orçamento / projeto</th>
                  <th>Situação</th>
                  <th>Criação</th>
                  <th className="number">Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {budgets.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <strong>{b.name}</strong>
                      <small>
                        {projects.find((p) => p.id === b.project_id)?.name}
                      </small>
                    </td>
                    <td>
                      <Badge value={b.status} />
                    </td>
                    <td>{date(b.created_at)}</td>
                    <td className="number">{brl(b.total_cents)}</td>
                    <td>
                      <Link href={`/orcamentos/${b.id}`} className="text-link">
                        Conferir orçamento
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Nenhum orçamento gerado"
            description="Abra um projeto com ambientes importados e gere o primeiro cenário de orçamento."
          />
        )}
      </Section>
    </>
  );
}
