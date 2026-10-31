import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PROCESS_MODULES } from "@/lib/process-map";
import {
  PageHeader,
  Section,
  Stat,
  Notice,
  Badge,
} from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";

const phaseNames: Record<number, string> = {
  1: "Fundação e acesso",
  2: "Comercial e XML",
  3: "Contratos e revisão",
  4: "Compra e execução",
  5: "Financeiro e suporte",
  6: "Gestão avançada",
  7: "Integrações e homologação",
};
export default function MapPage() {
  return (
    <>
      <PageHeader
        eyebrow="REFERÊNCIA E EVOLUÇÃO"
        title="Mapa de processos"
        description="A referência completa orienta a implementação. Cada bloco reúne o núcleo entregue e as extensões que ainda precisam ser construídas e validadas."
        actions={
          <Button asChild variant="outline">
            <a
              href="https://github.com/ItamarJuniorDEV/system-test/tree/main/docs"
              target="_blank"
              rel="noreferrer"
            >
              Documentação no repositório <ArrowUpRight size={14} />
            </a>
          </Button>
        }
      />
      <div className="stats-grid">
        <Stat
          title="Blocos do ERP"
          value={PROCESS_MODULES.length}
          detail="Fiscal excluído por definição de escopo"
        />
        <Stat
          title="Funcionalidades mapeadas"
          value={PROCESS_MODULES.reduce((n, m) => n + m.features.length, 0)}
          detail="Mapa de referência, não contagem de entregas"
        />
        <Stat
          title="Referências catalogadas"
          value="395"
          detail="386 com conteúdo público disponível"
        />
        <Stat
          title="Organização"
          value="1 loja"
          detail="Sem infraestrutura de múltiplas lojas"
        />
      </div>
      <div className="stack">
        <Notice>
          O mapa documenta o escopo completo. A versão inicial entrega o núcleo
          operacional descrito no README; módulos marcados como parciais ainda
          têm funcionalidades pendentes. Compatibilidade com seu XML real e
          homologação da operação são verificações separadas.
        </Notice>
        <Section
          title="Ordem de implementação"
          description="As fases seguem as dependências; assistência sem contrato e compras avulsas têm variantes próprias documentadas."
        >
          <div className="flow-grid">
            {Object.entries(phaseNames).map(([phase, title]) => (
              <div className="flow-card" key={phase}>
                <b>{phase.padStart(2, "0")}</b>
                <div>
                  <strong>{title}</strong>
                  <small>Critérios e casos de aceite no plano</small>
                </div>
              </div>
            ))}
          </div>
          <p className="helper mt">
            <Link className="text-link" href="/projetos">
              Começar pelo fluxo comercial
            </Link>{" "}
            ·{" "}
            <a
              className="text-link"
              href="https://github.com/ItamarJuniorDEV/system-test/blob/main/docs/planos/ordem-de-implementacao.md"
              target="_blank"
              rel="noreferrer"
            >
              Abrir o plano detalhado
            </a>
          </p>
        </Section>
        <div className="module-grid">
          {PROCESS_MODULES.map((module) => (
            <article className="module-card" key={module.id}>
              <div className="space-between">
                <span className="eyebrow" style={{ margin: 0 }}>
                  {module.id} · {module.group}
                </span>
                <Badge
                  value={
                    module.status === "implemented"
                      ? "active"
                      : module.status === "partial"
                        ? "partial"
                        : "draft"
                  }
                >
                  {module.status === "implemented"
                    ? "Implementado"
                    : module.status === "partial"
                      ? "Núcleo parcial"
                      : "Planejado"}
                </Badge>
              </div>
              <h2 style={{ marginTop: 13 }}>{module.name}</h2>
              <p>{module.description}</p>
              <ul>
                {module.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <p className="helper">
                Fase {module.phase} · Depende de:{" "}
                {module.dependencies
                  .map(
                    (id) =>
                      PROCESS_MODULES.find((m) => m.id === id)?.name ?? id,
                  )
                  .join(", ") || "fundação"}
              </p>
              {module.notes.map((note) => (
                <p className="helper" key={note}>
                  {note}
                </p>
              ))}
              <details className="sources">
                <summary>
                  Fontes e regras de referência ({module.sources.length})
                </summary>
                {module.sources.map((source) => (
                  <a
                    href={source.url}
                    key={source.id}
                    target="_blank"
                    rel="noreferrer"
                    title={source.title}
                  >
                    {source.title}
                  </a>
                ))}
              </details>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}
