import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";

const syntheticXml = fileURLToPath(
  new URL("../../examples/projeto-sintetico.xml", import.meta.url),
);
const seededProjectName = "Apartamento Jardim · demonstração";

test("importa um ambiente, preserva versões e bloqueia prévia desatualizada ou XML inseguro", async ({
  page,
}) => {
  await page.goto("/projetos");
  const projectRow = page
    .getByRole("row")
    .filter({ hasText: seededProjectName });
  await expect(projectRow).toHaveCount(1);
  await projectRow
    .getByRole("link", { name: "Abrir projeto", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: seededProjectName,
      exact: true,
    }),
  ).toBeVisible();

  const environmentsSection = page.locator("section").filter({
    has: page.getByRole("heading", {
      level: 2,
      name: "Ambientes do projeto",
      exact: true,
    }),
  });
  const firstEnvironment = environmentsSection
    .locator("article.environment-card")
    .first();
  const destinationName = (
    await firstEnvironment.getByRole("heading", { level: 3 }).innerText()
  ).trim();
  const destinationLink = firstEnvironment.getByRole("link", {
    name: "Abrir ambiente",
    exact: true,
  });
  const destinationPath = await destinationLink.getAttribute("href");
  expect(destinationPath).toBeTruthy();
  await destinationLink.click();
  await expect(
    page.getByRole("heading", { level: 1, name: destinationName, exact: true }),
  ).toBeVisible();

  const importer = page.locator("section").filter({
    has: page.getByRole("heading", {
      level: 2,
      name: "Importar projeto por XML",
      exact: true,
    }),
  });
  const history = page.locator("section").filter({
    has: page.getByRole("heading", {
      level: 2,
      name: "Histórico de versões",
      exact: true,
    }),
  });
  const versionHeadings = history.getByRole("heading", {
    level: 3,
    name: /^Versão /,
  });
  const fileInput = importer.getByLabel(
    "Escolha ou arraste um XML de projeto",
    { exact: true },
  );
  const previewButton = importer.getByRole("button", {
    name: "Gerar prévia com este layout",
    exact: true,
  });
  const confirmButton = importer.getByRole("button", {
    name: "Confirmar importação neste ambiente",
    exact: true,
  });
  const source = importer.getByRole("combobox", {
    name: /^Ambiente de origem no XML/,
  });
  const sourceTable = importer.getByRole("table", {
    name: "Itens do ambiente de origem: Dormitório",
    exact: true,
  });
  const confirmation = importer.getByRole("checkbox", {
    name: /^Confirmo a importação de Dormitório para /,
  });

  // The fixed fixture also permits a rerun against this same demo process:
  // the first run creates version 2, subsequent runs exercise its fingerprint.
  await expect(
    history.getByRole("heading", {
      level: 3,
      name: /^Versão 1 · seed-sintetico\.xml$/,
    }),
  ).toBeVisible();
  expect([1, 2]).toContain(await versionHeadings.count());

  await test.step("seleciona uma origem e confirma explicitamente o mesmo destino", async () => {
    await fileInput.setInputFiles(syntheticXml);
    await previewButton.click();
    await expect(source).toHaveValue("");
    await expect(confirmButton).toBeDisabled();
    await expect(
      source.getByRole("option", {
        name: "2. Dormitório — 1 item(ns)",
        exact: true,
      }),
    ).toHaveCount(1);
    await source.selectOption("1");

    await expect(sourceTable.locator("tbody tr")).toHaveCount(1);
    await expect(
      sourceTable.getByRole("cell", { name: "0002", exact: true }),
    ).toBeVisible();
    await expect(
      sourceTable.getByRole("cell", { name: "0001", exact: true }),
    ).toHaveCount(0);
    const itemCells = sourceTable.locator("tbody tr").first().getByRole("cell");
    await expect(itemCells.nth(1)).toHaveText("Prateleira");
    await expect(itemCells.nth(2)).toHaveText("1");
    await expect(itemCells.nth(4)).toHaveText(/R\$\s*10,00/);
    await expect(itemCells.nth(5)).toHaveText(/R\$\s*20,00/);
    await expect(itemCells.nth(6)).toHaveText(/R\$\s*10,00/);
    await expect(itemCells.nth(7)).toHaveText(/R\$\s*20,00/);
    await expect(confirmation).toHaveAccessibleName(
      new RegExp(
        `^Confirmo a importação de Dormitório para ${destinationName}\\.`,
      ),
    );
    await expect(confirmButton).toBeDisabled();

    await confirmation.check();
    await confirmButton.click();
    await expect(importer.getByRole("status")).toContainText(
      /Importação registrada|já estava registrada/,
    );
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: "Itens da versão 2",
        exact: true,
      }),
    ).toBeVisible();
    await expect(versionHeadings).toHaveCount(2);
    await expect(
      history.getByRole("heading", {
        level: 3,
        name: "Versão 2 · projeto-sintetico.xml",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: destinationName,
        exact: true,
      }),
    ).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(destinationPath);

    const persistedItems = page.locator("section").filter({
      has: page.getByRole("heading", {
        level: 2,
        name: "Itens da versão 2",
        exact: true,
      }),
    });
    await expect(
      persistedItems.getByRole("cell", { name: "0002", exact: true }),
    ).toBeVisible();
    await expect(
      persistedItems.getByRole("cell", { name: "0001", exact: true }),
    ).toHaveCount(0);
    await expect(
      persistedItems.getByRole("cell", { name: "Prateleira", exact: true }),
    ).toBeVisible();
  });

  await test.step("reimporta o mesmo XML e seleção sem criar a versão 3", async () => {
    await fileInput.setInputFiles(syntheticXml);
    await previewButton.click();
    await source.selectOption("1");
    await confirmation.check();
    await confirmButton.click();
    await expect(importer.getByRole("status")).toContainText(
      /Importação registrada|já estava registrada/,
    );

    // Reload verifies the persisted history, rather than only the local preview.
    await page.reload();
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: "Itens da versão 2",
        exact: true,
      }),
    ).toBeVisible();
    await expect(versionHeadings).toHaveCount(2);
    await expect(
      history.getByRole("heading", { level: 3, name: /^Versão 3 ·/ }),
    ).toHaveCount(0);
  });

  await test.step("mudar e restaurar o mapeamento ainda exige gerar uma nova prévia", async () => {
    await fileInput.setInputFiles(syntheticXml);
    await previewButton.click();
    await source.selectOption("1");
    await confirmation.check();
    await expect(confirmButton).toBeEnabled();

    await importer
      .getByText("Revisar mapeamento do XML", { exact: true })
      .click();
    const costPath = importer.getByRole("textbox", { name: /^Custo unitário/ });
    await costPath.fill("changedUnitCost");
    await expect(source).toHaveCount(0);
    await expect(sourceTable).toHaveCount(0);
    await expect(confirmButton).toBeDisabled();
    await costPath.fill("unitCost");
    await expect(source).toHaveCount(0);
    await expect(confirmButton).toBeDisabled();

    await previewButton.click();
    await expect(source).toHaveValue("");
    await expect(confirmButton).toBeDisabled();
    await source.selectOption("1");
    await expect(confirmation).not.toBeChecked();
    await confirmation.check();
    await expect(confirmButton).toBeEnabled();
    await expect(versionHeadings).toHaveCount(2);
  });

  await test.step("substituir o arquivo invalida a prévia e DTD não grava versão", async () => {
    await fileInput.setInputFiles({
      name: "entidades.xml",
      mimeType: "application/xml",
      buffer: Buffer.from(
        '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE project [<!ENTITY example "Não importar">]><project name="&example;"/>',
        "utf8",
      ),
    });
    await expect(confirmButton).toBeDisabled();
    await expect(source).toHaveCount(0);
    await previewButton.click();
    await expect(importer.getByRole("alert")).toContainText(
      "DTD, DOCTYPE e declarações de entidades não são aceitos",
    );
    await expect(confirmButton).toBeDisabled();
    await expect(sourceTable).toHaveCount(0);

    await page.reload();
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: "Itens da versão 2",
        exact: true,
      }),
    ).toBeVisible();
    await expect(versionHeadings).toHaveCount(2);
    await expect(
      history.getByRole("heading", { level: 3, name: /^Versão 3 ·/ }),
    ).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe(destinationPath);
  });
});
