import { beforeEach, describe, expect, it } from "vitest";
import type {
  BudgetItem,
  ReviewSnapshot,
  VersionItem,
} from "../src/lib/domain";
import {
  assertComparisonTotals,
  compareTechnicalReview,
} from "../src/lib/review-comparison";

let sequence = 0;
beforeEach(() => {
  sequence = 0;
});

function budgetItem(overrides: Partial<BudgetItem> = {}): BudgetItem {
  const index = ++sequence;
  return {
    id: `budget-item-${index}`,
    created_at: "2026-11-01T00:00:00Z",
    created_by: "actor",
    budget_id: "budget-1",
    environment_id: "env-a",
    environment_version_id: "version-1",
    source_item_index: index,
    supplier_id: "supplier-a",
    code: "A",
    description: "Peça A",
    unit: "UN",
    variant_key: "",
    quantity: "1.0000",
    unit_cost_cents: "60",
    unit_sale_cents: "100",
    cost_cents: "60",
    sale_cents: "100",
    metadata: {},
    ...overrides,
  };
}

function executiveItem(overrides: Partial<VersionItem> = {}): VersionItem {
  return {
    code: "A",
    description: "Peça A",
    unit: "UN",
    quantity: 1,
    costCents: 60,
    saleCents: 100,
    metadata: {},
    ...overrides,
  };
}

function review(
  items: VersionItem[],
  overrides: Partial<ReviewSnapshot["environments"][number]> = {},
): ReviewSnapshot {
  return {
    environments: [
      {
        environmentId: "env-a",
        name: "Cozinha",
        supplierId: "supplier-a",
        versionId: "version-2",
        versionNumber: 2,
        snapshot: { name: "Cozinha", items },
        ...overrides,
      },
    ],
  };
}

function officialExample() {
  return compareTechnicalReview(
    [
      budgetItem({
        quantity: "2.0000",
        unit_cost_cents: "6000",
        unit_sale_cents: "10000",
        cost_cents: "12000",
        sale_cents: "20000",
      }),
      budgetItem({
        code: "B",
        description: "Peça B",
        unit_cost_cents: "3000",
        unit_sale_cents: "5000",
        cost_cents: "3000",
        sale_cents: "5000",
      }),
    ],
    review([
      executiveItem({ quantity: 3, costCents: 6500, saleCents: 11000 }),
      executiveItem({
        code: "C",
        description: "Peça C",
        costCents: 1000,
        saleCents: 2000,
      }),
    ]),
  );
}

function freezeRecursively(value: unknown): void {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(freezeRecursively);
    Object.freeze(value);
  }
}

describe("saved technical review comparison", () => {
  it("compares changed, removed and added lines and reconciles the specified R$250 to R$350 example", () => {
    const result = officialExample();
    expect(result.counts).toEqual({
      added: 1,
      removed: 1,
      changed: 1,
      unchanged: 0,
    });
    expect(result.totals).toEqual({
      before: { costCents: "15000", saleCents: "25000" },
      after: { costCents: "20500", saleCents: "35000" },
      difference: { costCents: "5500", saleCents: "10000" },
    });
    const changed = result.environments[0].rows.find(
      (item) => item.status === "changed",
    )!;
    expect(changed.before?.quantity).toBe("2");
    expect(changed.after?.quantity).toBe("3");
    expect(changed.changedFields).toEqual([
      "quantity",
      "unitCostCents",
      "unitSaleCents",
      "costCents",
      "saleCents",
    ]);
    expect(changed.difference).toEqual({
      costCents: "7500",
      saleCents: "13000",
    });
    expect(
      result.environments[0].rows.find((item) => item.status === "removed")
        ?.difference.saleCents,
    ).toBe("-5000");
    expect(
      result.environments[0].rows.find((item) => item.status === "added")
        ?.difference.saleCents,
    ).toBe("2000");
    expect(result.hasChanges).toBe(true);
    expect(result.hasAmbiguities).toBe(false);
  });

  it("matches reordered duplicate occurrences without dropping quantities or values", () => {
    const first = budgetItem();
    const second = budgetItem();
    const other = budgetItem({ code: "B" });
    const result = compareTechnicalReview(
      [first, second, other],
      review([executiveItem({ code: "B" }), executiveItem(), executiveItem()]),
    );
    expect(result.counts).toEqual({
      added: 0,
      removed: 0,
      changed: 0,
      unchanged: 3,
    });
    expect(
      result.environments[0].rows.map((item) => item.before?.sourceId).sort(),
    ).toEqual([first.id, second.id, other.id].sort());
    expect(result.totals.before.saleCents).toBe("300");
    expect(result.totals.after.saleCents).toBe("300");
    expect(result.totals.difference.saleCents).toBe("0");
    expect(result.hasAmbiguities).toBe(false);
  });

  it("matches exact content first and pairs only the unique remaining before/after", () => {
    const changed = budgetItem();
    const identical = budgetItem({
      quantity: 2,
      cost_cents: "120",
      sale_cents: "200",
    });
    const result = compareTechnicalReview(
      [changed, identical],
      review([executiveItem({ quantity: 2 }), executiveItem({ quantity: 3 })]),
    );
    expect(result.counts).toEqual({
      added: 0,
      removed: 0,
      changed: 1,
      unchanged: 1,
    });
    const rows = result.environments[0].rows;
    expect(
      rows.find((item) => item.before?.sourceId === identical.id)?.after
        ?.quantity,
    ).toBe("2");
    expect(
      rows.find((item) => item.before?.sourceId === changed.id)?.after
        ?.quantity,
    ).toBe("3");
    expect(result.hasAmbiguities).toBe(false);
  });

  it("shows ambiguous remainders as removed/added while retaining exact matches", () => {
    const result = compareTechnicalReview(
      [
        budgetItem(),
        budgetItem({ quantity: 2, cost_cents: 120, sale_cents: 200 }),
        budgetItem({ quantity: 9, cost_cents: 540, sale_cents: 900 }),
      ],
      review([
        executiveItem({ quantity: 4 }),
        executiveItem({ quantity: 9 }),
        executiveItem({ quantity: 3 }),
      ]),
    );
    expect(result.counts).toEqual({
      added: 2,
      removed: 2,
      changed: 0,
      unchanged: 1,
    });
    expect(result.hasAmbiguities).toBe(true);
    expect(
      result.environments[0].rows.filter((item) => item.ambiguous),
    ).toHaveLength(4);
    expect(
      result.environments[0].rows.find((item) => item.status === "unchanged")
        ?.ambiguous,
    ).toBe(false);
    expect(result.totals.before.saleCents).toBe("1200");
    expect(result.totals.after.saleCents).toBe("1600");
  });

  it("does not arbitrarily pair one old line with two new candidates", () => {
    const result = compareTechnicalReview(
      [budgetItem()],
      review([executiveItem({ quantity: 2 }), executiveItem({ quantity: 3 })]),
    );
    expect(result.counts).toEqual({
      added: 2,
      removed: 1,
      changed: 0,
      unchanged: 0,
    });
    expect(result.environments[0].rows.every((item) => item.ambiguous)).toBe(
      true,
    );
  });

  it("identifies a duplicate occurrence added after all old occurrences matched", () => {
    const result = compareTechnicalReview(
      [budgetItem(), budgetItem()],
      review([executiveItem(), executiveItem(), executiveItem()]),
    );
    expect(result.counts).toEqual({
      added: 1,
      removed: 0,
      changed: 0,
      unchanged: 2,
    });
    expect(result.hasAmbiguities).toBe(false);
    expect(result.totals.difference.saleCents).toBe("100");
  });

  it.each(["supplier", "unit", "variant", "environment"] as const)(
    "keeps the same code separate when %s identity changes",
    (field) => {
      const item = executiveItem(
        field === "unit"
          ? { unit: "M" }
          : field === "variant"
            ? { metadata: { variantKey: "different" } }
            : {},
      );
      const snapshot = review(
        [item],
        field === "supplier"
          ? { supplierId: "supplier-b" }
          : field === "environment"
            ? { environmentId: "env-b" }
            : {},
      );
      const result = compareTechnicalReview([budgetItem()], snapshot);
      expect(result.counts).toEqual({
        added: 1,
        removed: 1,
        changed: 0,
        unchanged: 0,
      });
      expect(result.totals.difference.saleCents).toBe("0");
      expect(result.hasChanges).toBe(true);
      expect(result.hasAmbiguities).toBe(false);
      if (field === "environment") {
        expect(result.environments).toHaveLength(2);
        expect(
          result.environments.find(
            (environment) => environment.environmentId === "env-a",
          )?.afterVersionId,
        ).toBeNull();
        expect(
          result.environments.find(
            (environment) => environment.environmentId === "env-b",
          )?.beforeVersionIds,
        ).toEqual([]);
      }
    },
  );

  it("compares nested metadata independent of object key order", () => {
    const result = compareTechnicalReview(
      [
        budgetItem({
          variant_key: "same",
          metadata: {
            dimensions: { width: 80, height: 200 },
            finish: ["A", "B"],
            variantKey: "same",
          },
        }),
      ],
      review([
        executiveItem({
          metadata: {
            variantKey: "same",
            finish: ["A", "B"],
            dimensions: { height: 200, width: 80 },
          },
        }),
      ]),
    );
    expect(result.counts.unchanged).toBe(1);
    expect(result.hasChanges).toBe(false);
  });

  it("shows description and metadata changes without losing imported values", () => {
    const result = compareTechnicalReview(
      [
        budgetItem({
          variant_key: "same",
          metadata: { variantKey: "same", finishes: ["A", "B"], flag: false },
        }),
      ],
      review([
        executiveItem({
          description: "Descrição revisada",
          metadata: { variantKey: "same", finishes: ["B", "A"], flag: null },
        }),
      ]),
    );
    const changed = result.environments[0].rows[0];
    expect(changed.changedFields).toEqual(["description", "metadata"]);
    expect(changed.after?.metadata).toEqual({
      finishes: ["B", "A"],
      flag: null,
      variantKey: "same",
    });
    expect(changed.difference.saleCents).toBe("0");
  });

  it("distinguishes a new saved version from material changes and keeps provenance", () => {
    const original = budgetItem({ source_item_index: 7 });
    const result = compareTechnicalReview(
      [original],
      review([executiveItem()]),
    );
    const environment = result.environments[0];
    expect(result.hasChanges).toBe(false);
    expect(environment.versionChanged).toBe(true);
    expect(environment.beforeVersionIds).toEqual(["version-1"]);
    expect(environment.afterVersionId).toBe("version-2");
    expect(environment.afterVersionNumber).toBe(2);
    expect(environment.rows[0].before?.sourceItemIndex).toBe(7);
    expect(environment.rows[0].after?.sourceItemIndex).toBe(1);
    expect(environment.rows[0].after?.versionId).toBe("version-2");
    expect(
      compareTechnicalReview(
        [original],
        review([executiveItem()], { versionId: "version-1", versionNumber: 1 }),
      ).environments[0].versionChanged,
    ).toBe(false);
  });

  it("uses frozen old totals instead of recomputing the contracted amount", () => {
    const result = compareTechnicalReview(
      [budgetItem({ cost_cents: "59", sale_cents: "99" })],
      review([executiveItem()]),
    );
    expect(result.totals.before).toEqual({ costCents: "59", saleCents: "99" });
    expect(result.environments[0].rows[0].changedFields).toEqual([
      "costCents",
      "saleCents",
    ]);
    expect(result.totals.difference).toEqual({
      costCents: "1",
      saleCents: "1",
    });
  });

  it("rounds half-cent ties on each line before summing", () => {
    const result = compareTechnicalReview(
      [],
      review([
        executiveItem({ quantity: 0.5, costCents: 1, saleCents: 1 }),
        executiveItem({ quantity: 0.5, costCents: 1, saleCents: 1 }),
      ]),
    );
    expect(
      result.environments[0].rows.map((item) => item.after?.saleCents),
    ).toEqual(["1", "1"]);
    expect(result.totals.after).toEqual({ costCents: "2", saleCents: "2" });
  });

  it.each([
    [0.4999, "0"],
    [0.5001, "1"],
    [1.2345, "1"],
    [0.0001, "0"],
  ])(
    "rounds the four-decimal quantity %s without floating arithmetic",
    (qty, expected) => {
      const result = compareTechnicalReview(
        [],
        review([
          executiveItem({
            quantity: qty as number,
            costCents: 1,
            saleCents: 1,
          }),
        ]),
      );
      expect(result.totals.after.saleCents).toBe(expected);
    },
  );

  it("keeps large intermediate products and cent values exact and JSON-serializable", () => {
    const result = compareTechnicalReview(
      [],
      review([
        executiveItem({
          quantity: 8999.1234,
          costCents: 999_999_999_999,
          saleCents: 999_999_999_999,
        }),
      ]),
    );
    expect(result.totals.after).toEqual({
      costCents: "8999123399991001",
      saleCents: "8999123399991001",
    });
    expect(result.environments[0].rows[0].after?.quantity).toBe("8999.1234");
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it("sums environments without mixing their identical codes", () => {
    const result = compareTechnicalReview(
      [budgetItem(), budgetItem({ environment_id: "env-b" })],
      {
        environments: [
          ...review([executiveItem({ quantity: 2 })]).environments,
          ...review([executiveItem({ quantity: 3 })], {
            environmentId: "env-b",
            name: "Quarto",
          }).environments,
        ],
      },
    );
    expect(
      result.environments.map(
        (environment) => environment.totals.difference.saleCents,
      ),
    ).toEqual(["100", "200"]);
    expect(result.totals.difference.saleCents).toBe("300");
    expect(result.counts.changed).toBe(2);
  });

  it("does not mutate input records or share mutable metadata with the output", () => {
    const before = [
      budgetItem({ metadata: { nested: { value: "original" } } }),
    ];
    const snapshot = review([
      executiveItem({ metadata: { nested: { value: "original" } } }),
    ]);
    const saved = JSON.stringify({ before, snapshot });
    freezeRecursively(before);
    freezeRecursively(snapshot);
    const result = compareTechnicalReview(before, snapshot);
    (
      result.environments[0].rows[0].after!.metadata.nested as { value: string }
    ).value = "changed output";
    expect(JSON.stringify({ before, snapshot })).toBe(saved);
    expect(result.environments[0].rows[0].before?.metadata.nested).toEqual({
      value: "original",
    });
  });

  it("preserves JSON metadata keys such as __proto__ as data", () => {
    const value = JSON.parse(
      '{"__proto__":{"marker":"data"},"constructor":"part"}',
    );
    const result = compareTechnicalReview(
      [budgetItem({ metadata: value })],
      review([executiveItem({ metadata: value })]),
    );
    expect(result.counts.unchanged).toBe(1);
    expect(
      Object.hasOwn(
        result.environments[0].rows[0].after!.metadata,
        "__proto__",
      ),
    ).toBe(true);
    expect(
      Object.getPrototypeOf(result.environments[0].rows[0].after!.metadata),
    ).toBe(Object.prototype);
    expect(({} as { marker?: string }).marker).toBeUndefined();
  });

  it("rejects an oversized contracted input before reading its items", () => {
    const items = Array<BudgetItem>(10_001).fill(budgetItem());
    Object.defineProperty(items[0], "quantity", {
      get() {
        throw new Error("must not normalize");
      },
    });
    expect(() => compareTechnicalReview(items, review([]))).toThrow(
      /10\.000 itens contratados.*Nenhum item foi omitido/,
    );
  });

  it("rejects an oversized executive input across environments before normalization", () => {
    const item = executiveItem();
    Object.defineProperty(item, "quantity", {
      get() {
        throw new Error("must not normalize");
      },
    });
    const snapshot = {
      environments: [
        ...review(Array<VersionItem>(6000).fill(item)).environments,
        ...review(Array<VersionItem>(4001).fill(item), {
          environmentId: "env-b",
        }).environments,
      ],
    };
    expect(() => compareTechnicalReview([], snapshot)).toThrow(
      /10\.000 itens executivos.*Nenhum item foi omitido/,
    );
  });

  it("accepts exactly 10,000 items on each side without truncating 20,000 different rows", () => {
    const before = Array.from({ length: 10_000 }, () => budgetItem());
    const result = compareTechnicalReview(
      before,
      review(
        Array.from({ length: 10_000 }, () => executiveItem({ code: "B" })),
      ),
    );
    expect(result.environments[0].rows).toHaveLength(20_000);
    expect(result.counts).toEqual({
      added: 10_000,
      removed: 10_000,
      changed: 0,
      unchanged: 0,
    });
    expect(result.totals.before.saleCents).toBe("1000000");
    expect(result.totals.after.saleCents).toBe("1000000");
  });

  it.each([0, -1, 0.00001, 1_000_001, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid executive quantity %s instead of presenting partial totals",
    (quantity) => {
      expect(() =>
        compareTechnicalReview([], review([executiveItem({ quantity })])),
      ).toThrow(/quantidade/);
    },
  );

  it.each([1.1, -1, Number.MAX_SAFE_INTEGER + 1, Number.NaN])(
    "rejects invalid unit cents %s",
    (saleCents) => {
      expect(() =>
        compareTechnicalReview([], review([executiveItem({ saleCents })])),
      ).toThrow(/centavos/);
    },
  );

  it("refuses duplicate source rows and duplicate saved environments rather than double counting", () => {
    const before = budgetItem();
    expect(() => compareTechnicalReview([before, before], review([]))).toThrow(
      /mais de uma vez/,
    );
    const environment = review([executiveItem()]).environments[0];
    expect(() =>
      compareTechnicalReview([], { environments: [environment, environment] }),
    ).toThrow(/repete o mesmo ambiente/);
  });
});

describe("official total reconciliation", () => {
  const expected = {
    contractSaleCents: "25000",
    reviewSaleCents: "35000",
    reviewCostCents: "20500",
    differenceCents: "10000",
  };

  it("accepts exact official totals from numbers or strings", () => {
    expect(() =>
      assertComparisonTotals(officialExample(), {
        ...expected,
        reviewSaleCents: 35000,
      }),
    ).not.toThrow();
  });

  it.each([
    ["contractSaleCents", /venda contratado/],
    ["reviewSaleCents", /venda executivo/],
    ["reviewCostCents", /custo executivo/],
    ["differenceCents", /diferença oficial/],
  ] as const)(
    "rejects inconsistent official %s even when other totals agree",
    (field, message) => {
      expect(() =>
        assertComparisonTotals(officialExample(), {
          ...expected,
          [field]: "1",
        }),
      ).toThrow(message);
    },
  );

  it("accepts negative differences with exact signed cents", () => {
    const result = compareTechnicalReview([budgetItem()], review([]));
    expect(result.totals.difference.saleCents).toBe("-100");
    expect(() =>
      assertComparisonTotals(result, {
        contractSaleCents: 100,
        reviewSaleCents: 0,
        reviewCostCents: 0,
        differenceCents: "-100",
      }),
    ).not.toThrow();
  });

  it("rejects an unsafe numeric official total instead of rounding it", () => {
    expect(() =>
      assertComparisonTotals(officialExample(), {
        ...expected,
        contractSaleCents: Number.MAX_SAFE_INTEGER + 1,
      }),
    ).toThrow(/exatos/);
  });
});
