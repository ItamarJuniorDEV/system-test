import { test, expect } from "@playwright/test";
import path from "node:path";

test("percorre XML, orçamento, contrato, compra, entrega, montagem, assistência e financeiro", async ({
  page,
}) => {
  const suffix = Date.now().toString();
  const customerName = `Cliente fluxo ${suffix}`;
  const projectName = `Projeto fluxo ${suffix}`;
  page.on("dialog", (dialog) => dialog.accept());
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  let projectId = "";
  let contractId = "";

  await test.step("cliente, projeto e ambiente XML com total exato", async () => {
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
    projectId = page.url().split("/").at(-1)!;
    await page.getByLabel("Nome do ambiente *").fill("Cozinha do fluxo");
    await page
      .getByLabel("Fornecedor *", { exact: true })
      .selectOption({ index: 1 });
    await page
      .getByRole("button", { name: "Criar ambiente", exact: true })
      .click();
    await expect(page).toHaveURL(/\/ambientes\/[\da-f-]+$/);
    await page
      .locator('input[type="file"]')
      .setInputFiles(path.resolve("examples/projeto-sintetico.xml"));
    await page
      .getByRole("button", {
        name: "Gerar prévia com este layout",
        exact: true,
      })
      .click();
    await page.getByLabel("Ambiente de origem no XML").selectOption("0");
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", {
        name: "Confirmar importação neste ambiente",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("heading", { name: "Itens da versão 1", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("R$ 5.864,18", { exact: true }).first(),
    ).toBeVisible();
    await page.goto(`/projetos/${projectId}`);
    await page
      .getByRole("button", { name: "Gerar e conferir orçamento" })
      .click();
    await expect(page).toHaveURL(/\/orcamentos\/[\da-f-]+$/);
    await expect(
      page.getByText("R$ 5.864,18", { exact: true }).first(),
    ).toBeVisible();
  });

  await test.step("contrato e três aprovações antes de revisar e comprar", async () => {
    await page
      .getByRole("button", { name: "Criar contrato deste orçamento" })
      .click();
    await expect(page).toHaveURL(/\/contratos\/[\da-f-]+$/);
    contractId = page.url().split("/").at(-1)!;
    await expect(
      page.getByRole("button", { name: "Iniciar revisão", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Registrar assinatura", exact: true })
      .click();
    const commercial = page.locator(".approval-card").filter({
      has: page.getByRole("heading", {
        name: "Liberação comercial",
        exact: true,
      }),
    });
    await commercial
      .getByRole("button", { name: "Aprovar", exact: true })
      .click();
    const financial = page.locator(".approval-card").filter({
      has: page.getByRole("heading", {
        name: "Liberação financeira",
        exact: true,
      }),
    });
    await financial
      .getByRole("button", { name: "Aprovar", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Iniciar revisão", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Aprovar revisão executiva", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Gerar pedidos por fornecedor",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(/\/compras\/[\da-f-]+$/);
    await expect(
      page.getByText("R$ 3.086,40", { exact: true }).first(),
    ).toBeVisible();
  });

  await test.step("recebimento parcial, reserva, entrega e montagem", async () => {
    await page
      .getByRole("button", { name: "Marcar como enviado", exact: true })
      .click();
    await page.getByLabel("Quantidade a receber de 0001").fill("1");
    await page
      .getByRole("button", { name: "Confirmar recebimento", exact: true })
      .click();
    await expect(
      page.getByText("Recebimento parcial", { exact: true }).first(),
    ).toBeVisible();
    await page.getByLabel("Quantidade a receber de 0001").fill("1.5");
    await page
      .getByRole("button", { name: "Confirmar recebimento", exact: true })
      .click();
    await expect(page.getByLabel("Quantidade a receber de 0001")).toHaveCount(
      0,
    );
    await page.goto(`/estoque?contrato=${contractId}`);
    await page.getByLabel("Quantidade a reservar de 0001").fill("2.5");
    await page
      .getByRole("button", { name: "Confirmar reserva", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("sucesso");
    for (const [kind, start, end, complete] of [
      ["delivery", "2026-11-02T08:00", "2026-11-02T09:00", "Confirmar entrega"],
      ["assembly", "2026-11-02T10:00", "2026-11-02T12:00", "Concluir montagem"],
    ]) {
      await page.goto(`/agenda?contrato=${contractId}`);
      await page.getByLabel("Tipo de compromisso").selectOption(kind);
      await page.getByLabel("Data e hora de início").fill(start);
      await page.getByLabel("Data e hora de término").fill(end);
      await page
        .getByRole("button", { name: "Agendar compromisso", exact: true })
        .click();
      await expect(page.getByRole("status")).toContainText("sucesso");
      const row = page
        .locator("tbody tr")
        .filter({ hasText: customerName })
        .filter({ hasText: kind === "delivery" ? "Entrega" : "Montagem" });
      await row.getByRole("link", { name: "Abrir →", exact: true }).click();
      await page.getByRole("button", { name: complete, exact: true }).click();
      await expect(page.getByText(/Compromisso concluído em/)).toBeVisible();
    }
    await page.goto(`/contratos/${contractId}`);
    await expect(
      page.locator(".page-actions").getByText("Concluído", { exact: true }),
    ).toBeVisible();
  });

  await test.step("assistência sem pedido de peças e solução registrada", async () => {
    await page.goto(`/assistencia?contrato=${contractId}`);
    await page.getByLabel("Assunto da assistência").fill("Ajuste de dobradiça");
    await page
      .getByRole("button", { name: "Abrir assistência", exact: true })
      .click();
    await expect(page).toHaveURL(/\/assistencia\/[\da-f-]+$/);
    await page
      .getByLabel("Descrição do problema")
      .fill("Porta precisa de regulagem após montagem");
    await page
      .getByLabel("Quem será responsável pelo custo?")
      .selectOption("store");
    await page
      .getByRole("button", { name: "Adicionar ocorrência", exact: true })
      .click();
    await page
      .getByText("Registrar solução desta ocorrência", { exact: true })
      .click();
    await page
      .getByLabel("Solução realizada")
      .fill("Dobradiça regulada e conferida com o cliente");
    await page
      .getByRole("button", {
        name: "Marcar ocorrência como resolvida",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Encerrar assistência", exact: true })
      .click();
    await expect(page.getByText(/Atendimento encerrado em/)).toBeVisible();
  });

  await test.step("título, baixa parcial e estorno preservando o original", async () => {
    await page.goto("/financeiro");
    await page.getByLabel("Tipo de título").selectOption("receivable");
    await page
      .getByLabel("Cliente", { exact: true })
      .selectOption({ label: customerName });
    await page
      .getByLabel("Descrição", { exact: true })
      .fill(`Serviço avulso ${suffix}`);
    await page.getByLabel("Valor (R$)", { exact: false }).fill("100,00");
    await page
      .getByRole("button", { name: "Criar título", exact: true })
      .click();
    await expect(page).toHaveURL(/\/financeiro\/[\da-f-]+$/);
    await page
      .getByLabel("Valor da baixa (R$)", { exact: false })
      .fill("40,00");
    await page
      .getByRole("button", { name: "Confirmar recebimento", exact: true })
      .click();
    const balance = page
      .locator(".stat")
      .filter({ hasText: "Saldo do título" });
    await expect(balance).toContainText("R$ 60,00");
    await page
      .getByText("Estornar esta baixa de R$ 40,00", { exact: true })
      .click();
    await page
      .getByLabel("Motivo do estorno")
      .fill("Registro duplicado conferido no extrato");
    await page
      .getByRole("button", { name: "Confirmar estorno", exact: true })
      .click();
    await expect(balance).toContainText("R$ 100,00");
    await expect(page.getByText("Estornada", { exact: true })).toBeVisible();
    await expect(
      page.locator(".stat").filter({ hasText: "Valor original" }),
    ).toContainText("R$ 100,00");
  });
  expect(pageErrors).toEqual([]);
});

test("navegação no celular mantém conteúdo e menu acessíveis", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Visão geral", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  await page
    .getByRole("link", { name: "Mapa de processos", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Mapa de processos", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
