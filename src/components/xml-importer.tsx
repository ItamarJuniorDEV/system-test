"use client";

import {
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileCode2,
  LoaderCircle,
  Upload,
} from "lucide-react";
import { importXmlVersion } from "@/app/xml-actions";
import type { ActionResult } from "@/app/actions";
import {
  decodeXmlBytes,
  DEFAULT_XML_MAPPING,
  parseProjectXml,
  XML_IMPORT_LIMITS,
  XML_MAPPING_FIELDS,
  type ParsedProject,
  type XmlMapping,
  type XmlMappingPathField,
} from "@/lib/imports/xml";
import { brl, quantity as formatQuantity } from "@/lib/format";
import { Button } from "./ui/button";
import { Field, Notice } from "./ui/primitives";

type Preview = {
  project: ParsedProject;
  mapping: XmlMapping;
  file: File;
  revision: number;
  destinationId: string;
};

export interface XmlImporterProps {
  environmentId: string;
  environmentName: string;
  projectName: string;
}

const PAGE_SIZE = 100;
const MAX_TOTAL_CENTS = 9_000_000_000_000_000n;

// Match the database's per-line rounding for nonnegative quantities/prices.
function lineTotal(quantity: number, unitCents: number): bigint {
  return (
    (BigInt(Math.round(quantity * 1000)) * BigInt(unitCents) + 500n) / 1000n
  );
}

function displayTotal(cents: bigint): string {
  return cents > MAX_TOTAL_CENTS ? "Acima do limite" : brl(Number(cents));
}

export function XmlImporter({
  environmentId,
  environmentName,
  projectName,
}: XmlImporterProps) {
  const router = useRouter();
  const uploadId = useId();
  const previewRevision = useRef(0);
  const fileReadSequence = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [xml, setXml] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [mapping, setMapping] = useState<XmlMapping>({
    ...DEFAULT_XML_MAPPING,
  });
  const [variantKeyPath, setVariantKeyPath] = useState("");
  const [mappingOpen, setMappingOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [sourceIndex, setSourceIndex] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const currentPreview =
    preview?.destinationId === environmentId ? preview : null;
  const selected =
    sourceIndex === ""
      ? undefined
      : currentPreview?.project.environments[Number(sourceIndex)];
  const totals = useMemo(() => {
    let cost = 0n;
    let sale = 0n;
    for (const item of selected?.items ?? []) {
      cost += lineTotal(item.quantity, item.costCents);
      sale += lineTotal(item.quantity, item.saleCents);
    }
    return { cost, sale };
  }, [selected]);
  const storageProblem = selected?.items.some(
    (item) =>
      item.code.length > 120 ||
      item.description.length > 500 ||
      (item.metadata?.variantKey?.length ?? 0) > 500,
  )
    ? "O cadastro aceita código de até 120 caracteres e descrição ou variação de até 500 caracteres. Revise o arquivo antes de importar."
    : selected?.items.some(
          (item) =>
            item.costCents > 1_000_000_000_000 ||
            item.saleCents > 1_000_000_000_000,
        )
      ? "Um preço unitário ultrapassa o limite de cadastro. Confira se o mapeamento aponta para valores unitários."
      : totals.cost > MAX_TOTAL_CENTS || totals.sale > MAX_TOTAL_CENTS
        ? "O total deste ambiente ultrapassa o limite permitido. Revise os valores antes de importar."
        : null;

  function invalidatePreview() {
    previewRevision.current++;
    setPreview(null);
    setSourceIndex("");
    setConfirmed(false);
    setPage(0);
    setError(null);
    setResult(null);
  }

  async function readFile(nextFile: File | null) {
    if (pending) return;
    const sequence = ++fileReadSequence.current;
    invalidatePreview();
    setXml(null);
    setFile(null);
    setReading(false);
    if (!nextFile) return;
    if (!/\.xml$/i.test(nextFile.name.trim())) {
      setError("Selecione um arquivo com extensão .xml.");
      return;
    }
    if (!nextFile.size || nextFile.size > XML_IMPORT_LIMITS.maxBytes) {
      setError("O arquivo deve ter conteúdo e no máximo 2 MiB.");
      return;
    }
    setReading(true);
    try {
      const content = decodeXmlBytes(
        new Uint8Array(await nextFile.arrayBuffer()),
      );
      if (sequence !== fileReadSequence.current) return;
      setFile(nextFile);
      setXml(content);
    } catch (caught) {
      if (sequence === fileReadSequence.current)
        setError(
          caught instanceof Error
            ? caught.message
            : "Não foi possível ler o arquivo XML.",
        );
    } finally {
      if (sequence === fileReadSequence.current) setReading(false);
    }
  }

  function updatePath(key: XmlMappingPathField, value: string) {
    invalidatePreview();
    setMapping((previous) => ({ ...previous, [key]: value }));
  }

  function buildPreview() {
    invalidatePreview();
    if (!file || xml === null) {
      setError("Selecione e carregue um arquivo XML antes de gerar a prévia.");
      return;
    }
    const selectedMapping: XmlMapping = {
      ...mapping,
      ...(variantKeyPath.trim()
        ? { metadata: { variantKey: variantKeyPath.trim() } }
        : {}),
    };
    try {
      const project = parseProjectXml(xml, selectedMapping);
      setPreview({
        project,
        mapping: selectedMapping,
        file,
        revision: previewRevision.current,
        destinationId: environmentId,
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível interpretar o XML.",
      );
      setMappingOpen(true);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      pending ||
      !currentPreview ||
      !selected ||
      !confirmed ||
      storageProblem ||
      currentPreview.revision !== previewRevision.current
    )
      return;
    const data = new FormData();
    data.set("file", currentPreview.file);
    data.set("environmentId", environmentId);
    data.set("sourceIndex", sourceIndex);
    data.set("mapping", JSON.stringify(currentPreview.mapping));
    data.set("confirmDestination", "on");
    setResult(null);
    startTransition(async () => {
      try {
        const response = await importXmlVersion(data);
        setResult(response);
        if (response.ok) {
          setConfirmed(false);
          router.refresh();
        }
      } catch {
        setResult({
          ok: false,
          message:
            "A conexão foi interrompida. Confira a lista de versões e tente novamente com a mesma seleção; a importação possui controle de duplicidade.",
        });
      }
    });
  }

  const step = !file ? 1 : !currentPreview ? 2 : 3;
  const pageCount = selected ? Math.ceil(selected.items.length / PAGE_SIZE) : 0;

  return (
    <form className="action-form" onSubmit={submit}>
      <div className="step-strip" aria-label="Etapas da importação">
        {["Escolher XML", "Revisar layout", "Conferir e importar"].map(
          (title, index) => (
            <span
              key={title}
              className={step === index + 1 ? "current" : undefined}
              aria-current={step === index + 1 ? "step" : undefined}
            >
              <b>{index + 1}</b>
              {title}
            </span>
          ),
        )}
      </div>

      <Notice>
        <strong>Importação com layout configurável</strong>
        <p>
          O layout inicial usa um exemplo sintético. Para um XML real, confira
          os caminhos e os preços antes de confirmar. A compatibilidade com o
          seu exportador Promob ainda precisa ser validada.
        </p>
      </Notice>

      <div
        className="upload-zone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (pending) return;
          if (event.dataTransfer.files.length !== 1) {
            invalidatePreview();
            setError("Arraste somente um arquivo XML por vez.");
            return;
          }
          void readFile(event.dataTransfer.files[0]);
        }}
      >
        <Upload size={28} strokeWidth={1.5} aria-hidden="true" />
        <label htmlFor={uploadId}>
          <strong>Escolha ou arraste um XML de projeto</strong>
        </label>
        <p>UTF-8 · até 2 MiB · até 5.000 itens no arquivo</p>
        <input
          id={uploadId}
          type="file"
          accept=".xml,application/xml,text/xml"
          disabled={pending}
          onChange={(event) => {
            void readFile(event.currentTarget.files?.[0] ?? null);
          }}
        />
        {reading && (
          <p role="status">
            <LoaderCircle size={14} className="spin" aria-hidden="true" /> Lendo
            e verificando a codificação…
          </p>
        )}
        {file && (
          <p>
            <FileCode2 size={14} aria-hidden="true" /> {file.name} ·{" "}
            {(file.size / 1024).toFixed(1).replace(".", ",")} KiB
          </p>
        )}
        <Button asChild variant="ghost" size="sm">
          <a href="/examples/projeto-sintetico.xml" download>
            <Download size={14} aria-hidden="true" />
            Baixar exemplo sintético
          </a>
        </Button>
      </div>

      <details
        open={mappingOpen}
        onToggle={(event) => setMappingOpen(event.currentTarget.open)}
      >
        <summary>Revisar mapeamento do XML</summary>
        <div className="stack">
          <Notice>
            Use <strong>/</strong> entre tags e <strong>@nome</strong> para um
            atributo. Os caminhos respeitam maiúsculas e minúsculas. Custo e
            venda devem apontar para <strong>preços unitários</strong>.
          </Notice>
          <div className="form-grid">
            {XML_MAPPING_FIELDS.map((field) => (
              <Field key={field.key} label={field.label} hint={field.help}>
                <input
                  value={mapping[field.key] ?? ""}
                  onChange={(event) =>
                    updatePath(field.key, event.currentTarget.value)
                  }
                  required={field.required}
                  disabled={pending}
                  maxLength={256}
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
            ))}
            <Field
              label="Formato numérico"
              hint="O separador é explícito. Valores com outro formato são rejeitados."
            >
              <select
                value={mapping.numberFormat}
                disabled={pending}
                onChange={(event) => {
                  const numberFormat = event.currentTarget
                    .value as XmlMapping["numberFormat"];
                  invalidatePreview();
                  setMapping((previous) => ({ ...previous, numberFormat }));
                }}
              >
                <option value="pt-BR">Brasileiro — 1.234,56</option>
                <option value="decimal-point">Ponto decimal — 1234.56</option>
              </select>
            </Field>
            <Field
              label="Chave de variação (opcional)"
              hint="Caminho relativo ao item para máscara ou variação que diferencia o mesmo código no estoque."
            >
              <input
                value={variantKeyPath}
                disabled={pending}
                maxLength={256}
                placeholder="Ex.: @mask"
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => {
                  invalidatePreview();
                  setVariantKeyPath(event.currentTarget.value);
                }}
              />
            </Field>
          </div>
          <div className="form-footer">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => {
                invalidatePreview();
                setMapping({ ...DEFAULT_XML_MAPPING });
                setVariantKeyPath("");
              }}
            >
              Restaurar layout do exemplo
            </Button>
          </div>
        </div>
      </details>

      <div className="form-footer">
        <Button
          type="button"
          variant="outline"
          disabled={!file || xml === null || reading || pending}
          onClick={buildPreview}
        >
          Gerar prévia com este layout
        </Button>
      </div>
      {error && (
        <div className="form-message form-error" role="alert">
          <AlertCircle size={17} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {currentPreview && (
        <div className="stack">
          <Notice>
            <strong>
              Prévia:{" "}
              {currentPreview.project.projectName ?? currentPreview.file.name}
            </strong>
            <p>
              {currentPreview.project.environments.length} ambiente(s)
              encontrado(s). Escolha somente um para esta importação.
            </p>
          </Notice>
          {currentPreview.project.warnings.map((warning, index) => (
            <Notice key={`${index}-${warning}`} tone="warning">
              {warning}
            </Notice>
          ))}
          <Field
            label="Ambiente de origem no XML"
            hint="A seleção é obrigatória, mesmo se houver apenas um ambiente no arquivo."
          >
            <select
              value={sourceIndex}
              required
              disabled={pending}
              onChange={(event) => {
                setSourceIndex(event.currentTarget.value);
                setConfirmed(false);
                setPage(0);
                setResult(null);
              }}
            >
              <option value="">Selecione um ambiente de origem</option>
              {currentPreview.project.environments.map((environment, index) => (
                <option key={index} value={index}>
                  {index + 1}. {environment.name} — {environment.items.length}{" "}
                  item(ns)
                </option>
              ))}
            </select>
          </Field>

          {selected && (
            <>
              <div className="table-wrap">
                <table>
                  <caption>
                    Itens do ambiente de origem: {selected.name}
                  </caption>
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Descrição</th>
                      <th className="number">Quantidade</th>
                      <th>Unidade</th>
                      <th className="number">Custo unit.</th>
                      <th className="number">Venda unit.</th>
                      <th className="number">Custo total</th>
                      <th className="number">Venda total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.items
                      .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
                      .map((item, index) => (
                        <tr key={`${sourceIndex}-${page * PAGE_SIZE + index}`}>
                          <td>
                            <strong>{item.code}</strong>
                          </td>
                          <td>
                            {item.description}
                            {item.metadata?.variantKey && (
                              <small>
                                Variação: {item.metadata.variantKey}
                              </small>
                            )}
                          </td>
                          <td className="number">
                            {formatQuantity(item.quantity)}
                          </td>
                          <td>{item.unit}</td>
                          <td className="number">{brl(item.costCents)}</td>
                          <td className="number">{brl(item.saleCents)}</td>
                          <td className="number">
                            {displayTotal(
                              lineTotal(item.quantity, item.costCents),
                            )}
                          </td>
                          <td className="number">
                            {displayTotal(
                              lineTotal(item.quantity, item.saleCents),
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                  <tfoot>
                    <tr className="table-total">
                      <td colSpan={6}>
                        Total de todos os {selected.items.length} itens
                      </td>
                      <td className="number">{displayTotal(totals.cost)}</td>
                      <td className="number">{displayTotal(totals.sale)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {pageCount > 1 && (
                <div className="item-row">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={page === 0 || pending}
                    onClick={() => setPage((previous) => previous - 1)}
                  >
                    Itens anteriores
                  </Button>
                  <span role="status">
                    Página {page + 1} de {pageCount} · totais incluem todas as
                    páginas
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={page + 1 >= pageCount || pending}
                    onClick={() => setPage((previous) => previous + 1)}
                  >
                    Próximos itens
                  </Button>
                </div>
              )}
              <Notice>
                Os totais multiplicam quantidade pelo preço unitário, arredondam
                cada linha ao centavo e somam todas as linhas do ambiente
                selecionado.
              </Notice>
              {storageProblem && (
                <Notice tone="warning">{storageProblem}</Notice>
              )}
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={confirmed}
                  required
                  disabled={pending || !!storageProblem}
                  onChange={(event) =>
                    setConfirmed(event.currentTarget.checked)
                  }
                />
                <span>
                  Confirmo a importação de <strong>{selected.name}</strong> para{" "}
                  <strong>{environmentName}</strong>.
                  <small>
                    Projeto de destino: {projectName}. Os itens serão
                    registrados como uma versão deste ambiente. Outros ambientes
                    do arquivo não serão incluídos.
                  </small>
                </span>
              </label>
            </>
          )}
        </div>
      )}

      {result && (
        <div
          role={result.ok ? "status" : "alert"}
          className={`form-message ${result.ok ? "form-success" : "form-error"}`}
        >
          {result.ok ? (
            <CheckCircle2 size={17} aria-hidden="true" />
          ) : (
            <AlertCircle size={17} aria-hidden="true" />
          )}
          <span>{result.message}</span>
        </div>
      )}
      <div className="form-footer">
        <Button
          type="submit"
          disabled={
            pending ||
            reading ||
            !currentPreview ||
            !selected ||
            !confirmed ||
            !!storageProblem
          }
        >
          {pending && (
            <LoaderCircle size={15} className="spin" aria-hidden="true" />
          )}
          {pending
            ? "Importando versão…"
            : "Confirmar importação neste ambiente"}
        </Button>
      </div>
    </form>
  );
}
