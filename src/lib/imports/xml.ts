import { XMLParser, XMLValidator } from "fast-xml-parser";

export interface XmlMapping {
  projectName?: string;
  environments: string;
  environmentName: string;
  items: string;
  code: string;
  description: string;
  quantity: string;
  unit: string;
  cost: string;
  sale: string;
  numberFormat: "pt-BR" | "decimal-point";
  metadata?: Record<string, string>;
}

export interface ParsedItem {
  code: string;
  description: string;
  quantity: number;
  unit: string;
  costCents: number;
  saleCents: number;
  metadata?: Record<string, string>;
}

export interface ParsedEnvironment {
  name: string;
  items: ParsedItem[];
}

export interface ParsedProject {
  projectName?: string;
  environments: ParsedEnvironment[];
  warnings: string[];
}

export const DEFAULT_XML_MAPPING: Readonly<XmlMapping> = Object.freeze({
  projectName: "project/@name",
  environments: "project/environments/environment",
  environmentName: "@name",
  items: "items/item",
  code: "@code",
  description: "description",
  quantity: "quantity",
  unit: "unit",
  cost: "unitCost",
  sale: "unitSale",
  numberFormat: "pt-BR",
});

export const XML_IMPORT_LIMITS = Object.freeze({
  maxBytes: 2 * 1024 * 1024,
  maxEnvironments: 100,
  maxItems: 5000,
  maxDepth: 64,
  maxNodes: 100000,
  maxQuantity: 1000000,
});

export type XmlMappingPathField = Exclude<
  keyof XmlMapping,
  "numberFormat" | "metadata"
>;

export const XML_MAPPING_FIELDS: ReadonlyArray<{
  key: XmlMappingPathField;
  label: string;
  required: boolean;
  help: string;
}> = [
  {
    key: "projectName",
    label: "Nome do projeto",
    required: false,
    help: "Caminho desde a raiz do XML. Pode ficar vazio.",
  },
  {
    key: "environments",
    label: "Lista de ambientes",
    required: true,
    help: "Caminho desde a raiz até cada ambiente.",
  },
  {
    key: "environmentName",
    label: "Nome do ambiente",
    required: true,
    help: "Caminho relativo a um ambiente.",
  },
  {
    key: "items",
    label: "Lista de itens",
    required: true,
    help: "Caminho relativo a um ambiente até cada item.",
  },
  {
    key: "code",
    label: "Código",
    required: true,
    help: "Caminho relativo a um item. Zeros à esquerda são preservados.",
  },
  {
    key: "description",
    label: "Descrição",
    required: true,
    help: "Caminho relativo a um item.",
  },
  {
    key: "quantity",
    label: "Quantidade",
    required: true,
    help: "Quantidade positiva, com até 3 casas decimais.",
  },
  {
    key: "unit",
    label: "Unidade",
    required: true,
    help: "Exemplo: UN, M ou M2. Não é preenchida automaticamente.",
  },
  {
    key: "cost",
    label: "Custo unitário",
    required: true,
    help: "Valor por unidade, em moeda, com até 2 casas decimais. Não use o total da linha.",
  },
  {
    key: "sale",
    label: "Venda unitária",
    required: true,
    help: "Valor por unidade, em moeda, com até 2 casas decimais. Não use o total da linha.",
  },
];

const RESERVED_NAMES = new Set(["__proto__", "prototype", "constructor"]);
const PATH_SEGMENT = /^[A-Za-z_][A-Za-z0-9_.:-]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(code: string, message: string): never {
  throw new XmlImportError(code, message);
}

function validatePath(
  path: unknown,
  label: string,
  collection = false,
): asserts path is string {
  if (typeof path !== "string" || !path.trim() || path.length > 256) {
    fail(
      "INVALID_MAPPING",
      `Mapeamento inválido em ${label}: informe um caminho de até 256 caracteres.`,
    );
  }
  const segments = path.trim().split("/");
  if (
    segments.length > 32 ||
    segments.some((segment, index) => {
      const attribute = segment.startsWith("@");
      const name = attribute ? segment.slice(1) : segment;
      return (
        !PATH_SEGMENT.test(name) ||
        RESERVED_NAMES.has(name) ||
        (attribute && (collection || index !== segments.length - 1))
      );
    })
  ) {
    fail(
      "INVALID_MAPPING",
      `Mapeamento inválido em ${label}: use tags separadas por / e @atributo apenas no final; XPath não é suportado.`,
    );
  }
}

function validateMapping(mapping: XmlMapping): void {
  if (!isRecord(mapping))
    fail(
      "INVALID_MAPPING",
      "O mapeamento precisa ser um objeto com todos os caminhos obrigatórios.",
    );
  for (const field of XML_MAPPING_FIELDS) {
    const value = mapping[field.key];
    if (!field.required && (value === undefined || value === "")) continue;
    validatePath(
      value,
      field.label,
      field.key === "items" || field.key === "environments",
    );
  }
  if (
    mapping.numberFormat !== "pt-BR" &&
    mapping.numberFormat !== "decimal-point"
  ) {
    fail(
      "INVALID_MAPPING",
      "Escolha o formato numérico pt-BR ou decimal-point; o separador não será adivinhado.",
    );
  }
  if (mapping.metadata !== undefined) {
    if (
      !isRecord(mapping.metadata) ||
      Object.keys(mapping.metadata).length > 20
    ) {
      fail(
        "INVALID_MAPPING",
        "Metadados devem conter no máximo 20 nomes associados a caminhos XML.",
      );
    }
    for (const [key, path] of Object.entries(mapping.metadata)) {
      if (
        !/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(key) ||
        RESERVED_NAMES.has(key)
      ) {
        fail(
          "INVALID_MAPPING",
          "Nome de metadado inválido. Use letras, números, hífen ou sublinhado.",
        );
      }
      validatePath(path, `metadado ${key}`);
    }
  }
}

function allowedXmlCodePoint(code: number): boolean {
  return (
    code === 9 ||
    code === 10 ||
    code === 13 ||
    (code >= 0x20 && code <= 0xd7ff) ||
    (code >= 0xe000 && code <= 0xfffd) ||
    (code >= 0x10000 && code <= 0x10ffff)
  );
}

function validateDeclaredEncoding(xml: string): void {
  const declaration = /^\s*<\?xml\s[\s\S]*?\?>/i.exec(xml)?.[0];
  const encoding =
    declaration && /\bencoding\s*=\s*(["'])([^"']+)\1/i.exec(declaration)?.[2];
  if (encoding && !/^utf-?8$/i.test(encoding)) {
    fail(
      "UNSUPPORTED_ENCODING",
      `A codificação declarada (${encoding}) não é suportada. Exporte o XML em UTF-8; não basta trocar o nome da codificação.`,
    );
  }
}

/** Only predefined XML escapes and valid numeric references are decoded, once. */
function decodeXmlText(text: string): string {
  const predefined: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
  };
  return text.replace(/&([^;\s<&]*);?/g, (reference: string) => {
    const match = /^&(#x[0-9A-Fa-f]+|#\d+|amp|lt|gt|quot|apos);$/.exec(
      reference,
    );
    if (!match)
      fail(
        "UNSAFE_XML",
        "O XML contém entidade desconhecida ou referência incompleta. DTD e entidades personalizadas não são aceitas.",
      );
    const name = match[1];
    if (!name.startsWith("#")) return predefined[name];
    const code = name.startsWith("#x")
      ? Number.parseInt(name.slice(2), 16)
      : Number.parseInt(name.slice(1), 10);
    if (!Number.isSafeInteger(code) || !allowedXmlCodePoint(code)) {
      fail(
        "UNSAFE_XML",
        "O XML contém uma referência numérica para um caractere não permitido.",
      );
    }
    return String.fromCodePoint(code);
  });
}

/** Bound structure before handing the document to the recursive XML parser. */
function preflightXml(xml: string): string {
  if (typeof xml !== "string" || !xml.trim())
    fail("INVALID_XML", "Selecione um arquivo XML com conteúdo para importar.");
  if (new TextEncoder().encode(xml).byteLength > XML_IMPORT_LIMITS.maxBytes) {
    fail(
      "XML_TOO_LARGE",
      "O XML ultrapassa o limite de 2 MiB. Exporte um ambiente ou um arquivo menor.",
    );
  }
  for (const char of xml) {
    if (!allowedXmlCodePoint(char.codePointAt(0)!))
      fail(
        "INVALID_XML",
        "O XML contém caracteres inválidos. Exporte novamente em UTF-8.",
      );
  }
  const source = xml.replace(/^\uFEFF/, "");
  validateDeclaredEncoding(source);
  let index = 0;
  let depth = 0;
  let nodes = 0;
  let roots = 0;
  while (index < source.length) {
    if (source[index] !== "<") {
      const end = source.indexOf("<", index);
      const next = end === -1 ? source.length : end;
      const text = source.slice(index, next);
      if (depth === 0 && text.trim())
        fail("INVALID_XML", "O XML possui texto fora do elemento principal.");
      decodeXmlText(text);
      index = next;
      continue;
    }
    const special = source.startsWith("<!--", index)
      ? { start: 4, end: "-->" }
      : source.startsWith("<![CDATA[", index)
        ? { start: 9, end: "]]>" }
        : source.startsWith("<?", index)
          ? { start: 2, end: "?>" }
          : undefined;
    if (special) {
      if (special.start === 9 && depth === 0)
        fail(
          "INVALID_XML",
          "CDATA deve estar dentro do elemento principal do XML.",
        );
      const end = source.indexOf(special.end, index + special.start);
      if (end === -1)
        fail(
          "INVALID_XML",
          "O XML contém comentário, declaração ou CDATA sem fechamento.",
        );
      index = end + special.end.length;
      continue;
    }
    if (source.startsWith("<!", index)) {
      fail(
        "UNSAFE_XML",
        "DTD, DOCTYPE e declarações de entidades não são aceitos na importação XML.",
      );
    }
    let end = index + 1;
    let quote: string | undefined;
    for (; end < source.length; end++) {
      const char = source[end];
      if (quote) {
        if (char === quote) quote = undefined;
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === ">") break;
    }
    if (end === source.length)
      fail(
        "INVALID_XML",
        "O XML contém uma tag sem fechamento ou atributo sem aspas finais.",
      );
    const tag = source.slice(index, end + 1);
    const tagName = /^<\/?([A-Za-z_][A-Za-z0-9_.:-]*)/.exec(tag)?.[1];
    if (tagName && RESERVED_NAMES.has(tagName))
      fail(
        "UNSAFE_XML",
        "O XML contém um nome de tag reservado que não pode ser importado.",
      );
    if (/\s(?:__proto__|constructor|prototype)\s*=/.test(tag))
      fail(
        "UNSAFE_XML",
        "O XML contém um atributo reservado que não pode ser importado.",
      );
    decodeXmlText(tag);
    if (tag.startsWith("</")) {
      depth--;
      if (depth < 0)
        fail(
          "INVALID_XML",
          "O XML possui fechamento de tag sem abertura correspondente.",
        );
    } else {
      nodes++;
      if (nodes > XML_IMPORT_LIMITS.maxNodes)
        fail(
          "XML_TOO_MANY_NODES",
          "O XML ultrapassa o limite de 100.000 elementos. Exporte um arquivo menor.",
        );
      if (depth === 0) roots++;
      if (roots > 1)
        fail(
          "INVALID_XML",
          "O XML deve conter exatamente um elemento principal.",
        );
      if (depth + 1 > XML_IMPORT_LIMITS.maxDepth)
        fail(
          "XML_TOO_DEEP",
          "O XML ultrapassa o limite de 64 níveis de aninhamento.",
        );
      if (!/\/\s*>$/.test(tag)) depth++;
    }
    index = end + 1;
  }
  if (roots !== 1 || depth !== 0)
    fail(
      "INVALID_XML",
      "O XML está incompleto ou não possui um elemento principal válido.",
    );
  const validation = XMLValidator.validate(source, {
    allowBooleanAttributes: false,
  });
  if (validation !== true) {
    fail(
      "INVALID_XML",
      `XML inválido na linha ${validation.err.line}, coluna ${validation.err.col}. Verifique o fechamento das tags e os atributos.`,
    );
  }
  return source;
}

function selectNodes(source: unknown, path: string): unknown[] {
  let nodes: unknown[] = [source];
  for (const segment of path.trim().split("/")) {
    const selected: unknown[] = [];
    for (const node of nodes) {
      if (
        !isRecord(node) ||
        !Object.prototype.hasOwnProperty.call(node, segment)
      )
        continue;
      const value = node[segment];
      if (Array.isArray(value)) selected.push(...value);
      else selected.push(value);
    }
    nodes = selected;
  }
  return nodes;
}

function scalar(
  source: unknown,
  path: string,
  label: string,
  required = true,
  maxLength = 2000,
): string | undefined {
  const matches = selectNodes(source, path);
  if (matches.length > 1)
    fail(
      "FIELD_AMBIGUOUS",
      `${label}: o caminho ${path} encontrou mais de um valor. Ajuste o mapeamento.`,
    );
  let value = matches[0];
  let cdata = false;
  if (isRecord(value)) {
    const keys = Object.keys(value).filter((key) => !key.startsWith("@"));
    if (keys.length === 1 && (keys[0] === "#text" || keys[0] === "#cdata")) {
      cdata = keys[0] === "#cdata";
      value = value[keys[0]];
    } else
      fail(
        "FIELD_NOT_SCALAR",
        `${label}: o caminho ${path} aponta para uma estrutura, não para um valor simples.`,
      );
  }
  if (value !== undefined && typeof value !== "string")
    fail(
      "FIELD_NOT_SCALAR",
      `${label}: informe um caminho para uma tag de texto ou atributo único.`,
    );
  const text =
    typeof value === "string"
      ? (cdata ? value : decodeXmlText(value)).trim()
      : "";
  if (!text) {
    if (required)
      fail(
        "FIELD_REQUIRED",
        `${label}: campo obrigatório ausente ou vazio no caminho ${path}.`,
      );
    return undefined;
  }
  if (text.length > maxLength)
    fail(
      "FIELD_TOO_LONG",
      `${label}: o texto ultrapassa o limite de ${maxLength} caracteres.`,
    );
  return text;
}

function readNumber(
  text: string,
  format: XmlMapping["numberFormat"],
  precision: number,
  label: string,
  quantity = false,
): number {
  const integer =
    format === "pt-BR" ? "(?:\\d+|\\d{1,3}(?:\\.\\d{3})+)" : "\\d+";
  const separator = format === "pt-BR" ? "," : "\\.";
  if (
    !new RegExp(`^${integer}(?:${separator}\\d{1,${precision}})?$`).test(text)
  ) {
    fail(
      "INVALID_NUMBER",
      `${label}: use ${format}, sem símbolo de moeda, sinal ou arredondamento; até ${precision} casas decimais.`,
    );
  }
  const normalized =
    format === "pt-BR" ? text.replace(/\./g, "").replace(",", ".") : text;
  const [whole, fraction = ""] = normalized.split(".");
  const scale = 10n ** BigInt(precision);
  const scaled =
    BigInt(whole) * scale + BigInt(fraction.padEnd(precision, "0"));
  if (scaled > BigInt(Number.MAX_SAFE_INTEGER))
    fail(
      "INVALID_NUMBER",
      `${label}: o valor ultrapassa a precisão numérica segura do aplicativo.`,
    );
  const value = Number(scaled);
  if (
    quantity &&
    (value === 0 || value / Number(scale) > XML_IMPORT_LIMITS.maxQuantity)
  ) {
    fail(
      "INVALID_NUMBER",
      `${label}: a quantidade deve ser maior que zero e no máximo 1.000.000.`,
    );
  }
  return quantity ? value / Number(scale) : value;
}

export class XmlImportError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "XmlImportError";
  }
}

/** Decode uploaded bytes before parsing. Deliberately supports UTF-8 only. */
export function decodeXmlBytes(bytes: Uint8Array): string {
  if (!(bytes instanceof Uint8Array))
    fail(
      "INVALID_ENCODING",
      "O arquivo deve ser lido como bytes antes de decodificar o XML.",
    );
  if (bytes.byteLength > XML_IMPORT_LIMITS.maxBytes)
    fail(
      "XML_TOO_LARGE",
      "O XML ultrapassa o limite de 2 MiB. Exporte um ambiente ou um arquivo menor.",
    );
  const [a, b, c, d] = bytes;
  const wideEncoding =
    (a === 0xff && b === 0xfe) ||
    (a === 0xfe && b === 0xff) ||
    (a === 0 && b === 0 && c === 0xfe && d === 0xff) ||
    (a === 0x3c && b === 0 && d === 0) ||
    (a === 0 && b === 0x3c && c === 0) ||
    (a === 0 && b === 0 && c === 0 && d === 0x3c);
  if (wideEncoding)
    fail(
      "UNSUPPORTED_ENCODING",
      "XML em UTF-16 ou UTF-32 não é suportado. Exporte o arquivo em UTF-8.",
    );
  let xml: string;
  try {
    xml = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail(
      "INVALID_ENCODING",
      "O arquivo não contém UTF-8 válido. Exporte em UTF-8; Windows-1252 e ISO-8859-1 não são convertidos automaticamente.",
    );
  }
  validateDeclaredEncoding(xml);
  return xml;
}

export function parseProjectXml(
  xml: string,
  mapping: XmlMapping = DEFAULT_XML_MAPPING,
): ParsedProject {
  validateMapping(mapping);
  const source = preflightXml(xml);
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@",
    parseTagValue: false,
    parseAttributeValue: false,
    processEntities: false,
    trimValues: false,
    cdataPropName: "#cdata",
    ignoreDeclaration: true,
    ignorePiTags: true,
    removeNSPrefix: false,
  });
  let document: unknown;
  try {
    document = parser.parse(source);
  } catch {
    fail(
      "INVALID_XML",
      "Não foi possível ler o XML. Confira a estrutura e exporte novamente o arquivo.",
    );
  }
  const environmentNodes = selectNodes(document, mapping.environments);
  if (!environmentNodes.length)
    fail(
      "ENVIRONMENTS_NOT_FOUND",
      `Nenhum ambiente encontrado em ${mapping.environments}. Configure o layout conforme o XML real.`,
    );
  if (environmentNodes.length > XML_IMPORT_LIMITS.maxEnvironments)
    fail(
      "TOO_MANY_ENVIRONMENTS",
      "O XML contém mais de 100 ambientes. Divida a exportação em arquivos menores.",
    );
  const itemLists = environmentNodes.map((node) =>
    selectNodes(node, mapping.items),
  );
  if (
    itemLists.reduce((total, items) => total + items.length, 0) >
    XML_IMPORT_LIMITS.maxItems
  ) {
    fail(
      "TOO_MANY_ITEMS",
      "O XML contém mais de 5.000 itens. Divida a exportação antes de importar.",
    );
  }
  const warnings: string[] = [];
  if (
    XML_MAPPING_FIELDS.every(
      ({ key }) => mapping[key] === DEFAULT_XML_MAPPING[key],
    ) &&
    mapping.numberFormat === "pt-BR"
  ) {
    warnings.push(
      "O layout padrão é um exemplo sintético. Valide o mapeamento com um XML real antes de confirmar.",
    );
  }
  if (environmentNodes.length > 1)
    warnings.push(
      "O arquivo contém vários ambientes. Selecione somente um ambiente de origem e um destino para cada importação.",
    );
  const seenNames = new Set<string>();
  const environments = environmentNodes.map(
    (node, environmentIndex): ParsedEnvironment => {
      const name = scalar(
        node,
        mapping.environmentName,
        `Ambiente ${environmentIndex + 1}, nome`,
        true,
        200,
      )!;
      if (seenNames.has(name))
        warnings.push(
          `O nome de ambiente ${name} está repetido. Confira a posição na lista antes de selecionar.`,
        );
      seenNames.add(name);
      if (!itemLists[environmentIndex].length)
        fail(
          "ITEMS_NOT_FOUND",
          `Ambiente ${name}: nenhum item encontrado em ${mapping.items}.`,
        );
      const codes = new Set<string>();
      const duplicateCodes = new Set<string>();
      const items = itemLists[environmentIndex].map(
        (itemNode, itemIndex): ParsedItem => {
          const context = `Ambiente ${name}, item ${itemIndex + 1}`;
          const code = scalar(
            itemNode,
            mapping.code,
            `${context}, código`,
            true,
            128,
          )!;
          if (codes.has(code)) duplicateCodes.add(code);
          codes.add(code);
          const item: ParsedItem = {
            code,
            description: scalar(
              itemNode,
              mapping.description,
              `${context}, descrição`,
            )!,
            quantity: readNumber(
              scalar(
                itemNode,
                mapping.quantity,
                `${context}, quantidade`,
                true,
                64,
              )!,
              mapping.numberFormat,
              3,
              `${context}, quantidade`,
              true,
            ),
            unit: scalar(
              itemNode,
              mapping.unit,
              `${context}, unidade`,
              true,
              20,
            )!,
            costCents: readNumber(
              scalar(
                itemNode,
                mapping.cost,
                `${context}, custo unitário`,
                true,
                64,
              )!,
              mapping.numberFormat,
              2,
              `${context}, custo unitário`,
            ),
            saleCents: readNumber(
              scalar(
                itemNode,
                mapping.sale,
                `${context}, venda unitária`,
                true,
                64,
              )!,
              mapping.numberFormat,
              2,
              `${context}, venda unitária`,
            ),
          };
          if (mapping.metadata) {
            const metadata: Record<string, string> = {};
            for (const [key, path] of Object.entries(mapping.metadata)) {
              const value = scalar(itemNode, path, `${context}, ${key}`, false);
              if (value !== undefined) metadata[key] = value;
            }
            if (Object.keys(metadata).length) item.metadata = metadata;
          }
          return item;
        },
      );
      if (duplicateCodes.size)
        warnings.push(
          `Ambiente ${name}: ${duplicateCodes.size} código(s) repetido(s). As linhas foram mantidas separadas; confira máscaras e medidas.`,
        );
      return { name, items };
    },
  );
  const projectName = mapping.projectName
    ? scalar(document, mapping.projectName, "Nome do projeto", false, 200)
    : undefined;
  return { ...(projectName ? { projectName } : {}), environments, warnings };
}
