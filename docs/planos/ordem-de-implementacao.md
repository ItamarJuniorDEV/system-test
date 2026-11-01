# Ordem de implementação e critérios de avanço

## Objetivo e método

Entregar o escopo de uma loja em TypeScript/Next.js/Tailwind/Supabase, preservando os 14 blocos não fiscais do [mapa](../referencia/mapa-processos.md). A sequência abaixo é um **plano de implementação**, não um relatório de tarefas concluídas. O estado verificável de cada bloco é registrado em [process-map.ts](../../src/lib/process-map.ts).

Cada fatia deve fechar uma operação com interface, regra, persistência, autorização, efeitos e auditoria pertinentes. A conclusão exige resultado observado. Não é necessário esperar todas as funções de um módulo para entregar uma fatia útil; o bloco permanece `partial` enquanto houver cobertura declarada pendente.

## Fases

| Fase | Blocos principais | Entrega concreta | Dependência e critério para avançar |
| --- | --- | --- | --- |
| 1 | 13 Sistema e Avançado | Estrutura da aplicação, identidade, configuração de uma loja, permissões e trilha de auditoria. | Operação autorizada persiste; a mesma ação sem permissão é recusada. Identificar Supabase conectado versus demonstração. |
| 2 | 01 Clientes, 02 Projetos; contrato de arquivo do 14 | Cliente → projeto → ambiente/itens → importação sintética → orçamento reproduzível. | AC-01 e AC-02; origem e versão do arquivo conhecidas; nenhum anúncio de compatibilidade com XML real. |
| 3 | 03 Contratos, 09 Financeiro básico | Orçamento → contrato → decisões de aprovação → obrigação → baixa parcial/estorno. | AC-03 e AC-09; repetir uma requisição não duplica contrato ou baixa; cancelar não ignora pagamento existente. |
| 4 | 04 Revisão, 05 Compras | Revisão por ambiente e pedido por fornecedor; compra avulsa continua possível. | AC-04 e AC-05; gates dependem dos parâmetros; estados de envio/atendimento são distintos. |
| 5 | 06 Estoque, 07 Agenda/execução | Recebimento parcial → saldo → reserva → entrega/montagem aplicável. | AC-06 e AC-07; quantidades conciliadas, reserva concorrente verificada e cancelamento justificado. |
| 6 | 08 Assistência, 11 Indicadores; evolução do 09 | Ocorrências, pagador, solução com/sem compra; indicadores calculados do fluxo real. | AC-08 e AC-11; assistência sem contrato não é proibida por suposição; totais explicam sua origem. |
| 7 | 12 Enterprise, 14 Integrações, 15 Marketing; avançados de todos | Conectores reais, automações, comissões avançadas, BI/ETL, layouts e variantes de venda. | AC-12, AC-14, AC-15 e os demais aceites específicos. Cada conector exige contrato técnico, permissão, teste e recuperação de falhas. |

As fases organizam dependências de entrega, não regras universais de operação. Uma compra avulsa não precisa esperar contrato/revisão na interface. A infraestrutura necessária à importação sintética está na fase 2, mesmo que o conjunto de integrações produtivas seja fase 7. Financeiro e auditoria acompanham toda a execução, não são adicionados apenas ao final.

## Fluxo de trabalho por fatia

Registrar uma spec curta em seis partes no plano existente, sem exigir um arquivo novo por tarefa. Declarar também o que fica fora da fatia, preservando o backlog completo.

| Parte | Conteúdo mínimo |
| --- | --- |
| 1. Quem usa | Perfis autorizados e ações recusadas. A loja é única; a autorização depende do perfil e da operação. |
| 2. O que cada um faz | Ator, entrada, estado inicial, ação, saída e efeitos em outros módulos. |
| 3. Telas | Navegação e estados de carregamento, vazio, erro e sucesso pertinentes. |
| 4. Dados | Entidades, vínculos, versões e valores preservados ou alterados. |
| 5. Regras | Pré-condições, estados, exceções e limites numéricos; fonte e decisão adotada. |
| 6. Critérios de pronto | Exemplos com dados e resultado observável, incluindo recusas e repetição quando aplicáveis. |

Para cada regra material, registrar sua origem e o nível de evidência. Os rótulos podem coexistir; confirmação no código não equivale a homologação.

| Rótulo | Evidência necessária |
| --- | --- |
| **Documentada** | ID/URL da fonte FoccoLOJAS, variante e parâmetros relevantes; registrar ambiguidades. |
| **Adotada** | Decisão deste ERP, motivo e responsável pela decisão; explicitar diferenças da referência. |
| **Confirmada no código** | Arquivo/função e verificação do comportamento observado, com ambiente e resultado. |
| **Homologada** | Operador responsável, cenário, ambiente, data e resultado aceito; registrar diferenças pendentes. |

```mermaid
flowchart TB
  F["Fonte, origem e spec"] --> R["Revisão independente prévia"]
  R -->|"lacuna material"| F
  R -->|"aceites claros"| I["Implementação da fatia"]
  I --> V["Testes e evidências"]
  V --> H["Revisão independente da entrega"]
  H -->|"correção necessária"| I
  H -->|"resultado confirmado"| S["Registrar cobertura e homologação"]
  S --> D{"Pendências no bloco?"}
  D -->|"sim"| P["partial e lacunas"]
  D -->|"não"| C["implemented com evidência"]
```

1. **Fixar a referência e a spec:** usar [fontes.json](../referencia/fontes.json), sem copiar os manuais. Incluir resultado numérico quando houver saldo, quantidade ou valor.
2. **Revisar antes de implementar:** uma revisão independente aponta ambiguidades, contradições, lacunas e riscos materiais. Resolver os pontos da variante escolhida e registrar a decisão; dúvidas sem impacto na fatia ficam no backlog.
3. **Implementar a operação:** conectar tela, regras, persistência, autorização e auditoria. Função planejada fica identificada; não criar botão de sucesso para operação inexistente.
4. **Verificar o risco concreto:** caminho normal, erro relevante, permissão e repetição; concorrência e reversão onde houver saldo ou obrigação. Repetir ou ampliar testes para cobrir mudanças e riscos concretos, sem alterar o resultado esperado só para passar.
5. **Revisar depois de implementar:** conferir o diff e as evidências contra spec, fonte, permissões e efeitos entre módulos. Corrigir os achados e repetir as verificações afetadas. Revisão por IA e testes locais não substituem homologação do operador.
6. **Registrar e continuar:** salvar a versão, os resultados reais, limitações e próximo passo no registro já adotado. Atualizar somente o status justificável; homologação pendente permanece explícita.

Credenciais, acesso ao ambiente ou XML real pendentes não bloqueiam trabalhos independentes: interface, regras, testes com dados sintéticos e revisão podem avançar. A integração permanece pendente até ser verificada no ambiente correspondente; não simular conexão ativa.

O controle de precisão está nas entradas identificadas, regras explícitas, critérios de avanço e verificações reproduzíveis. Isso torna o processo auditável; não presume que a geração de código pela IA seja determinística ou que a concordância entre agentes comprove correção.

## Adaptação do método do PDF

Referência de método: **Fábrica de Sistemas com IA**, de **Matheus Battisti (Hora de Codar)**. As páginas físicas contam desde a capa; a página impressa é uma a menos. Aproveitamos spec e revisão independente (física 53 / impressa 52; 171 / 170), checklists verificáveis (172–174 / 171–173) e publicação, recuperação e observação da operação (130–134 / 129–133). A orientação para continuar trabalhos independentes enquanto falta acesso aparece em 87 / 86.

O cronograma de sete dias é didático; não estima a entrega dos 14 blocos deste ERP. A indicação de Hostinger com link/cupom (121 / 120) e a integração Appmax (87 / 86) não definem fornecedores obrigatórios. Venda por assinatura e multitenancy (159–161 / 158–160) pertencem ao exemplo SaaS. Preservar a stack aprovada, loja única e exclusão fiscal. Aplicar o método nos documentos existentes, sem criar rituais ou novas confirmações para ações já autorizadas.

## Exemplos de aceite que atravessam módulos

| Caso | Preparação | Ação e resultado esperado | Evidência mínima |
| --- | --- | --- | --- |
| E2E-01 Venda planejada simples | Cliente sintético, ambiente com subtotal R$ 250,00 e desconto proposto de 10%, sem outras despesas. | Total R$ 225,00; contrato mantém a versão aprovada; revisão e compra respeitam os gates configurados. | IDs ligados da origem ao contrato/pedido; total conferido; ator e transições registrados. |
| E2E-02 Atendimento parcial | Pedido de 10 unidades. | Receber 4 e depois 6 preserva saldo pendente, estoque e histórico. Repetir a primeira requisição não soma 4 de novo. | Contagem final e movimentos por recebimento; resposta da repetição registrada. |
| E2E-03 Reserva concorrente | Saldo disponível 6, estoque negativo bloqueado. | Duas solicitações concorrentes de 5 resultam em no máximo uma reserva aceita. | Resultado de ambas as solicitações e saldo final; não basta simular dois cliques sequenciais. |
| E2E-04 Baixa e estorno | Título de R$ 225,00 em aberto. | Receber R$ 100,00 deixa R$ 125,00; repetir não duplica; estornar restitui o saldo com histórico. | Título, baixa, chave de repetição e evento de estorno. |
| E2E-05 Assistência sem reposição | Cliente existente sem contrato, ocorrência resolvível por visita. | Abrir, agendar se necessário, resolver e concluir sem impor compra. | Ocorrência e solução vinculadas; nenhuma compra artificial criada. |
| E2E-06 Acesso negado | Usuário sem alçada de aprovação. | Requisição direta para aprovar é recusada; contrato, títulos e auditoria de negócio não indicam aprovação bem-sucedida. | Resposta negativa e consulta posterior das entidades; auditoria de tentativa se prevista. |
| E2E-07 Indicador rastreável | Dois contratos válidos de R$ 225,00 e R$ 100,00 no período. | Indicador mostra R$ 325,00 e o detalhe identifica a base; cancelamento segue a fórmula declarada. | Consulta/filtro, fórmula e registros que compõem o total. |

Esses números são fixtures propostas. O implementador deve registrar o contrato escolhido, incluindo precisão e estado de origem. Nenhum caso desta tabela está marcado como executado por sua mera existência no plano.

## Recursos avançados que não podem sumir do backlog

- **Comercial:** visitas, carteira, especificadores, fidelidade, vários cenários, formação de preço, despesas, alçadas, itens especiais, demonstração, venda futura e devolução comercial.
- **Contratos/revisão:** modelos/cláusulas, assinatura externa, checklists, complementos, snapshots, comparação, divisão/unificação e reabertura controlada.
- **Compras/estoque:** catálogos, máscaras, condições, consulta de parcelas, fornecedor integrado, volumes, locais, conversões, inventário, períodos e custo.
- **Execução/assistência:** equipes, habilitações, checklists, check-in/out, questionários, despesas, comissões, transporte e fluxos por pagador.
- **Financeiro/gestão:** previsões, efetivação, negociações, caixa, portadores, centros de custo, juros, rateios, cheques, TEF, políticas de comissão, indicadores e ETL.
- **Enterprise/integrações/marketing:** pipelines, matriz, gatilhos, comunicação, empreendimentos, aplicativos, Promob, fornecedores, e-commerce, DocSeguro, PipeRun e compra de itens de marketing, conforme evidência e contrato disponíveis.

Para cada item, abrir uma fatia verificável com fonte, dependência e aceite. Fiscal, hierarquia de múltiplas lojas e multitenancy permanecem excluídos; não entrarão pela implementação de um conector ou relatório.

## Arquitetura: decisões pelo caso, não por falsa oposição

Frontend, backend e banco são responsabilidades diferentes. A stack aprovada permite usar serviços do Supabase e funções/RPC do PostgreSQL para transações, com código de servidor quando o caso exigir. A escolha deve considerar autorização, atomicidade, tratamento de falhas, integrações e capacidade de testar. Não colocar uma regra crítica apenas no navegador por conveniência.

Integração externa de longa duração exige contrato de estados e recuperação: tentativa, resposta, correlação, repetição e falha. Não declarar uma conexão ativa apenas porque há URL ou variável de ambiente. Nenhuma credencial deve aparecer em catálogo, commit, log ou seed.

## Verificação visual

O frontend será próprio e o objetivo de proximidade visual deve ser avaliado separadamente do aceite funcional. Selecionar uma listagem rica, um detalhe com abas e uma ação com validação, observando navegação, estados vazios, erro, carregamento e responsividade. Screenshots isolados do help não cobrem todas as interações.

Antes de usar “igual ao Focco” ou “100%”, registrar quais telas/estados foram comparados, quais referências foram fornecidas e quais diferenças permanecem. Até lá, usar “interface baseada no mapa funcional”.

## Condições de entrada em operação

Os itens abaixo são **critérios pendentes, não verificações executadas**. A evidência local já registrada não comprova Supabase hospedado, recuperação operacional ou homologação da loja. Eles condicionam o uso com dados reais, sem impedir o avanço das fatias independentes.

| Condição | Evidência requerida para concluir |
| --- | --- |
| Supabase real | Migrações aplicadas; login, sessão e persistência pelo ambiente hospedado; chamadas PostgREST/RPC permitidas e recusadas conforme perfil, com RLS verificada pela API. Importação XML mantém chave privada no servidor e ator revalidado. |
| XML real | Arquivo autorizado com exportador/layout identificados; códigos, variantes, quantidades e preços conferidos pelo operador; reimportação sem duplicação e contrato anterior preservado. |
| Implantação e retorno | Commit e endereço publicados registrados; acesso HTTPS verificado; retorno a uma versão compatível exercitado em homologação. Registrar tratamento das migrações: voltar código não desfaz dados nem garante retorno seguro do banco. |
| Backup e restauração | Frequência e retenção definidas pela perda de dados e interrupção toleradas pela loja; cópia protegida fora do ambiente de origem; restauração em banco separado com vínculos, contagens e saldos conferidos. GitHub não substitui backup dos dados. |
| Saúde, logs e alerta | Verificação do aplicativo e banco; falha controlada em homologação detectada e aviso recebido; logs com retenção e correlação, sem segredos, XML bruto ou dados pessoais desnecessários. |
| Operador da loja | Responsável, data e cenário registrados; operador conclui o fluxo principal e uma exceção relevante, com resultados conferidos e dúvidas restantes anotadas. |

Não exigir cobrança externa para validar o financeiro interno: baixas e estornos desta fatia não movimentam bancos. Quando houver integração real, definir seu aceite e recuperação próprios. Manter a evidência e as pendências no registro de conclusão existente.

## Registro de conclusão e retomada

Usar o registro do projeto já adotado pela equipe; não criar AGENTS.md ou automação de CI por rotina. Em cada conclusão, anotar:

- Objetivo e caso de aceite da fatia.
- Arquivos alterados e vínculo com a fonte/requisito.
- Verificação realmente executada, ambiente e resultado.
- Limitações, falhas e funções ainda planejadas.
- Status justificado do bloco e próxima operação a completar.

A documentação desta referência foi produzida pela IA a partir da pesquisa consolidada. A implementação ocorre em frentes paralelas; a validação dos módulos cabe à revisão da entrega real, não à contagem de documentos ou de telas.
