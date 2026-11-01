# Comparação dos itens contratados com a revisão executiva

Data: 01/11/2026. Bloco 04, Revisão técnica. Esta fatia acrescenta uma conferência de leitura ao núcleo existente; o bloco continua `partial`.

## Referência e decisões

A referência funcional é o artigo oficial [31112258334737, Comparar versões da Revisão de Ambientes](https://suporte.promob.com/hc/pt-br/articles/31112258334737), catalogado em `docs/referencia/fontes.json`. Ele descreve versões identificadas, itens antes/depois, diferenças, totais e filtros. A seleção de quaisquer duas revisões históricas permanece fora desta fatia.

O método usa as seis partes de especificação e revisão crítica de **Fábrica de Sistemas com IA**, Matheus Battisti, páginas físicas 41 e 53 (impressas 40 e 52), além dos critérios de verificação das páginas físicas 97–108 e 171–174. O arquivo foi fornecido pelo usuário; seu conteúdo não é republicado no repositório.

| Decisão | Origem e situação |
| --- | --- |
| Comparar os itens e totalizadores de versões identificadas. | Documentada na referência funcional. |
| Comparar o orçamento contratado com o snapshot da revisão vigente nesta entrega. | Recorte adotado para evolução do núcleo já implementado. |
| Orçamento, contrato e snapshot executivo são preservados. | Confirmado no código e nas migrações existentes; não depende do estado atual do XML. |
| Diferença de versão exige aceite administrativo justificado, mesmo com totais iguais. | Política inicial confirmada no banco; homologação pela loja pendente. A comparação não altera esse bloqueio. |
| Correspondência por identidade e tratamento explícito de duplicatas. | Decisão técnica desta fatia, descrita abaixo; não é inferida como algoritmo interno do FoccoLOJAS. |

## 1. Quem usa

Usuários ativos que já podem consultar o contrato e suas revisões: comercial, operação, financeiro e administrador, conforme RLS vigente. A leitura não amplia permissões de aprovação, compra ou acesso ao banco.

## 2. O que cada um faz

O responsável pela conferência abre o contrato, identifica os ambientes e versões comparados, vê inclusões, remoções e alterações e confere valores antes/depois. Pode mostrar somente diferenças ou todos os itens e consultar detalhes de descrição e metadados. O administrador usa essa evidência na aprovação já existente, com justificativa quando exigida.

## 3. Tela

Na seção **Revisão executiva** de `/contratos/[id]`, substituir a lista isolada de itens executivos por **Comparação com o contratado**. Apresentar:

- Resumo de incluídos, removidos, alterados e sem alteração, com filtro de diferenças inicialmente ativo.
- Cada ambiente identificado, versão de origem do orçamento, versão do snapshot executivo e indicação de mudança de versão.
- Quantidade, unidade, custo unitário, venda unitária e totais antes/depois; diferenças monetárias por ambiente.
- Detalhes de descrição, variante e metadados, sem depender só de cores para indicar mudanças.
- Mensagem distinta para itens equivalentes em uma nova versão. A mensagem não dispensa a aprovação exigida.
- Paginação de 50 linhas por ambiente, sem alterar os totalizadores nem ocultar o número de resultados. Filtro, ambiente e página devem manter contexto claro.
- Erros de leitura continuam seguindo o tratamento existente, sem trocar falha por uma comparação vazia. No celular, tabelas podem rolar dentro do painel, sem alargar a página.

## 4. Dados

Fonte anterior: todos os `budget_items` do `contract.budget_id`, com ambiente, fornecedor, versão, índice de origem, código, unidade, variante, descrição, quantidade, centavos e metadados congelados.

Fonte posterior: `technical_reviews.snapshot.environments[].snapshot.items` da revisão exibida. Os metadados de versão e fornecedor vêm desse mesmo snapshot. O número da versão contratada pode ser consultado por seu ID imutável; essa consulta não seleciona a última versão do ambiente.

Não há novas tabelas, migrações, comandos de gravação ou credenciais. O cálculo ocorre no servidor a partir de consultas autorizadas; o navegador recebe somente os dados de apresentação. A interação local altera filtro e página, sem recalcular ou aprovar operações financeiras.

## 5. Regras

1. Separar ambientes por ID. Dentro de cada ambiente, a identidade usa fornecedor, código, unidade e `variant_key` normalizado pelo banco. Troca de identidade aparece como remoção e inclusão, inclusive quando o código e o preço são iguais.
2. Em cada identidade, casar primeiro linhas de conteúdo idêntico como um multiconjunto, preservando cada ocorrência. A ordem do XML não caracteriza alteração.
3. Se sobra exatamente uma linha anterior e uma posterior na identidade, mostrar alteração de quantidade, descrição, custo, venda ou metadados. Se a correspondência remanescente for ambígua, mostrar linhas removidas/incluídas com aviso, sem inventar pareamento por posição ou apagar duplicatas.
4. Comparar metadados por conteúdo, sem depender da ordem de suas chaves. Não descartar medidas, acabamentos ou outros campos importados.
5. Calcular valores em centavos inteiros, com quantidade de até quatro casas; arredondar cada linha ao centavo antes da soma, como o PostgreSQL existente. Utilizar aritmética inteira para produtos e somas. Valores anteriores congelados e totais oficiais da revisão continuam sendo a referência financeira.
6. Não alterar itens, contrato, revisão, compras, saldo, aprovação ou auditoria ao consultar/filtrar. Não criar complemento comercial, nem efetivar cobrança pela diferença.
7. Uma importação posterior não muda a comparação de uma revisão já criada. Aprovar uma revisão desatualizada continua sendo recusado pelo banco.
8. Limitar cada entrada a 10.000 itens: contratados e executivos. O resultado combinado tem no máximo 20.000 linhas. Conferir esses limites antes do pareamento; excesso produz aviso explícito, sem truncar ou apresentar totais parciais. Paginação visual nunca altera a base ou os totais.
9. Conciliar a venda anterior com o contrato, a venda e o custo posteriores com a revisão e o delta com `difference_cents`. Se os valores divergirem ou os dados não forem válidos, mostrar indisponibilidade da comparação; a aprovação pela tela permanece indisponível até corrigir a leitura. As RPCs e suas permissões não são alteradas.
10. Ao atualizar para outra revisão, reiniciar o aceite e a justificativa do formulário. Uma confirmação preenchida para a revisão anterior não representa conferência da nova versão.

## 6. Critérios de pronto

| Caso | Resultado observável |
| --- | --- |
| Reordenação e duplicatas idênticas | Mesmas ocorrências, quantidades e totais; zero alteração material. |
| Quantidade e preço | Item A: 2 × R$ 100,00 antes e 3 × R$ 110,00 depois; linha alterada e diferença de R$ 130,00. |
| Inclusão e remoção | Item B de R$ 50,00 removido e item C de R$ 20,00 incluído; total do exemplo passa de R$ 250,00 para R$ 350,00, diferença R$ 100,00. |
| Variante/unidade/fornecedor/ambiente | Mesmo código em identidades distintas não é unido; uma mudança com total igual continua visível. |
| Ambiguidade | Duplicatas sem correspondência inequívoca continuam listadas, com aviso e sem perda de valor. |
| Arredondamento | Duas linhas de quantidade 0,5 e venda unitária de 1 centavo totalizam 2 centavos, não 1. |
| Conciliação e limites | Valores calculados conferem com os totais oficiais; divergência ou mais de 10.000 itens em qualquer entrada produz erro explícito, sem comparação parcial. |
| Versão nova com conteúdo equivalente | Zero alteração material; IDs/números de versão diferentes continuam indicados e o bloqueio existente é preservado. |
| Importação após a revisão | A tela mantém os itens da revisão salva e informa qual versão está sendo conferida; o banco recusa sua aprovação quando desatualizada. |
| Histórico | Após consultar e aprovar a revisão válida, contrato e orçamento continuam com R$ 250,00 no exemplo, mesmo que a revisão some R$ 350,00. |
| Aceite da versão | Depois de atualizar a revisão, checkbox desmarcado e justificativa vazia exigem nova conferência antes de aprovar. |
| Uso | Filtro, detalhes e paginação funcionam; um cenário de navegador atravessa importação, contrato, nova versão e comparação. A tela cabe em 390 px com rolagem interna da tabela. |

Verificação: testes focados no comparador, um cenário de navegador que confira dados e histórico, verificações estáticas e build de produção por alteração da fronteira servidor/componente. Revisão independente da spec antes de implementar e do diff antes de publicar. Registrar os resultados executados em `docs/validacao.md`.

A revisão independente da spec confirmou o recorte e pediu limites para as duas entradas e conciliação com os totais persistidos. Ambos os ajustes foram incorporados nas regras 8 e 9 antes da integração da tela.

## Fora desta fatia e homologação

Seleção de qualquer par de revisões históricas, restauração/reativação de versão, complementos, negociação financeira, reabertura e integração real Promob permanecem no mapa. A tela possui identidade própria; este incremento não comprova fidelidade visual ao FoccoLOJAS.

Homologação pela loja: em um contrato de teste com XML autorizado, o operador identifica uma peça alterada, explica o delta por ambiente e confirma que a versão contratada foi preservada. Supabase hospedado, autenticação real e XML real continuam pendentes; não impedem executar a fatia local com dados sintéticos.
