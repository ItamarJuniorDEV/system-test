# Escopo do system-test

## Decisão vigente

Construir um ERP próprio com referência funcional no FoccoLOJAS, usando **TypeScript, Next.js, Tailwind CSS e Supabase**, para **uma única loja**, **sem módulo fiscal** e **sem multitenancy**. Esta decisão substitui a recomendação anterior de Laravel/Filament feita em outro contexto. Nenhum código do Studio Kasa deve ser copiado.

Usar todo o mapa significa manter os **14 blocos não fiscais** visíveis no planejamento e na rastreabilidade. Não significa declarar todas as funcionalidades implementadas na primeira entrega. Recursos avançados e integrações não podem desaparecer do plano nem aparecer como prontos sem evidência.

## Entrega operacional inicial autorizada

O núcleo em construção percorre cadastro de cliente, projeto, ambientes e itens, importação XML sintética, orçamento, contrato e aprovação, revisão, pedido de compra, recebimento, estoque, agenda, assistência, financeiro simples e auditoria. Esses itens são metas da implementação compartilhada; este documento não certifica que já foram concluídos.

| Área | O que precisa existir na primeira fatia correspondente | O que permanece planejado até validação |
| --- | --- | --- |
| Clientes/projetos | Vínculo consistente entre cliente, projeto, ambientes e itens. | Carteira avançada, fidelidade, múltiplos cenários completos e itens especiais. |
| XML/orçamento | Formato sintético declarado, validação, prévia e total reproduzível. | Compatibilidade com XML real e integração Promob/API. |
| Contrato/aprovação | Origem identificada e decisões separadas com responsável e data. | DocSeguro, alçadas complexas, layouts completos e distrato integrado. |
| Revisão/compras | Conferência por ambiente, pedido e estados claros. | Complementos completos, divisão/unificação, Supplier Portal e fábrica. |
| Recebimento/estoque | Quantidades recebidas, saldo e reserva diferenciados. | Inventário fechado, custo médio, conversões e conferência de volumes avançados. |
| Agenda/assistência | Responsável, prazo, situação, ocorrência e solução. | Check-in/out, questionários, comissões e conexões externas. |
| Financeiro | Receber/pagar simples, baixa parcial, saldo e estorno. | TEF, bancos, cheques, comissões complexas e financiamentos. |
| Gestão/configuração | Identidade, permissão, parâmetros e auditoria. | Enterprise completo, BI/ETL, aplicativos e marketing detalhado. |

As listas detalhadas de funcionalidades, dependências, regras e fontes estão em [mapa-processos.md](referencia/mapa-processos.md) e [process-map.ts](../src/lib/process-map.ts). O catálogo de evidências está em [fontes.json](referencia/fontes.json).

## Exclusões explícitas

- **Fiscal:** emissão/recepção fiscal, autorização NF-e/NFC-e, SEFAZ, certificados fiscais, cálculo tributário, FoccoTributos, Sintegra, SPED e PAF. Guardar um número de documento como referência operacional, se necessário, não cria integração fiscal.
- **Multitenancy e múltiplas lojas:** não construir isolamento entre empresas, troca de loja, hierarquia de unidades, consolidação financeira ou transferência entre empresas. Vários locais de estoque dentro da mesma loja podem ser planejados sem introduzir multitenancy.
- **Código proprietário ou de outro projeto:** não copiar código do FoccoLOJAS nem do Studio Kasa. A pesquisa fornece descrição funcional em fontes públicas, não implementação proprietária.
- **GitHub Actions:** não criar workflows neste escopo.
- **Integrações em produção presumidas:** citar um conector não confirma contrato, credenciais, licença, sandbox ou acesso de um novo ERP à API.

As referências fiscais continuam no catálogo documental para preservar o inventário e contextualizar diferenças de fluxo. Elas não geram tarefas de implementação fiscal. Como o recebimento pode ter origem fiscal no produto de referência, o novo sistema deve possuir uma operação interna explícita de recebimento, com estoque e financeiro coerentes, sem alegar emissão de nota.

## Requisitos obrigatórios do núcleo

1. **Uma única loja com autorização real.** A ausência de multitenancy não dispensa autenticação nem permissões por ação.
2. **Regras na camada confiável.** O frontend apresenta e solicita; operações sensíveis devem validar permissão, estado, valores e vínculos no servidor ou em função de banco/RPC apropriada. A localização concreta depende da arquitetura escolhida, não de uma oposição artificial entre Supabase e backend.
3. **Persistência identificada.** Ambiente conectado ao Supabase, dados de demonstração e eventual armazenamento local devem ser distinguidos. Uma sessão demonstrativa não prova persistência multiusuário ou operação produtiva.
4. **Operações repetidas e concorrentes tratadas.** Importar, gerar contrato, receber mercadoria ou baixar título não pode duplicar efeitos por repetição da solicitação. A estratégia deve ser demonstrada no caso crítico.
5. **Estados separados.** Contrato assinado não equivale a liberado; pedido enviado não equivale a recebido; saldo físico não equivale a disponível; previsão não equivale a título pago.
6. **Histórico explicável.** Registrar ator, horário, ação, origem e motivo quando aplicável. Cancelamento/reversão precisa tratar efeitos e preservar evidência proposta para o novo sistema. Não registrar senhas, tokens ou segredos na auditoria.
7. **Erros e limites honestos.** Função planejada pode explicar o próximo passo, mas não simular sucesso. Integração não configurada deve informar sua indisponibilidade.

## XML: contrato atual e limite de compatibilidade

Até que seja fornecido e validado um arquivo real, a implementação usa **XML sintético**, com estrutura e dados de demonstração controlados pelo projeto. Esse suporte não comprova compatibilidade geral com Promob, FoccoERP, Supplier Portal ou qualquer exportação real do FoccoLOJAS.

O contrato do importador deve declarar elementos aceitos, campos obrigatórios, unidades, formato decimal, versão, limites e comportamento de reimportação. O aceite exige arquivo válido, arquivo malformado, campo ausente, valor inválido e repetição. Caso a implementação opte por importação parcial, isso deve ser explícito na prévia e nos resultados; nunca ocorrer silenciosamente.

Uma amostra real futura deve ser fornecida por canal autorizado, sem dados pessoais desnecessários. A validação deve comparar itens, quantidades, preços, máscaras e vínculos esperados. Documentação de layout é evidência de possibilidades, não um schema único universal. [Fonte oficial do layout](https://suporte.promob.com/hc/pt-br/articles/31113830062609).

## Fidelidade funcional e visual

**Funcional:** mesmo caso de uso relevante, parâmetros conhecidos, entradas, estados, efeitos e exceções acordados. A referência pode ser adaptada ao escopo de uma loja sem fiscal; a adaptação precisa ser explícita.

**Visual:** composição, navegação, tabelas, formulários, ações, estados vazios, erros, carregamento e comportamento em diferentes tamanhos. A stack aprovada permite construir uma interface própria, mas não garante semelhança por si só.

Não prometer uma cópia visual de 100% com base apenas em screenshots do help. Para comparar com fidelidade, selecionar telas e interações representativas, obter referências suficientes e registrar as diferenças observadas. Dados sintéticos devem ser identificados. Uma tabela com o mesmo título não comprova equivalência funcional ou visual.

## Estados de implementação e conclusão

| Estado | Significado |
| --- | --- |
| `planned` | Escopo e/ou evidência registrados; não há demonstração suficiente de implementação. |
| `partial` | Uma parte foi implementada e verificada; recursos restantes e limitações continuam identificados. |
| `implemented` | Todas as funcionalidades declaradas para o bloco foram concluídas e verificadas no escopo atual, com evidência disponível. |

Uma aprovação do bloco não deve ser inferida da existência de uma rota, botão, schema ou seed. Cada atualização de status deve apontar o caso de aceite, o ambiente, a execução observada e a pendência remanescente. A carga inicial do mapa usa `planned` deliberadamente; o coordenador pode atualizar após verificar a entrega real.

## Decisões ainda a validar

- Parâmetros de aprovação, revisão e conclusão exigidos pela loja.
- Política de desconto, precisão monetária, rateio e parcelas.
- Reserva, saldo negativo, recebimento parcial e reversão com vínculos ativos.
- Política de devolução comercial: crédito, reembolso e tratamento de títulos.
- Configuração real do Supabase, autenticação, políticas de acesso e ambiente de demonstração.
- XML real e contrato de cada integração externa.
- Telas e interações que servirão de referência para avaliar fidelidade visual.
- Regras pouco documentadas de Marketing e PipeRun; divergências de Enterprise e versões antigas.

Essas decisões não bloqueiam todo o trabalho já autorizado: construir a menor fatia coerente com hipóteses explícitas, manter as funções avançadas planejadas e validar a decisão antes de ativar seu efeito real.
