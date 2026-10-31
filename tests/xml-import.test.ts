import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_XML_MAPPING,
  decodeXmlBytes,
  parseProjectXml,
  XML_IMPORT_LIMITS,
  XmlImportError,
  type XmlMapping,
} from "../src/lib/imports/xml";
import { computeXmlSha256 } from "../src/lib/imports/xml.server";

const fixture = readFileSync(
  new URL("../examples/projeto-sintetico.xml", import.meta.url),
  "utf8",
);
const alternative = readFileSync(
  new URL("../examples/projeto-mapeamento-alternativo.xml", import.meta.url),
  "utf8",
);
const alternativeMapping = JSON.parse(
  readFileSync(
    new URL("../examples/mapeamento-alternativo.json", import.meta.url),
    "utf8",
  ),
) as XmlMapping;

function item(
  overrides: {
    code?: string;
    quantity?: string;
    cost?: string;
    sale?: string;
    description?: string;
  } = {},
) {
  return `<item code="${overrides.code ?? "001"}"><description>${overrides.description ?? "Armário"}</description><quantity>${overrides.quantity ?? "1"}</quantity><unit>UN</unit><unitCost>${overrides.cost ?? "12,30"}</unitCost><unitSale>${overrides.sale ?? "24,60"}</unitSale></item>`;
}

function project(items = item()) {
  return `<project name="Exemplo"><environments><environment name="Cozinha"><items>${items}</items></environment></environments></project>`;
}

function expectImportError(action: () => unknown, code: string) {
  try {
    action();
    expect.fail("A entrada inválida deveria ser rejeitada");
  } catch (error) {
    expect(error).toBeInstanceOf(XmlImportError);
    expect((error as XmlImportError).code).toBe(code);
    expect((error as Error).message.length).toBeGreaterThan(15);
  }
}

describe("importação determinística de XML com mapeamento explícito", () => {
  it("preserva ambientes separados, código com zeros e preços unitários em centavos", () => {
    const result = parseProjectXml(fixture);
    expect(result.projectName).toBe("Apartamento exemplo sintético");
    expect(result.environments).toEqual([
      {
        name: "Cozinha",
        items: [
          {
            code: "0001",
            description: "Armário & bancada",
            quantity: 2.5,
            unit: "UN",
            costCents: 123456,
            saleCents: 234567,
          },
        ],
      },
      {
        name: "Dormitório",
        items: [
          {
            code: "0002",
            description: "Prateleira",
            quantity: 1,
            unit: "UN",
            costCents: 1000,
            saleCents: 2000,
          },
        ],
      },
    ]);
    expect(
      result.warnings.some((warning) => /selecione|selecionar/i.test(warning)),
    ).toBe(true);
  });

  it("interpreta outro layout somente pelo mapeamento fornecido", () => {
    expect(
      parseProjectXml(alternative, alternativeMapping).environments,
    ).toEqual([
      {
        name: "Escritório",
        items: [
          {
            code: "0009",
            description: "Tampo",
            quantity: 1.125,
            unit: "M2",
            costCents: 120,
            saleCents: 250,
            metadata: { supplier: "Fornecedor de exemplo", height: "18" },
          },
        ],
      },
    ]);
    expectImportError(
      () => parseProjectXml(alternative),
      "ENVIRONMENTS_NOT_FOUND",
    );
  });

  it("aceita valores zero explícitos sem inventar preços ausentes", () => {
    const parsed = parseProjectXml(project(item({ cost: "0", sale: "0,00" })));
    expect(parsed.environments[0].items[0]).toMatchObject({
      costCents: 0,
      saleCents: 0,
    });
    expectImportError(
      () =>
        parseProjectXml(project().replace("<unitCost>12,30</unitCost>", "")),
      "FIELD_REQUIRED",
    );
  });

  it("não confunde campo ausente com texto vazio ou conteúdo estrutural", () => {
    expectImportError(
      () =>
        parseProjectXml(
          project().replace(
            "<description>Armário</description>",
            "<description/>",
          ),
        ),
      "FIELD_REQUIRED",
    );
    expectImportError(
      () =>
        parseProjectXml(
          project().replace(
            "<description>Armário</description>",
            "<description><nested>Armário</nested></description>",
          ),
        ),
      "FIELD_NOT_SCALAR",
    );
  });

  it("rejeita dois valores candidatos para o mesmo campo em vez de escolher o primeiro", () => {
    expectImportError(
      () =>
        parseProjectXml(
          project().replace(
            "<quantity>1</quantity>",
            "<quantity>1</quantity><quantity>2</quantity>",
          ),
        ),
      "FIELD_AMBIGUOUS",
    );
  });

  it("mantém linhas de mesmo código sem somar ou sobrescrever silenciosamente", () => {
    const parsed = parseProjectXml(project(item() + item({ quantity: "2" })));
    expect(parsed.environments[0].items.map((row) => row.quantity)).toEqual([
      1, 2,
    ]);
    expect(parsed.warnings.some((warning) => /repetid/i.test(warning))).toBe(
      true,
    );
  });

  it("permite omitir o nome opcional do projeto pelo mapeamento", () => {
    expect(
      parseProjectXml(project(), {
        ...DEFAULT_XML_MAPPING,
        projectName: undefined,
      }).projectName,
    ).toBeUndefined();
  });

  it("informa onde o campo obrigatório faltou", () => {
    expect(() => parseProjectXml(project().replace('code="001"', ""))).toThrow(
      /Cozinha.*item 1.*código/i,
    );
  });

  it.each([
    "1.23",
    "1,234.56",
    "R$ 1,00",
    "1e3",
    "NaN",
    "Infinity",
    "-1",
    "+1",
    "1,001",
    "90071992547409,92",
  ])("rejeita valor monetário brasileiro inválido ou inexato: %s", (cost) =>
    expectImportError(
      () => parseProjectXml(project(item({ cost }))),
      "INVALID_NUMBER",
    ),
  );

  it.each(["0", "-1", "1,0001", "1000001"])(
    "rejeita quantidade fora da precisão ou faixa: %s",
    (quantity) =>
      expectImportError(
        () => parseProjectXml(project(item({ quantity }))),
        "INVALID_NUMBER",
      ),
  );

  it("não adivinha separador quando o formato decimal-point foi escolhido", () => {
    expectImportError(
      () =>
        parseProjectXml(project(), {
          ...DEFAULT_XML_MAPPING,
          numberFormat: "decimal-point",
        }),
      "INVALID_NUMBER",
    );
  });

  it("rejeita ambiente sem itens", () => {
    expectImportError(() => parseProjectXml(project("")), "ITEMS_NOT_FOUND");
  });

  it("rejeita mais de 5000 itens antes de produzir uma prévia parcial", () => {
    expectImportError(
      () => parseProjectXml(project(item().repeat(5001))),
      "TOO_MANY_ITEMS",
    );
  });

  it("rejeita ambientes em excesso", () => {
    const xml = `<project><environments>${`<environment name="Cozinha"><items>${item()}</items></environment>`.repeat(101)}</environments></project>`;
    expectImportError(() => parseProjectXml(xml), "TOO_MANY_ENVIRONMENTS");
  });
});

describe("fronteira de segurança do XML", () => {
  it.each([
    '<!DOCTYPE project [<!ENTITY boom "conteúdo">]><project>&boom;</project>',
    '<!DOCTYPE project SYSTEM "file:///etc/passwd"><project/>',
    '<!ENTITY external SYSTEM "https://example.invalid/private"><project/>',
  ])("rejeita DTD e declaração de entidade antes do parsing", (xml) => {
    expectImportError(() => parseProjectXml(xml), "UNSAFE_XML");
  });

  it("rejeita referências a entidades não predefinidas", () => {
    expectImportError(
      () => parseProjectXml(project(item({ description: "&naoDeclarada;" }))),
      "UNSAFE_XML",
    );
  });

  it("decodifica entidades XML simples sem tratar CDATA como marcação", () => {
    const decoded = parseProjectXml(
      project(item({ description: "A &amp; B &#231; &#xE3;" })),
    );
    expect(decoded.environments[0].items[0].description).toBe("A & B ç ã");
    const cdata = parseProjectXml(
      project(item({ description: "<![CDATA[A &amp; <peça>]]>" })),
    );
    expect(cdata.environments[0].items[0].description).toBe("A &amp; <peça>");
  });

  it.each([
    "<project>",
    "<project/><project/>",
    "texto<project/>",
    "<project a='1' a='2'/>",
  ])("rejeita documento malformado: %s", (xml) =>
    expectImportError(() => parseProjectXml(xml), "INVALID_XML"),
  );

  it("rejeita documento maior que o limite em bytes UTF-8", () => {
    expectImportError(
      () => parseProjectXml("á".repeat(XML_IMPORT_LIMITS.maxBytes / 2 + 1)),
      "XML_TOO_LARGE",
    );
  });

  it("rejeita aninhamento excessivo antes do parser recursivo", () => {
    expectImportError(
      () => parseProjectXml("<node>".repeat(65) + "</node>".repeat(65)),
      "XML_TOO_DEEP",
    );
  });

  it("rejeita quantidade excessiva de nós mesmo fora do caminho mapeado", () => {
    expectImportError(
      () => parseProjectXml(`<project>${"<x/>".repeat(100001)}</project>`),
      "XML_TOO_MANY_NODES",
    );
  });

  it("recusa tags que possam interferir no protótipo de objetos", () => {
    expectImportError(
      () =>
        parseProjectXml(
          "<project><__proto__><polluted>true</polluted></__proto__></project>",
        ),
      "UNSAFE_XML",
    );
  });

  it("rejeita caracteres proibidos no XML", () => {
    expectImportError(
      () => parseProjectXml(project(item({ description: "in\u0000válido" }))),
      "INVALID_XML",
    );
    expectImportError(
      () => parseProjectXml(project(item({ description: "&#0;" }))),
      "UNSAFE_XML",
    );
  });

  it("aceita BOM UTF-8 sem alterar campos", () => {
    expect(
      parseProjectXml("\uFEFF" + project()).environments[0].items[0].code,
    ).toBe("001");
  });

  it.each([
    "../item",
    "items//item",
    "items/*",
    "__proto__/item",
    "constructor/item",
    "items/@id/item",
  ])("recusa caminhos ambíguos ou perigosos: %s", (items) =>
    expectImportError(
      () => parseProjectXml(project(), { ...DEFAULT_XML_MAPPING, items }),
      "INVALID_MAPPING",
    ),
  );

  it("recusa mapeamento incompleto vindo de JSON não tipado", () => {
    expectImportError(
      () =>
        parseProjectXml(project(), { environments: "project" } as XmlMapping),
      "INVALID_MAPPING",
    );
  });
});

describe("identidade de importação calculada no servidor", () => {
  it("calcula SHA-256 de bytes UTF-8 sem normalizar silenciosamente o conteúdo", () => {
    expect(computeXmlSha256("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(computeXmlSha256(project())).not.toBe(
      computeXmlSha256(project() + "\n"),
    );
  });
});

describe("decodificação explícita do arquivo enviado", () => {
  it("preserva acentos UTF-8 e remove somente o BOM inicial", () => {
    expect(decodeXmlBytes(new TextEncoder().encode(fixture))).toBe(fixture);
    expect(decodeXmlBytes(new TextEncoder().encode("\uFEFF" + fixture))).toBe(
      fixture,
    );
  });

  it("não substitui bytes inválidos por caracteres silenciosamente", () => {
    expectImportError(
      () => decodeXmlBytes(new Uint8Array([0x3c, 0x61, 0x3e, 0xc3, 0x28])),
      "INVALID_ENCODING",
    );
  });

  it.each([
    { bytes: [0xff, 0xfe, 0x3c, 0] },
    { bytes: [0xfe, 0xff, 0, 0x3c] },
    { bytes: [0, 0, 0xfe, 0xff] },
    { bytes: [0x3c, 0, 0x3f, 0] },
  ])("recusa UTF-16/32 em vez de decodificar como UTF-8", ({ bytes }) => {
    expectImportError(
      () => decodeXmlBytes(new Uint8Array(bytes)),
      "UNSUPPORTED_ENCODING",
    );
  });

  it.each(["ISO-8859-1", "windows-1252", "UTF-16"])(
    "recusa declaração %s mesmo quando a amostra contém só ASCII",
    (encoding) => {
      const xml = `<?xml version="1.0" encoding="${encoding}"?>` + project();
      expectImportError(
        () => decodeXmlBytes(new TextEncoder().encode(xml)),
        "UNSUPPORTED_ENCODING",
      );
      expectImportError(() => parseProjectXml(xml), "UNSUPPORTED_ENCODING");
    },
  );

  it("valida o limite antes de decodificar o arquivo inteiro", () => {
    expectImportError(
      () => decodeXmlBytes(new Uint8Array(XML_IMPORT_LIMITS.maxBytes + 1)),
      "XML_TOO_LARGE",
    );
  });
});
