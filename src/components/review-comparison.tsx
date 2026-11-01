"use client";

import { useState } from "react";
import type { compareTechnicalReview } from "@/lib/review-comparison";
import { brl, quantity } from "@/lib/format";
import { Badge, Field, Notice } from "./ui/primitives";
import { Button } from "./ui/button";

type Comparison = ReturnType<typeof compareTechnicalReview>;
type EnvironmentComparison = Comparison["environments"][number];
type ComparisonRow = EnvironmentComparison["rows"][number];
type ComparisonItem = NonNullable<ComparisonRow["before"]>;

const PAGE_SIZE = 50;
const statuses = {
  added: "Incluído",
  removed: "Removido",
  changed: "Alterado",
  unchanged: "Sem alteração",
};
const fieldLabels: Record<ComparisonRow["changedFields"][number], string> = {
  description: "Descrição",
  quantity: "Quantidade",
  unitCostCents: "Custo unitário",
  unitSaleCents: "Venda unitária",
  costCents: "Custo total",
  saleCents: "Venda total",
  metadata: "Características",
};

function ItemValues({ item }: { item: ComparisonItem | null }) {
  if (!item) return <span className="muted">Não consta nesta versão</span>;
  return (
    <dl className="review-item-values">
      <div>
        <dt>Quantidade</dt>
        <dd>
          {quantity(item.quantity)} {item.unit}
        </dd>
      </div>
      <div>
        <dt>Custo unitário</dt>
        <dd>{brl(item.unitCostCents)}</dd>
      </div>
      <div>
        <dt>Venda unitária</dt>
        <dd>{brl(item.unitSaleCents)}</dd>
      </div>
      <div>
        <dt>Custo total</dt>
        <dd>{brl(item.costCents)}</dd>
      </div>
      <div>
        <dt>Venda total</dt>
        <dd>
          <strong>{brl(item.saleCents)}</strong>
        </dd>
      </div>
    </dl>
  );
}

function ItemDetails({
  item,
  title,
}: {
  item: ComparisonItem | null;
  title: string;
}) {
  if (!item) return null;
  const characteristics = Object.entries(item.metadata)
    .filter(([name]) => name !== "variantKey")
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  return (
    <div className="review-item-description">
      <strong>{title}</strong>
      <p>{item.description}</p>
      {item.variantKey && <p>Variação: {item.variantKey}</p>}
      {characteristics.length > 0 && (
        <dl>
          {characteristics.map(([name, value]) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd>
                {typeof value === "string" ? value : JSON.stringify(value)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function ComparedItem({ row }: { row: ComparisonRow }) {
  const item = row.after ?? row.before;
  if (!item) return null;
  return (
    <tr data-status={row.status} data-code={item.code}>
      <th scope="row">
        <div className="review-item-heading">
          <strong>{item.code}</strong>
          <Badge value={row.status === "unchanged" ? "cancelled" : "pending"}>
            {statuses[row.status]}
          </Badge>
        </div>
        {row.changedFields.length > 0 && (
          <p className="helper">
            {row.changedFields.map((field) => fieldLabels[field]).join(", ")}
          </p>
        )}
        {row.ambiguous && (
          <p className="helper">Correspondência não identificada</p>
        )}
        <details className="review-item-details">
          <summary>Ver descrição e características</summary>
          <ItemDetails item={row.before} title="Contratado" />
          <ItemDetails item={row.after} title="Executivo" />
        </details>
      </th>
      <td>
        <ItemValues item={row.before} />
      </td>
      <td>
        <ItemValues item={row.after} />
      </td>
      <td className="review-difference">{brl(row.difference.saleCents)}</td>
    </tr>
  );
}

function EnvironmentDetails({
  environment,
  onlyDifferences,
  versionNumbers,
}: {
  environment: EnvironmentComparison;
  onlyDifferences: boolean;
  versionNumbers: Record<string, number>;
}) {
  const [page, setPage] = useState(1);
  const name = environment.name ?? "Ambiente contratado";
  const rows = onlyDifferences
    ? environment.rows.filter((row) => row.status !== "unchanged")
    : environment.rows;
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const visibleRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const beforeVersions = environment.beforeVersionIds
    .map((id) =>
      versionNumbers[id] === undefined
        ? "não identificada"
        : String(versionNumbers[id]),
    )
    .join(", ");
  const { before, after, difference } = environment.totals;
  return (
    <section
      className="review-environment"
      aria-label={`Comparação de ${name}`}
    >
      <div className="review-environment-header">
        <h4>{name}</h4>
        <div className="review-version-labels">
          <span>
            Contratado:{" "}
            {beforeVersions ? `versão ${beforeVersions}` : "sem itens"}
          </span>
          <span>
            Executivo:{" "}
            {environment.afterVersionNumber === null
              ? "sem itens"
              : `versão ${environment.afterVersionNumber}`}
          </span>
        </div>
      </div>
      <dl className="info-pairs review-totals">
        <div>
          <dt>Venda contratada</dt>
          <dd>{brl(before.saleCents)}</dd>
        </div>
        <div>
          <dt>Venda executiva</dt>
          <dd>{brl(after.saleCents)}</dd>
        </div>
        <div>
          <dt>Diferença de venda</dt>
          <dd>{brl(difference.saleCents)}</dd>
        </div>
        <div>
          <dt>Custo contratado</dt>
          <dd>{brl(before.costCents)}</dd>
        </div>
        <div>
          <dt>Custo executivo</dt>
          <dd>{brl(after.costCents)}</dd>
        </div>
        <div>
          <dt>Diferença de custo</dt>
          <dd>{brl(difference.costCents)}</dd>
        </div>
      </dl>
      {!environment.hasChanges && (
        <Notice tone={environment.versionChanged ? "info" : "success"}>
          {environment.versionChanged
            ? "Os itens são equivalentes, mas a versão mudou. A aprovação continua seguindo as exigências desta revisão."
            : "Os itens são equivalentes aos contratados, sem alterações de conteúdo."}
        </Notice>
      )}
      {environment.hasAmbiguities && (
        <Notice tone="warning">
          Há itens repetidos sem correspondência única. Eles aparecem como
          removidos e incluídos para permitir a conferência de todas as linhas.
        </Notice>
      )}
      <p className="helper review-result-count" aria-live="polite">
        {rows.length} linha(s) {onlyDifferences ? "com diferenças" : "no total"}
        {rows.length > 0 &&
          ` · Exibindo ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, rows.length)}`}
        . Totais calculados sobre todos os itens do ambiente.
      </p>
      {rows.length > 0 ? (
        <div
          className="table-wrap"
          tabIndex={0}
          role="region"
          aria-label={`Tabela com rolagem de ${name}`}
        >
          <table
            className="review-comparison-table"
            aria-label={`Itens comparados de ${name}`}
          >
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Contratado</th>
                <th scope="col">Executivo</th>
                <th scope="col">Diferença de venda</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <ComparedItem key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="helper">
          Nenhuma diferença de itens neste ambiente. Desmarque o filtro para
          conferir todos os itens.
        </p>
      )}
      {pageCount > 1 && (
        <div className="review-pagination">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            aria-label={`Página anterior de ${name}`}
            onClick={() => setPage(page - 1)}
          >
            Anterior
          </Button>
          <span aria-live="polite">
            Página {page} de {pageCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= pageCount}
            aria-label={`Próxima página de ${name}`}
            onClick={() => setPage(page + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </section>
  );
}

/** Read-only presentation. Comparisons and reconciliation arrive from the server. */
export function ReviewComparison({
  comparison,
  versionNumbers,
}: {
  comparison: Comparison;
  versionNumbers: Record<string, number>;
}) {
  const [onlyDifferences, setOnlyDifferences] = useState(true);
  const [environmentId, setEnvironmentId] = useState(
    comparison.environments.find((environment) => environment.hasChanges)
      ?.environmentId ??
      comparison.environments[0]?.environmentId ??
      "",
  );
  const environment = comparison.environments.find(
    (entry) => entry.environmentId === environmentId,
  );
  return (
    <div className="review-comparison stack">
      <div>
        <h3>Comparação com o contratado</h3>
        <p className="helper">
          Itens do orçamento contratado e da revisão salva. A diferença
          executiva não altera o valor do contrato.
        </p>
      </div>
      <div className="review-counts" aria-label="Resumo de todos os ambientes">
        <span>{comparison.counts.added} incluído(s)</span>
        <span>{comparison.counts.removed} removido(s)</span>
        <span>{comparison.counts.changed} alterado(s)</span>
        <span>{comparison.counts.unchanged} sem alteração</span>
      </div>
      {comparison.environments.length > 1 && (
        <Field label="Ambiente para comparar">
          <select
            value={environmentId}
            onChange={(event) => setEnvironmentId(event.target.value)}
          >
            {comparison.environments.map((entry) => (
              <option key={entry.environmentId} value={entry.environmentId}>
                {entry.name ?? "Ambiente contratado"} ·{" "}
                {entry.counts.added +
                  entry.counts.removed +
                  entry.counts.changed}{" "}
                diferença(s) de itens
              </option>
            ))}
          </select>
        </Field>
      )}
      <label className="check-row">
        <input
          type="checkbox"
          checked={onlyDifferences}
          onChange={(event) => setOnlyDifferences(event.target.checked)}
        />
        <span>Mostrar somente diferenças</span>
      </label>
      {environment && (
        <EnvironmentDetails
          key={`${environment.environmentId}-${onlyDifferences}`}
          environment={environment}
          onlyDifferences={onlyDifferences}
          versionNumbers={versionNumbers}
        />
      )}
    </div>
  );
}
