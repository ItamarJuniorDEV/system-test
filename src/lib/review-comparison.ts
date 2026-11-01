import type {
  BudgetItem,
  ItemMetadata,
  JsonValue,
  Money,
  ReviewSnapshot,
  VersionItem,
} from "./domain";

export type ComparisonStatus = "added" | "removed" | "changed" | "unchanged";
export type ComparisonField =
  | "quantity"
  | "description"
  | "unitCostCents"
  | "unitSaleCents"
  | "costCents"
  | "saleCents"
  | "metadata";
export type ComparisonCounts = Record<ComparisonStatus, number>;
export type ComparisonAmounts = { costCents: string; saleCents: string };
export type ComparisonTotals = {
  before: ComparisonAmounts;
  after: ComparisonAmounts;
  difference: ComparisonAmounts;
};
export type ComparisonItem = {
  sourceId: string;
  sourceItemIndex: number;
  environmentId: string;
  supplierId: string;
  versionId: string;
  code: string;
  description: string;
  unit: string;
  variantKey: string;
  quantity: string;
  unitCostCents: string;
  unitSaleCents: string;
  costCents: string;
  saleCents: string;
  metadata: ItemMetadata;
};
export type ComparisonRow = {
  id: string;
  status: ComparisonStatus;
  before: ComparisonItem | null;
  after: ComparisonItem | null;
  changedFields: ComparisonField[];
  difference: ComparisonAmounts;
  ambiguous: boolean;
};
export type EnvironmentComparison = {
  environmentId: string;
  name: string | null;
  beforeVersionIds: string[];
  afterVersionId: string | null;
  afterVersionNumber: number | null;
  versionChanged: boolean;
  rows: ComparisonRow[];
  counts: ComparisonCounts;
  totals: ComparisonTotals;
  hasChanges: boolean;
  hasAmbiguities: boolean;
};
export type ReviewComparison = {
  environments: EnvironmentComparison[];
  counts: ComparisonCounts;
  totals: ComparisonTotals;
  hasChanges: boolean;
  hasAmbiguities: boolean;
};

const MAX_INPUT_ITEMS = 10_000;
const QUANTITY_SCALE = 10_000n;
const COMPARABLE_FIELDS = [
  "quantity",
  "description",
  "unitCostCents",
  "unitSaleCents",
  "costCents",
  "saleCents",
  "metadata",
] as const satisfies readonly ComparisonField[];

function invalid(reason: string): never {
  throw new Error(`Não foi possível comparar a revisão: ${reason}`);
}

function requiredText(value: string, label: string): string {
  if (typeof value !== "string" || !value.length) invalid(`${label} ausente.`);
  return value;
}

function integerCents(value: Money, label: string, signed = false): bigint {
  if (typeof value === "number" && !Number.isSafeInteger(value)) {
    invalid(`${label} deve conter centavos inteiros exatos.`);
  }
  const text = String(value);
  if (!(signed ? /^-?\d+$/ : /^\d+$/).test(text)) {
    invalid(
      `${label} deve conter centavos inteiros${signed ? "" : " não negativos"}.`,
    );
  }
  return BigInt(text);
}

function quantity(value: number | string): { scaled: bigint; text: string } {
  const text = String(value);
  if (!/^\d+(?:\.\d{1,4})?$/.test(text)) {
    invalid(
      "quantidade deve ser positiva e ter no máximo quatro casas decimais.",
    );
  }
  const [whole, fraction = ""] = text.split(".");
  const scaled =
    BigInt(whole) * QUANTITY_SCALE + BigInt(fraction.padEnd(4, "0"));
  if (scaled <= 0n || scaled > 1_000_000n * QUANTITY_SCALE) {
    invalid("quantidade fora do intervalo de 0 a 1.000.000.");
  }
  const decimal = (scaled % QUANTITY_SCALE)
    .toString()
    .padStart(4, "0")
    .replace(/0+$/, "");
  return {
    scaled,
    text: `${scaled / QUANTITY_SCALE}${decimal ? `.${decimal}` : ""}`,
  };
}

/** Copy JSON recursively, with object keys ordered but array order preserved. */
function copyJson(value: JsonValue): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      invalid("metadados contêm um número inválido.");
    return value;
  }
  if (Array.isArray(value)) return value.map(copyJson);
  if (typeof value !== "object")
    invalid("metadados devem conter valores JSON.");
  // fromEntries defines own data properties, including an imported '__proto__'.
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, copyJson(value[key])]),
  );
}

function metadata(value: ItemMetadata | undefined): ItemMetadata {
  if (value === undefined) return {};
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    invalid("metadados do item devem ser um objeto.");
  }
  return copyJson(value) as ItemMetadata;
}

function normalizeBudgetItem(item: BudgetItem): ComparisonItem {
  if (!item || typeof item !== "object") invalid("item contratado inválido.");
  if (
    !Number.isSafeInteger(item.source_item_index) ||
    item.source_item_index < 1
  ) {
    invalid("índice de origem do item contratado inválido.");
  }
  if (typeof item.variant_key !== "string")
    invalid("variante contratada ausente.");
  return {
    sourceId: requiredText(item.id, "ID do item contratado"),
    sourceItemIndex: item.source_item_index,
    environmentId: requiredText(item.environment_id, "Ambiente contratado"),
    supplierId: requiredText(item.supplier_id, "Fornecedor contratado"),
    versionId: requiredText(item.environment_version_id, "Versão contratada"),
    code: requiredText(item.code, "Código contratado"),
    description: requiredText(item.description, "Descrição contratada"),
    unit: requiredText(item.unit, "Unidade contratada"),
    variantKey: item.variant_key,
    quantity: quantity(item.quantity).text,
    unitCostCents: integerCents(
      item.unit_cost_cents,
      "Custo unitário contratado",
    ).toString(),
    unitSaleCents: integerCents(
      item.unit_sale_cents,
      "Venda unitária contratada",
    ).toString(),
    // Frozen line totals are authoritative; never reconstruct the contracted price.
    costCents: integerCents(item.cost_cents, "Custo contratado").toString(),
    saleCents: integerCents(item.sale_cents, "Venda contratada").toString(),
    metadata: metadata(item.metadata),
  };
}

type SnapshotEnvironment = ReviewSnapshot["environments"][number];

function normalizeReviewItem(
  item: VersionItem,
  environment: SnapshotEnvironment,
  index: number,
): ComparisonItem {
  if (!item || typeof item !== "object") invalid("item executivo inválido.");
  const itemMetadata = metadata(item.metadata);
  const variantKey = itemMetadata.variantKey ?? "";
  if (typeof variantKey !== "string")
    invalid("variante executiva deve ser texto.");
  const qty = quantity(item.quantity);
  const cost = integerCents(item.costCents, "Custo unitário executivo");
  const sale = integerCents(item.saleCents, "Venda unitária executiva");
  // All values are nonnegative. This matches PostgreSQL round(numeric) per line,
  // including half-cent ties, before adding lines or environments.
  const lineTotal = (unit: bigint) =>
    ((qty.scaled * unit + QUANTITY_SCALE / 2n) / QUANTITY_SCALE).toString();
  return {
    sourceId: JSON.stringify([
      environment.environmentId,
      environment.versionId,
      index + 1,
    ]),
    sourceItemIndex: index + 1,
    environmentId: environment.environmentId,
    supplierId: environment.supplierId,
    versionId: environment.versionId,
    code: requiredText(item.code, "Código executivo"),
    description: requiredText(item.description, "Descrição executiva"),
    unit: requiredText(item.unit, "Unidade executiva"),
    variantKey,
    quantity: qty.text,
    unitCostCents: cost.toString(),
    unitSaleCents: sale.toString(),
    costCents: lineTotal(cost),
    saleCents: lineTotal(sale),
    metadata: itemMetadata,
  };
}

function identity(item: ComparisonItem): string {
  return JSON.stringify([
    item.environmentId,
    item.supplierId,
    item.code,
    item.unit,
    item.variantKey,
  ]);
}

function content(item: ComparisonItem): string {
  return JSON.stringify(COMPARABLE_FIELDS.map((field) => item[field]));
}

function difference(
  before: ComparisonAmounts | null,
  after: ComparisonAmounts | null,
): ComparisonAmounts {
  return {
    costCents: (
      BigInt(after?.costCents ?? "0") - BigInt(before?.costCents ?? "0")
    ).toString(),
    saleCents: (
      BigInt(after?.saleCents ?? "0") - BigInt(before?.saleCents ?? "0")
    ).toString(),
  };
}

function row(
  before: ComparisonItem | null,
  after: ComparisonItem | null,
  ambiguous = false,
): ComparisonRow {
  const changedFields =
    before && after
      ? COMPARABLE_FIELDS.filter((field) =>
          field === "metadata"
            ? JSON.stringify(before.metadata) !== JSON.stringify(after.metadata)
            : before[field] !== after[field],
        )
      : [];
  return {
    id: before ? `before:${before.sourceId}` : `after:${after!.sourceId}`,
    status: !before
      ? "added"
      : !after
        ? "removed"
        : changedFields.length
          ? "changed"
          : "unchanged",
    before,
    after,
    changedFields,
    difference: difference(before, after),
    ambiguous,
  };
}

function compareGroup(
  before: ComparisonItem[],
  after: ComparisonItem[],
): ComparisonRow[] {
  const queues = new Map<
    string,
    { items: ComparisonItem[]; consumed: number }
  >();
  for (const item of after) {
    const signature = content(item);
    const queue: { items: ComparisonItem[]; consumed: number } = queues.get(
      signature,
    ) ?? { items: [], consumed: 0 };
    queue.items.push(item);
    queues.set(signature, queue);
  }
  const result: ComparisonRow[] = [];
  const remainingBefore: ComparisonItem[] = [];
  const matchedAfter = new Set<ComparisonItem>();
  for (const item of before) {
    const queue = queues.get(content(item));
    const match = queue?.items[queue.consumed];
    if (match && queue) {
      queue.consumed++;
      matchedAfter.add(match);
      result.push(row(item, match));
    } else {
      remainingBefore.push(item);
    }
  }
  const remainingAfter = after.filter((item) => !matchedAfter.has(item));
  if (remainingBefore.length === 1 && remainingAfter.length === 1) {
    result.push(row(remainingBefore[0], remainingAfter[0]));
  } else {
    const ambiguous = remainingBefore.length > 0 && remainingAfter.length > 0;
    result.push(...remainingBefore.map((item) => row(item, null, ambiguous)));
    result.push(...remainingAfter.map((item) => row(null, item, ambiguous)));
  }
  return result;
}

function emptyCounts(): ComparisonCounts {
  return { added: 0, removed: 0, changed: 0, unchanged: 0 };
}

function sumAmounts(items: readonly ComparisonAmounts[]): ComparisonAmounts {
  let cost = 0n;
  let sale = 0n;
  for (const item of items) {
    cost += BigInt(item.costCents);
    sale += BigInt(item.saleCents);
  }
  return { costCents: cost.toString(), saleCents: sale.toString() };
}

function totals(
  before: ComparisonAmounts,
  after: ComparisonAmounts,
): ComparisonTotals {
  return { before, after, difference: difference(before, after) };
}

/** Pure read model. Call with complete, authorized frozen rows and saved review only. */
export function compareTechnicalReview(
  budgetItems: readonly BudgetItem[],
  snapshot: ReviewSnapshot,
): ReviewComparison {
  if (
    !Array.isArray(budgetItems) ||
    !snapshot ||
    !Array.isArray(snapshot.environments)
  ) {
    invalid("dados contratados ou snapshot executivo ausentes.");
  }
  // Count both inputs before creating normalized rows, keys, or comparison groups.
  if (budgetItems.length > MAX_INPUT_ITEMS)
    invalid(
      "esta comparação suporta até 10.000 itens contratados. Nenhum item foi omitido. Contate o responsável pelo sistema.",
    );
  let executiveCount = 0;
  for (const environment of snapshot.environments) {
    if (!environment?.snapshot || !Array.isArray(environment.snapshot.items))
      invalid("ambiente executivo sem lista de itens válida.");
    executiveCount += environment.snapshot.items.length;
    if (executiveCount > MAX_INPUT_ITEMS)
      invalid(
        "esta comparação suporta até 10.000 itens executivos. Nenhum item foi omitido. Contate o responsável pelo sistema.",
      );
  }

  type EnvironmentData = {
    before: ComparisonItem[];
    after: ComparisonItem[];
    snapshot: SnapshotEnvironment | null;
  };
  const environmentData = new Map<string, EnvironmentData>();
  const budgetIds = new Set<string>();
  for (const item of budgetItems) {
    const normalized = normalizeBudgetItem(item);
    if (budgetIds.has(normalized.sourceId))
      invalid("um item contratado foi carregado mais de uma vez.");
    budgetIds.add(normalized.sourceId);
    const environment: EnvironmentData = environmentData.get(
      normalized.environmentId,
    ) ?? { before: [], after: [], snapshot: null };
    environment.before.push(normalized);
    environmentData.set(normalized.environmentId, environment);
  }
  for (const environment of snapshot.environments) {
    requiredText(environment.environmentId, "Ambiente executivo");
    requiredText(environment.supplierId, "Fornecedor executivo");
    requiredText(environment.versionId, "Versão executiva");
    requiredText(environment.name, "Nome do ambiente executivo");
    if (
      !Number.isSafeInteger(environment.versionNumber) ||
      environment.versionNumber < 1
    )
      invalid("número da versão executiva inválido.");
    const data: EnvironmentData = environmentData.get(
      environment.environmentId,
    ) ?? { before: [], after: [], snapshot: null };
    if (data.snapshot) invalid("o snapshot repete o mesmo ambiente.");
    data.snapshot = environment;
    data.after = environment.snapshot.items.map((item, index) =>
      normalizeReviewItem(item, environment, index),
    );
    environmentData.set(environment.environmentId, data);
  }

  const environments: EnvironmentComparison[] = [];
  const counts = emptyCounts();
  for (const environmentId of [...environmentData.keys()].sort()) {
    const data = environmentData.get(environmentId)!;
    const groups = new Map<
      string,
      { before: ComparisonItem[]; after: ComparisonItem[] }
    >();
    for (const side of ["before", "after"] as const) {
      for (const item of data[side]) {
        const key = identity(item);
        const group: { before: ComparisonItem[]; after: ComparisonItem[] } =
          groups.get(key) ?? { before: [], after: [] };
        group[side].push(item);
        groups.set(key, group);
      }
    }
    const rows = [...groups.keys()].sort().flatMap((key) => {
      const group = groups.get(key)!;
      return compareGroup(group.before, group.after);
    });
    const environmentCounts = emptyCounts();
    for (const item of rows) {
      environmentCounts[item.status]++;
      counts[item.status]++;
    }
    const beforeVersionIds = [
      ...new Set(data.before.map((item) => item.versionId)),
    ].sort();
    const afterVersionId = data.snapshot?.versionId ?? null;
    environments.push({
      environmentId,
      name: data.snapshot?.name ?? null,
      beforeVersionIds,
      afterVersionId,
      afterVersionNumber: data.snapshot?.versionNumber ?? null,
      versionChanged:
        beforeVersionIds.length !== 1 || beforeVersionIds[0] !== afterVersionId,
      rows,
      counts: environmentCounts,
      totals: totals(sumAmounts(data.before), sumAmounts(data.after)),
      hasChanges: rows.some((item) => item.status !== "unchanged"),
      hasAmbiguities: rows.some((item) => item.ambiguous),
    });
  }
  return {
    environments,
    counts,
    totals: totals(
      sumAmounts(environments.map((environment) => environment.totals.before)),
      sumAmounts(environments.map((environment) => environment.totals.after)),
    ),
    hasChanges: environments.some((environment) => environment.hasChanges),
    hasAmbiguities: environments.some(
      (environment) => environment.hasAmbiguities,
    ),
  };
}

/** Reconcile the read model against authoritative totals before showing approval UI. */
export function assertComparisonTotals(
  comparison: ReviewComparison,
  expected: {
    contractSaleCents: Money;
    reviewSaleCents: Money;
    reviewCostCents: Money;
    differenceCents: Money;
  },
): void {
  const checks = [
    [
      comparison.totals.before.saleCents,
      expected.contractSaleCents,
      "total de venda contratado",
      false,
    ],
    [
      comparison.totals.after.saleCents,
      expected.reviewSaleCents,
      "total de venda executivo",
      false,
    ],
    [
      comparison.totals.after.costCents,
      expected.reviewCostCents,
      "total de custo executivo",
      false,
    ],
    [
      comparison.totals.difference.saleCents,
      expected.differenceCents,
      "diferença oficial de venda",
      true,
    ],
  ] as const;
  for (const [actual, official, label, signed] of checks) {
    if (
      integerCents(actual, label, signed) !==
      integerCents(official, label, signed)
    ) {
      invalid(
        `${label} diverge dos itens conferidos. Atualize a consulta e confira os registros de origem.`,
      );
    }
  }
}
