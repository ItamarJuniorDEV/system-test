import { expect, test, type Locator, type Page } from "@playwright/test";

const environmentName = "Cozinha da revisão";
const unchangedCodes = Array.from(
  { length: 51 },
  (_, index) => `S${String(index + 1).padStart(2, "0")}`,
);

type XmlItem = {
  code: string;
  description: string;
  quantity: number;
  cost: number;
  sale: number;
};

function syntheticReviewXml(version: 1 | 2 | 3): Buffer {
  const firstItem: XmlItem = {
    code: "A",
    description:
      version === 1
        ? "Armário A contratado"
        : version === 2
          ? "Armário A executivo"
          : "Armário A atualizado",
    quantity: version + 1,
    cost: version === 1 ? 60 : version === 2 ? 65 : 70,
    sale: version === 1 ? 100 : version === 2 ? 110 : 120,
  };
  const secondItem: XmlItem =
    version === 1
      ? {
          code: "B",
          description: "Prateleira B",
          quantity: 1,
          cost: 20,
          sale: 50,
        }
      : {
          code: "C",
          description: "Prateleira C",
          quantity: 1,
          cost: 10,
          sale: 20,
        };
  const items: XmlItem[] = [
    firstItem,
    secondItem,
    ...unchangedCodes.map((code) => ({
      code,
      description: `Item sem alteração ${code}`,
      quantity: 1,
      cost: 0,
      sale: 0,
    })),
  ];
  return Buffer.from(
    `<?xml version="1.0" encoding="UTF-8"?>
<!-- Fixture sintetica deste teste; nao representa XML Promob homologado. -->
<project name="Comparação sintética">
  <environments>
    <environment name="${environmentName}">
      <items>${items
        .map(
          (item) => `
        <item code="${item.code}">
          <description>${item.description}</description>
          <quantity>${item.quantity}</quantity>
          <unit>UN</unit>
          <unitCost>${item.cost.toFixed(2).replace(".", ",")}</unitCost>
          <unitSale>${item.sale.toFixed(2).replace(".", ",")}</unitSale>
        </item>`,
        )
        .join("")}
      </items>
    </environment>
  </environments>
</project>`,
    "utf8",
  );
}

async function importVersion(
  page: Page,
  environmentPath: string,
  version: 1 | 2 | 3,
) {
  await page.goto(environmentPath);
  const importer = page.locator("section").filter({
    has: page.getByRole("heading", {
      level: 2,
      name: "Importar projeto por XML",
      exact: true,
    }),
  });
  await importer
    .getByLabel("Escolha ou arraste um XML de projeto", { exact: true })
    .setInputFiles({
      name: `comparacao-sintetica-v${version}.xml`,
      mimeType: "application/xml",
      buffer: syntheticReviewXml(version),
    });
  await importer
    .getByRole("button", {
      name: "Gerar prévia com este layout",
      exact: true,
    })
    .click();
  await importer.getByLabel("Ambiente de origem no XML").selectOption("0");
  await importer
    .getByRole("checkbox", { name: /^Confirmo a importação de / })
    .check();
  await importer
    .getByRole("button", {
      name: "Confirmar importação neste ambiente",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: `Itens da versão ${version}`,
      exact: true,
    }),
  ).toBeVisible();
}

function positiveMoney(amount: string): RegExp {
  return new RegExp(`^\\+?\\s*R\\$\\s*${amount.replaceAll(".", "\\.")}$`);
}

function definitionValue(scope: Locator, label: string): Locator {
  return scope
    .locator("dl dt")
    .filter({ hasText: new RegExp(`^${label}$`) })
    .locator("xpath=following-sibling::dd[1]");
}

async function expectTotals(
  comparison: Locator,
  executive: {
    sale: string;
    cost: string;
    saleDifference: string;
    costDifference: string;
  },
) {
  for (const [label, amount] of [
    ["Venda contratada", "250,00"],
    ["Venda executiva", executive.sale],
    ["Diferença de venda", executive.saleDifference],
    ["Custo contratado", "140,00"],
    ["Custo executivo", executive.cost],
    ["Diferença de custo", executive.costDifference],
  ]) {
    await expect(definitionValue(comparison, label)).toHaveText(
      positiveMoney(amount),
    );
  }
}

test("compara itens, pagina sem perder totais e preserva o contratado ao atualizar a revisão", async ({
  page,
}, testInfo) => {
  const suffix = Date.now().toString();
  const customerName = `Cliente comparação ${suffix}`;
  const projectName = `Projeto comparação ${suffix}`;
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("dialog", (dialog) => dialog.accept());
  let projectPath = "";
  let environmentPath = "";
  let budgetPath = "";
  let contractPath = "";
  const versionTwoTotals = {
    sale: "350,00",
    cost: "205,00",
    saleDifference: "100,00",
    costDifference: "65,00",
  };
  const comparison = page.getByRole("region", {
    name: `Comparação de ${environmentName}`,
    exact: true,
  });
  const table = comparison.getByRole("table", {
    name: `Itens comparados de ${environmentName}`,
    exact: true,
  });
  const rows = table.locator("tbody > tr[data-code]");
  const differencesOnly = page.getByRole("checkbox", {
    name: "Mostrar somente diferenças",
    exact: true,
  });

  await test.step("cria dados próprios e contrata a versão 1 por R$ 250,00", async () => {
    await page.goto("/clientes");
    await page.getByLabel("Nome completo / razão social *").fill(customerName);
    await page
      .getByRole("button", { name: "Cadastrar cliente", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("sucesso");
    await page.goto("/projetos");
    await page
      .getByLabel("Cliente *", { exact: true })
      .selectOption({ label: customerName });
    await page.getByLabel("Nome do projeto *").fill(projectName);
    await page
      .getByRole("button", { name: "Criar projeto", exact: true })
      .click();
    await expect(page).toHaveURL(/\/projetos\/[\da-f-]+$/);
    projectPath = new URL(page.url()).pathname;
    await page.getByLabel("Nome do ambiente *").fill(environmentName);
    await page
      .getByLabel("Fornecedor *", { exact: true })
      .selectOption({ index: 1 });
    await page
      .getByRole("button", { name: "Criar ambiente", exact: true })
      .click();
    await expect(page).toHaveURL(/\/ambientes\/[\da-f-]+$/);
    environmentPath = new URL(page.url()).pathname;
    await importVersion(page, environmentPath, 1);
    await page.goto(projectPath);
    await page
      .getByRole("button", { name: "Gerar e conferir orçamento", exact: true })
      .click();
    await expect(page).toHaveURL(/\/orcamentos\/[\da-f-]+$/);
    budgetPath = new URL(page.url()).pathname;
    await expect(
      page.locator(".stat").filter({ hasText: "Valor de venda" }),
    ).toContainText("R$ 250,00");
    await page
      .getByRole("button", {
        name: "Criar contrato deste orçamento",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(/\/contratos\/[\da-f-]+$/);
    contractPath = new URL(page.url()).pathname;
    await page
      .getByRole("button", { name: "Registrar assinatura", exact: true })
      .click();
    for (const title of ["Liberação comercial", "Liberação financeira"]) {
      await page
        .locator(".approval-card")
        .filter({
          has: page.getByRole("heading", { name: title, exact: true }),
        })
        .getByRole("button", { name: "Aprovar", exact: true })
        .click();
    }
    await expect(
      page.getByRole("button", { name: "Iniciar revisão", exact: true }),
    ).toBeVisible();
  });

  await test.step("compara a revisão da versão 2 com os itens contratados", async () => {
    await importVersion(page, environmentPath, 2);
    await page.goto(contractPath);
    await page
      .getByRole("button", { name: "Iniciar revisão", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Comparação com o contratado",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      comparison.getByText("Contratado: versão 1", { exact: true }),
    ).toBeVisible();
    await expect(
      comparison.getByText("Executivo: versão 2", { exact: true }),
    ).toBeVisible();
    await expect(differencesOnly).toBeChecked();
    await expect(rows).toHaveCount(3);
    await expect(table.getByRole("columnheader")).toHaveText([
      "Item",
      "Contratado",
      "Executivo",
      "Diferença de venda",
    ]);
    await expectTotals(comparison, versionTwoTotals);

    // Select the row itself: the code is stable even when the XML description changes.
    const itemA = table.locator('tbody > tr[data-code="A"]');
    await expect(itemA).toHaveAttribute("data-status", "changed");
    const before = itemA.getByRole("cell").nth(0);
    const after = itemA.getByRole("cell").nth(1);
    await expect(definitionValue(before, "Quantidade")).toHaveText("2 UN");
    await expect(definitionValue(after, "Quantidade")).toHaveText("3 UN");
    for (const [label, amount] of [
      ["Custo unitário", "60,00"],
      ["Venda unitária", "100,00"],
      ["Custo total", "120,00"],
      ["Venda total", "200,00"],
    ]) {
      await expect(definitionValue(before, label)).toHaveText(
        positiveMoney(amount),
      );
    }
    for (const [label, amount] of [
      ["Custo unitário", "65,00"],
      ["Venda unitária", "110,00"],
      ["Custo total", "195,00"],
      ["Venda total", "330,00"],
    ]) {
      await expect(definitionValue(after, label)).toHaveText(
        positiveMoney(amount),
      );
    }
    await expect(itemA.getByRole("cell").nth(2)).toHaveText(
      positiveMoney("130,00"),
    );
    const itemB = table.locator('tbody > tr[data-code="B"]');
    const itemC = table.locator('tbody > tr[data-code="C"]');
    await expect(itemB).toHaveAttribute("data-status", "removed");
    await expect(itemC).toHaveAttribute("data-status", "added");
    await expect(itemB.getByRole("cell").nth(0)).toContainText("R$ 50,00");
    await expect(itemB.getByRole("cell").nth(1)).toHaveText(
      "Não consta nesta versão",
    );
    await expect(itemC.getByRole("cell").nth(0)).toHaveText(
      "Não consta nesta versão",
    );
    await expect(itemC.getByRole("cell").nth(1)).toContainText("R$ 20,00");
    await itemA.locator("summary").click();
    await expect(itemA.locator("details")).toHaveAttribute("open", "");
    await expect(itemA.locator("details")).toContainText(
      "Armário A contratado",
    );
    await expect(itemA.locator("details")).toContainText("Armário A executivo");
    await itemA.locator("summary").click();
  });

  await test.step("pagina as 54 linhas, preserva totais e reinicia a página ao filtrar", async () => {
    const previous = comparison.getByRole("button", {
      name: `Página anterior de ${environmentName}`,
      exact: true,
    });
    const next = comparison.getByRole("button", {
      name: `Próxima página de ${environmentName}`,
      exact: true,
    });
    await differencesOnly.uncheck();
    await expect(rows).toHaveCount(50);
    await expect(
      comparison.getByText("Página 1 de 2", { exact: true }),
    ).toBeVisible();
    await expect(previous).toBeDisabled();
    const firstPage = await rows.evaluateAll((elements) =>
      elements.map((element) => ({
        code: element.getAttribute("data-code"),
        status: element.getAttribute("data-status"),
      })),
    );
    await expectTotals(comparison, versionTwoTotals);
    await next.click();
    await expect(rows).toHaveCount(4);
    await expect(
      comparison.getByText("Página 2 de 2", { exact: true }),
    ).toBeVisible();
    await expect(next).toBeDisabled();
    const secondPage = await rows.evaluateAll((elements) =>
      elements.map((element) => ({
        code: element.getAttribute("data-code"),
        status: element.getAttribute("data-status"),
      })),
    );
    const allRows = [...firstPage, ...secondPage];
    expect(allRows.map((row) => row.code).sort()).toEqual(
      ["A", "B", "C", ...unchangedCodes].sort(),
    );
    expect(allRows.filter((row) => row.status === "unchanged")).toHaveLength(
      51,
    );
    await expectTotals(comparison, versionTwoTotals);
    await previous.click();
    await expect(rows).toHaveCount(50);
    await next.click();
    await expect(rows).toHaveCount(4);
    await differencesOnly.check();
    await expect(rows).toHaveCount(3);
    await expectTotals(comparison, versionTwoTotals);
    await differencesOnly.uncheck();
    await expect(rows).toHaveCount(50);
    await expect(
      comparison.getByText("Página 1 de 2", { exact: true }),
    ).toBeVisible();
    await expect(previous).toBeDisabled();
    await differencesOnly.check();
    await expect(rows).toHaveCount(3);
  });

  await test.step("a comparação cabe em 390 px com detalhes acessíveis", async () => {
    const desktopViewport = page.viewportSize();
    await comparison.screenshot({
      path: testInfo.outputPath("review-comparison-desktop.png"),
    });
    await page.setViewportSize({ width: 390, height: 844 });
    const details = table.locator('tbody > tr[data-code="A"] details');
    await details.locator("summary").click();
    await expect(
      details.getByText("Armário A executivo", { exact: true }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    const scroller = comparison.getByRole("region", {
      name: `Tabela com rolagem de ${environmentName}`,
      exact: true,
    });
    expect(
      await scroller.evaluate(
        (element) => element.scrollWidth > element.clientWidth,
      ),
    ).toBe(true);
    const reachedLastColumn = await scroller.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
      const lastHeader = element.querySelector("thead th:last-child");
      return (
        element.scrollLeft > 0 &&
        lastHeader !== null &&
        lastHeader.getBoundingClientRect().right <=
          element.getBoundingClientRect().right + 1
      );
    });
    expect(reachedLastColumn).toBe(true);
    await scroller.evaluate((element) => {
      element.scrollLeft = 0;
    });
    await page.screenshot({
      path: testInfo.outputPath("review-comparison-mobile.png"),
      fullPage: true,
    });
    await details.locator("summary").click();
    if (desktopViewport) await page.setViewportSize(desktopViewport);
  });

  await test.step("uma importação posterior não muda o snapshot nem permite aprová-lo", async () => {
    await importVersion(page, environmentPath, 3);
    await page.goto(contractPath);
    await expect(
      comparison.getByText("Executivo: versão 2", { exact: true }),
    ).toBeVisible();
    await expect(
      comparison.getByText("Executivo: versão 3", { exact: true }),
    ).toHaveCount(0);
    await expectTotals(comparison, versionTwoTotals);
    await expect(
      table.locator('tbody > tr[data-code="A"]').getByRole("cell").nth(1),
    ).toContainText("3 UN");
    const approval = page.locator("form").filter({
      has: page.getByRole("button", {
        name: "Aprovar revisão executiva",
        exact: true,
      }),
    });
    await approval
      .getByRole("checkbox", { name: /^Conferi as diferenças/ })
      .check();
    await approval
      .getByLabel("Justificativa das diferenças *", { exact: true })
      .fill(
        "Conferência do snapshot antigo para validar a recusa da revisão desatualizada.",
      );
    await approval
      .getByRole("button", { name: "Aprovar revisão executiva", exact: true })
      .click();
    await expect(approval.getByRole("alert")).toContainText(
      "Revisão desatualizada",
    );
    await expect(
      page.getByRole("button", {
        name: "Gerar pedidos por fornecedor",
        exact: true,
      }),
    ).toHaveCount(0);
    await expectTotals(comparison, versionTwoTotals);
  });

  await test.step("atualiza para a versão 3 e aprova sem reajustar contrato ou orçamento", async () => {
    await page
      .getByRole("button", { name: "Atualizar revisão", exact: true })
      .click();
    await expect(
      comparison.getByText("Contratado: versão 1", { exact: true }),
    ).toBeVisible();
    await expect(
      comparison.getByText("Executivo: versão 3", { exact: true }),
    ).toBeVisible();
    const versionThreeTotals = {
      sale: "500,00",
      cost: "290,00",
      saleDifference: "250,00",
      costDifference: "150,00",
    };
    await expectTotals(comparison, versionThreeTotals);
    const executiveA = table
      .locator('tbody > tr[data-code="A"]')
      .getByRole("cell")
      .nth(1);
    await expect(executiveA).toContainText("4 UN");
    await expect(executiveA).toContainText("R$ 120,00");
    await expect(executiveA).toContainText("R$ 480,00");
    await expect(
      page.getByRole("checkbox", { name: /^Conferi as diferenças/ }),
    ).not.toBeChecked();
    await expect(
      page.getByLabel("Justificativa das diferenças *", { exact: true }),
    ).toHaveValue("");
    await page
      .getByRole("checkbox", { name: /^Conferi as diferenças/ })
      .check();
    await page
      .getByLabel("Justificativa das diferenças *", { exact: true })
      .fill("Revisão executiva conferida sem reajustar o contrato aprovado.");
    await page
      .getByRole("button", { name: "Aprovar revisão executiva", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Gerar pedidos por fornecedor",
        exact: true,
      }),
    ).toBeVisible();
    await expectTotals(comparison, versionThreeTotals);
    await expect(page.locator(".page-header")).toContainText("R$ 250,00");
    await page
      .getByRole("link", { name: "Ver orçamento", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`${budgetPath}$`));
    await expect(
      page.locator(".stat").filter({ hasText: "Valor de venda" }),
    ).toContainText("R$ 250,00");
    await expect(
      page.locator(".stat").filter({ hasText: "Custo dos itens" }),
    ).toContainText("R$ 140,00");
    const contractedA = page.getByRole("row").filter({
      has: page.getByRole("cell", { name: "A", exact: true }),
    });
    await expect(contractedA).toContainText("Armário A contratado");
    await expect(contractedA).toContainText("R$ 100,00");
    await expect(contractedA).toContainText("R$ 200,00");
  });
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
