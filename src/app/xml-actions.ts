"use server";

import type { ActionResult } from "./actions";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireViewer } from "@/lib/server/auth";
import { persistVerifiedXml } from "@/lib/server/data";
import {
  decodeXmlBytes,
  parseProjectXml,
  XML_IMPORT_LIMITS,
  type XmlMapping,
} from "@/lib/imports/xml";
import { computeXmlSha256 } from "@/lib/imports/xml.server";

const path = z
  .string()
  .trim()
  .min(1, "Preencha os caminhos obrigatórios do mapeamento.")
  .max(256, "Um caminho do mapeamento ultrapassa 256 caracteres.");
const mappingSchema = z
  .object({
    projectName: z.string().trim().max(256).optional(),
    environments: path,
    environmentName: path,
    items: path,
    code: path,
    description: path,
    quantity: path,
    unit: path,
    cost: path,
    sale: path,
    numberFormat: z.enum(["pt-BR", "decimal-point"], {
      error: "Selecione o formato numérico do arquivo.",
    }),
    metadata: z
      .record(z.string().max(64), path)
      .refine(
        (value) => Object.keys(value).length <= 20,
        "Use no máximo 20 metadados.",
      )
      .optional(),
  })
  .strict();

function singleText(form: FormData, key: string): string {
  const values = form.getAll(key);
  if (values.length !== 1 || typeof values[0] !== "string")
    throw new Error(
      "Revise a seleção de origem, destino e mapeamento antes de confirmar.",
    );
  return values[0];
}

export async function importXmlVersion(form: FormData): Promise<ActionResult> {
  const viewer = await requireViewer();
  try {
    if (
      !viewer.active ||
      !["admin", "commercial", "operations"].includes(viewer.role)
    ) {
      throw new Error(
        "Seu perfil não tem permissão para importar versões de ambientes.",
      );
    }
    const environmentId = z
      .uuid("Selecione um ambiente de destino válido.")
      .parse(singleText(form, "environmentId"));
    const sourceIndexText = singleText(form, "sourceIndex");
    if (!/^(?:0|[1-9]\d?)$/.test(sourceIndexText))
      throw new Error(
        "Selecione explicitamente um ambiente de origem da prévia.",
      );
    const sourceEnvironmentIndex = Number(sourceIndexText);
    if (singleText(form, "confirmDestination") !== "on")
      throw new Error("Confirme o ambiente de destino antes de importar.");

    const mappingText = singleText(form, "mapping");
    if (mappingText.length > 16384)
      throw new Error("O mapeamento ultrapassa o tamanho permitido.");
    let mappingInput: unknown;
    try {
      mappingInput = JSON.parse(mappingText);
    } catch {
      throw new Error(
        "O mapeamento não contém JSON válido. Revise os campos e gere uma nova prévia.",
      );
    }
    const mapping: XmlMapping = mappingSchema.parse(mappingInput);

    const files = form.getAll("file");
    const file = files[0];
    if (files.length !== 1 || !(file instanceof File))
      throw new Error("Selecione somente um arquivo XML para importar.");
    const fileName = file.name.trim();
    if (
      !fileName ||
      fileName.length > 255 ||
      !/\.xml$/i.test(fileName) ||
      fileName.includes("/") ||
      fileName.includes("\\") ||
      Array.from(fileName).some(
        (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
      )
    ) {
      throw new Error(
        "Use um nome de arquivo .xml de até 255 caracteres, sem caminhos ou caracteres de controle.",
      );
    }
    if (file.size === 0 || file.size > XML_IMPORT_LIMITS.maxBytes)
      throw new Error("O arquivo XML deve ter conteúdo e no máximo 2 MiB.");

    // The server reparses the uploaded bytes; browser previews and hashes are ignored.
    const xml = decodeXmlBytes(new Uint8Array(await file.arrayBuffer()));
    const project = parseProjectXml(xml, mapping);
    const selected = project.environments[sourceEnvironmentIndex];
    if (!selected)
      throw new Error(
        "O ambiente de origem selecionado não existe neste arquivo. Gere uma nova prévia.",
      );
    for (const [index, item] of selected.items.entries()) {
      if (
        item.code.length > 120 ||
        item.description.length > 500 ||
        (item.metadata?.variantKey?.length ?? 0) > 500
      ) {
        throw new Error(
          `Item ${index + 1}: o cadastro aceita código de até 120 caracteres e descrição ou variação de até 500 caracteres.`,
        );
      }
      if (
        item.costCents > 1_000_000_000_000 ||
        item.saleCents > 1_000_000_000_000
      ) {
        throw new Error(
          `Item ${index + 1}: o preço unitário ultrapassa o limite de cadastro. Revise o mapeamento de valores.`,
        );
      }
    }
    const result = await persistVerifiedXml({
      p_environment_id: environmentId,
      p_file_name: fileName,
      p_raw_xml: xml,
      p_sha256: computeXmlSha256(xml),
      p_snapshot: { ...selected, sourceEnvironmentIndex, mapping },
    });
    revalidatePath("/", "layout");
    return {
      ok: true,
      id: result.id,
      message: result.duplicate
        ? "Esta importação já estava registrada. Nenhuma versão foi duplicada."
        : "Importação registrada. Confira a versão na lista de versões do ambiente.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof z.ZodError
          ? `Revise os dados da importação: ${error.issues.map((issue) => issue.message).join(" ")}`
          : error instanceof Error
            ? error.message
            : "Não foi possível importar o XML. Revise o arquivo e tente novamente.",
    };
  }
}
