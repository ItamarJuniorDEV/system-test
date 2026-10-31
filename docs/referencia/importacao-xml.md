# Importação XML por mapeamento explícito

## Escopo e evidência

Este aplicativo lê um XML de projeto usando um mapeamento informado pelo usuário, mostra os ambientes separadamente e entrega uma prévia de itens. O layout padrão e os arquivos em `examples/` são **sintéticos**. Eles demonstram este aplicativo e não constituem um padrão Promob homologado.

A documentação oficial do FoccoLOJAS informa que layouts XML podem usar XSL e XSD desenvolvidos para cada cliente a partir de um arquivo fornecido por ele. Também permite selecionar layout por fornecedor. Nas fontes consultadas não foi localizada uma amostra XML completa, acompanhada de schema público, que permita validar compatibilidade universal com o fluxo comercial do FoccoLOJAS. Por isso, esta implementação não executa XSL, não valida XSD e não tenta reconhecer tags por semelhança.

| Fonte oficial | Evidência usada | Limite para este aplicativo |
| --- | --- | --- |
| [Layout de Importação](https://suporte.promob.com/hc/pt-br/articles/31113830062609) | XSL/XSD adaptados por cliente, layout por fornecedor e distinção entre preço unitário e total. Também documenta integração direta via API. | Não comprova um único schema XML universal. A integração via API não foi implementada. |
| [Projetos](https://suporte.promob.com/hc/pt-br/articles/31114181027089) | Importação pede dados do ambiente e avisa quando o XML contém vários ambientes. | Aqui os ambientes são preservados na prévia; uma importação confirma somente uma origem e um destino. |
| [Fornecedor Importação XML](https://suporte.promob.com/hc/pt-br/articles/31114388447505) | Fornecedor do arquivo pode ser associado a um fornecedor cadastrado. | Metadados podem carregar a referência; o parser não cadastra nem vincula fornecedores automaticamente. |
| [Revisões de Projeto — Importação XML](https://suporte.promob.com/hc/pt-br/articles/41070712550801) | Revisão usa novo projeto para comparar diferenças antes de enviar à fábrica. | Ler XML não aprova contrato, libera financeiro ou conclui revisão. |
| [Importação Automática de XML](https://suporte.promob.com/hc/pt-br/articles/31113782059921) | Nomes de arquivo identificam projeto/ambiente, revisão ou ocorrência no processo original. | Este aplicativo exige seleção explícita. Não deduz destino pelo nome do arquivo e não monitora pastas. |
| [Builder — Integração ERP Promob — XML](https://suporte.promob.com/hc/pt-br/articles/31121852993809) | Há variantes por integração/versão, atributos específicos e distinção entre valores unitários e totais. | Exemplos parciais de outro fluxo não foram usados para declarar compatibilidade com o XML de uma loja. |

O parser usa `fast-xml-parser`, com leitura de atributos, valores preservados como texto e processamento de entidades desativado. Referência técnica: [opções oficiais do parser](https://github.com/NaturalIntelligence/fast-xml-parser/blob/master/docs/v4,%20v5/2.XMLparseOptions.md).

## API

Módulo universal, utilizável na prévia e no servidor:

```ts
import {
  decodeXmlBytes,
  parseProjectXml,
  DEFAULT_XML_MAPPING,
  XML_MAPPING_FIELDS,
  XmlImportError,
  type XmlMapping,
  type ParsedProject,
} from "@/lib/imports/xml";

const xml = decodeXmlBytes(new Uint8Array(await file.arrayBuffer()));
const preview = parseProjectXml(xml, DEFAULT_XML_MAPPING);
```

`parseProjectXml(xml: string, mapping?: XmlMapping): ParsedProject` retorna:

```ts
interface ParsedProject {
  projectName?: string;
  environments: Array<{
    name: string;
    items: Array<{
      code: string;
      description: string;
      quantity: number;
      unit: string;
      costCents: number;
      saleCents: number;
      metadata?: Record<string, string>;
    }>;
  }>;
  warnings: string[];
}
```

`costCents` e `saleCents` são valores **unitários** em centavos. A quantidade permanece separada. O parser não soma ambientes, não consolida códigos repetidos e não calcula comissão, desconto, tributos ou formação de preço.

`XML_MAPPING_FIELDS` contém `{ key, label, required, help }` para os campos de caminho do formulário. `numberFormat` deve usar um seletor próprio. O mapeamento completo deve ser salvo junto da prévia confirmada, para explicar como os campos foram interpretados.

## Caminhos do mapeamento

Use nomes exatos, respeitando maiúsculas e minúsculas, separados por `/`. Um atributo é indicado por `@nome` somente no último segmento. Os caminhos não são XPath: não aceitam `//`, `..`, `*`, índices, filtros ou expressões. Prefixos de namespace são preservados e devem ser informados literalmente se existirem no arquivo.

| Campo | Contexto do caminho | Padrão sintético |
| --- | --- | --- |
| `projectName` | Documento completo; opcional | `project/@name` |
| `environments` | Documento completo; coleção de ambientes | `project/environments/environment` |
| `environmentName` | Um ambiente | `@name` |
| `items` | Um ambiente; coleção de itens | `items/item` |
| `code` | Um item | `@code` |
| `description` | Um item | `description` |
| `quantity` | Um item | `quantity` |
| `unit` | Um item | `unit` |
| `cost` | Um item; custo por unidade em moeda | `unitCost` |
| `sale` | Um item; venda por unidade em moeda | `unitSale` |

Todos os campos do item são obrigatórios. Valores ausentes não viram zero. Para um preço realmente zero, o XML deve conter `0` ou `0,00`, conforme o formato selecionado. Nome do projeto pode ser desabilitado com `undefined` ou string vazia. Metadados opcionais usam um objeto `nome: caminho` e são omitidos quando não existem no item.

Um caminho escalar que encontra duas tags é rejeitado. Isso evita escolher silenciosamente o primeiro preço, quantidade ou código. Texto misturado com estruturas aninhadas também é rejeitado; tags simples, atributos e CDATA simples são aceitos. Códigos como `0001` permanecem strings.

## Números e unidades

| Formato | Exemplo aceito | Exemplo rejeitado |
| --- | --- | --- |
| `pt-BR` | `1234,56`, `1.234,56`, `1234`, `0,00` | `1.23`, `1,234.56`, `R$ 1,00` |
| `decimal-point` | `1234.56`, `1234`, `0.00` | `1,234.56`, `1234,56` |

O formato deve ser escolhido antes da importação. Em `pt-BR`, `1.234` significa 1234 porque o ponto é separador de milhar. Em `decimal-point`, milhar agrupado não é aceito. Não há detecção automática.

- Quantidade: maior que zero, até 1.000.000 e no máximo três casas decimais.
- Preços unitários: não negativos e no máximo duas casas decimais. Conversão para centavos usa inteiros; casas extras são rejeitadas, sem arredondamento escondido.
- Notação científica, sinais, símbolos de moeda, valores não finitos e valores acima da precisão inteira segura são rejeitados.
- Unidade de medida vem do arquivo. O parser não converte caixa em unidade nem aplica repetição. Quando o exportador possui quantidade e repetição separadas, a transformação precisa ser definida e validada antes de usar este layout.
- Não mapeie preço total da linha para `cost` ou `sale`. O parser não adivinha se um valor é total ou unitário.

## Codificação do arquivo

`decodeXmlBytes(bytes: Uint8Array): string` aceita somente UTF-8 válido, com BOM opcional. Use `file.arrayBuffer()` seguido do helper; `file.text()` pode substituir bytes inválidos silenciosamente.

O decoder usa `TextDecoder` em modo fatal. BOM ou padrões iniciais de UTF-16/UTF-32 são rejeitados. Declarações ISO-8859-1, Windows-1252, UTF-16 ou outras codificações também são rejeitadas, inclusive quando o trecho disponível contém somente ASCII. `parseProjectXml` repete a checagem da declaração para chamadas diretas no servidor.

A orientação de correção é reexportar ou converter o arquivo para UTF-8. Alterar apenas `encoding="..."` não converte os bytes. Um XML sem declaração é tratado explicitamente como UTF-8 por este aplicativo.

## Limites e segurança

Limites deste aplicativo, sem pretensão de serem limites do Promob:

| Limite | Valor |
| --- | --- |
| Arquivo | 2 MiB em UTF-8 |
| Ambientes por arquivo | 100 |
| Itens no conjunto do arquivo | 5.000 |
| Elementos XML | 100.000 |
| Profundidade XML | 64 níveis |
| Caminho de mapeamento | 256 caracteres e 32 segmentos |
| Metadados por item | 20 |
| Nome de projeto/ambiente | 200 caracteres |
| Código de item / unidade | 128 / 20 caracteres |
| Descrição ou valor de metadado | 2.000 caracteres |

DTD, DOCTYPE, declarações de entidades, referências a entidades desconhecidas e nomes de objeto reservados são rejeitados. O código não faz requisições de rede, não lê caminhos do XML e não executa XSL ou instruções de processamento. Entidades XML predefinidas e referências numéricas válidas são decodificadas uma única vez; CDATA é texto literal.

Tamanho, profundidade e número de elementos são limitados antes da análise recursiva. Documento malformado, múltiplas raízes, caracteres inválidos, campo obrigatório ausente e campo ambíguo interrompem a prévia inteira. Não há importação parcial silenciosa.

## Confirmação, hash e duplicidade

Fluxo implementado de confirmação:

1. Ler bytes e validar UTF-8.
2. Informar ou revisar o mapeamento e gerar a prévia.
3. Selecionar explicitamente **um ambiente de origem, pelo índice, e um ambiente de destino**. Mesmo nomes repetidos permanecem linhas distintas.
4. A Server Action valida a sessão, o papel do usuário, o arquivo, o mapeamento e a seleção; decodifica e interpreta novamente os bytes recebidos. A prévia, os preços e o hash do navegador não são aceitos como autoridade.
5. O backend monta o snapshot do ambiente selecionado, calcula o hash e chama `import_environment_version_verified` com o usuário verificado em `p_actor_id`. Essa RPC aceita somente `service_role`; o banco também exige perfil ativo e papel `commercial`, `operations` ou `admin` para o ator informado.
6. Persistir a versão e o snapshot com a identificação usada pelo controle de duplicidade. A função restaura a identidade anterior após a operação, e a auditoria registra o usuário verificado.

O cliente de persistência usa `SUPABASE_SECRET_KEY` exclusivamente no servidor, em módulo protegido por `server-only`; a chave não recebe prefixo `NEXT_PUBLIC_` e não é enviada ao navegador. Esse cliente é separado do cliente de sessão usado nas consultas comuns. A função interna `import_environment_version` não concede execução aos papéis da API, inclusive `service_role`; somente o wrapper autorizado a chama. O banco valida a forma, os valores e o hash do snapshot, mas a interpretação do XML pertence ao backend. O parser isolado não grava dados.

`computeXmlSha256(xml: string): string`, em `src/lib/imports/xml.server.ts`, usa `node:crypto` e deve ser chamado somente no servidor. Ele calcula SHA-256 da representação UTF-8 da string validada, sem compactar espaços ou canonicalizar o XML.

**Limite do hash:** o decoder remove o BOM UTF-8. Portanto, o hash identifica o conteúdo textual recebido pelo servidor, não todos os bytes originais do upload. Dois arquivos que diferem apenas pelo BOM têm o mesmo conteúdo após decoding. Diferenças de espaços ou quebras de linha continuam produzindo hashes diferentes. Hash não prova que um arquivo veio do Promob.

A chave de duplicidade persistida pertence à operação de domínio/banco, que combina o hash e o snapshot canônico da seleção. Este módulo não mantém uma segunda regra de deduplicação nem grava dados. Código repetido dentro do XML apenas produz aviso e mantém as linhas, porque o mesmo código pode representar itens com máscaras ou medidas diferentes.

## Exemplos e validação

- `examples/projeto-sintetico.xml`: dois ambientes separados; padrão `pt-BR`.
- `examples/projeto-mapeamento-alternativo.xml`: tags e atributos diferentes; padrão numérico com ponto.
- `examples/mapeamento-alternativo.json`: mapeamento completo do segundo exemplo.

Ambos os XMLs declaram no próprio arquivo que são sintéticos. Antes de declarar compatibilidade com uma biblioteca/exportador real, obtenha um arquivo autorizado, registre produto/versão/layout e compare manualmente códigos, quantidades, unidades e preços unitários esperados.

Os testes em `tests/xml-import.test.ts` cobrem os exemplos, números, ausências e ambiguidades, repetição de códigos, separação de ambientes, XML malformado, DTD/entidades, profundidade, tamanho, contagem de itens, UTF-8 e hash. Eles não substituem a validação com um XML real da loja ou os testes de persistência e autorização do fluxo completo.

```sh
npm test -- tests/xml-import.test.ts
```
