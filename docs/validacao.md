# Evidências de validação

Entrega inicial: 31/10/2026. Evolução da comparação: 01/11/2026. Escopo: núcleo operacional para uma loja, sem fiscal nem multitenancy. Os resultados registram verificações executadas em cada data; não representam homologação de todas as 115 funcionalidades do mapa.

## Entrega inicial: ambiente e comandos

Node.js 24.22.1, npm 11.9.0, Next.js 16.4.3, React 19.3.1, Vitest 4.1.12, PGlite e Playwright. Dependências reproduzíveis por `npm ci` usando o lockfile versionado.

| Comando | Resultado |
| --- | --- |
| `npm run check` | Exit code 0; inclui lint, TypeScript, Vitest e build Webpack. |
| `npm test` dentro do check | 5 arquivos; **120 testes passaram** em 25,54 s. |
| `npm run build` dentro do check | Build de produção compilou, verificou tipos, gerou rotas e concluiu otimização. |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/tmp/foccolojas-browser-test/chrome-headless-shell-linux64/chrome-headless-shell npm run test:e2e` | **3 testes passaram** em aproximadamente 1 minuto; zero retries. |

O caminho do Chromium acima é específico deste ambiente. Em outra máquina, executar `npx playwright install chromium` e `npm run test:e2e` conforme o README. Avisos de configuração npm `http-proxy`, cores do terminal e Fast Refresh não impediram os comandos; o fluxo principal verifica que a página não emite erros de execução.

## Cobertura exercitada

| Grupo | Casos | Evidência principal |
| --- | ---: | --- |
| Parser XML | 59 | Layouts configuráveis, ambientes, códigos, variantes, valores, UTF-8, limites, DTD/entidades recusados e hash. |
| Dinheiro | 15 | Conversão exata para centavos e recusa de formatos inválidos/ambíguos. |
| Entradas operacionais | 24 | Quantidades, datas reais de calendário, precisão e conversão UTC−3. |
| Guarda da demonstração | 3 | Ativação explícita e bloqueio quando `NODE_ENV=production`. |
| PostgreSQL embutido | 19 | Migrações, permissões, snapshots, aprovações, revisão, pedidos, recebimento/reserva, entrega/montagem, assistência, baixa/estorno, cancelamento e idempotência. |

Os cenários de banco incluem chamadas diretas sem permissão, rollback de operações inválidas, importação reservada ao backend com ator revalidado e envio/recebimento de pedido existente depois da conclusão. Testam as regras SQL e papéis num banco isolado; não simulam todos os componentes de um projeto Supabase hospedado.

### Navegador

1. **Fluxo integrado:** cria cliente, projeto e ambiente; importa 2,5 unidades com venda de R$ 5.864,18 e custo de R$ 3.086,40; cria orçamento/contrato; registra as três aprovações; revisa; gera pedido; recebe 1 e depois 1,5; reserva 2,5; entrega e monta; abre e encerra assistência; cria título de R$ 100,00, baixa R$ 40,00 e estorna, retornando o saldo a R$ 100,00.
2. **Navegação em celular:** viewport de 390 × 844, menu acessível, abertura do mapa e ausência de transbordamento horizontal da página.
3. **Importação XML:** seleciona um ambiente do arquivo, cria versão, repete sem duplicar, invalida prévia quando o layout muda e recusa XML com DTD sem alterar o histórico.

Foi realizada inspeção visual da interface com dados fictícios. Não foi feita comparação sistemática com um FoccoLOJAS autenticado nem auditoria completa de acessibilidade.

## Revisão e correções

Duas revisões independentes examinaram regras/especificação e segurança. Foram corrigidos:

- Snapshot XML arbitrário enviado diretamente por um usuário da API: a gravação agora exige a RPC confiável do backend, depois da interpretação dos bytes e autenticação; o banco revalida o ator.
- Janela de concorrência na conclusão de projeto: a transação passa a bloquear o projeto antes do contrato e compromisso, na ordem compatível com orçamento/contrato.
- Pedido existente pendente quando a montagem utilizou estoque global: envio e recebimento continuam possíveis após conclusão, mantendo aprovações e idempotência. Novas revisões, compras e reservas continuam bloqueadas nesse contrato.
- Lista de ambientes de um contrato: usa os ambientes efetivamente incluídos no orçamento contratado.
- Cancelamento de contrato exibido ao papel financeiro: a interface agora respeita a permissão comercial/administrativa.
- Associação acessível entre rótulo e controle: opções de um seletor não entram no nome acessível do campo.

O defeito de envio tardio foi reproduzido antes da migração 008; o cenário passou depois. As revisões finais delimitadas não identificaram bloqueadores nas correções examinadas. Isso não equivale a uma garantia de ausência de defeitos em produção.

## Publicação do código

Publicação confirmada em 30/10/2026 (America/Sao_Paulo), pela API do GitHub, no commit `ae2456ee0e8fbc900d9b52c479b86dbd29eaef8f`, branch `main` de `ItamarJuniorDEV/system-test`. A árvore `f20df647d551b079c63bade1367108c656aac105` corresponde à implementação local `e0a1bed`: após `git fetch`, `git diff` não encontrou diferenças nos 107 arquivos. O SHA do commit mudou porque a API criou um novo commit.

O acesso foi liberado pelo usuário incluindo o repositório na instalação. O registro documental posterior altera somente a documentação. As datas originais dos testes acima usam UTC. A conferência do remoto não substitui implantação e homologação.

## Evolução de 01/11/2026: comparação da revisão

Referência: [spec e critérios de pronto](planos/2026-11-01-comparacao-revisao.md). O método do PDF foi aplicado à análise, especificação, revisão independente e implementação de uma fatia do bloco 04. SQL, permissões de gravação, contrato original e regras de aprovação não foram alterados.

| Verificação executada | Resultado |
| --- | --- |
| `npm test -- tests/review-comparison.test.ts` | **44 testes passaram**: identidades, duplicatas, reordenação, ambiguidades, campos/metadados, imutabilidade, precisão, limites e conciliação oficial. |
| `npm test -- tests/money.test.ts` | **21 testes passaram**, incluindo seis casos de exibição que preservam centavos de valores grandes e negativos. |
| `npm run lint` e lint dos novos arquivos | Exit code 0. |
| `npm run typecheck` | Exit code 0, incluindo os novos testes. |
| `npm run build` | Exit code 0; compilação, tipos, rotas e otimização de produção concluídos. |
| Cenários de `tests/e2e/core-workflow.spec.ts` | **2 passaram**: fluxo operacional completo e navegação mobile existente. |
| `npm run test:e2e -- tests/e2e/review-comparison.spec.ts` | **1 passou na execução final**, com Chrome configurado pela variável abaixo; inclui valores, paginação, mobile, snapshot salvo, recusa de revisão desatualizada e reinício do aceite. Nenhum erro de página ou do console do navegador. |
| Revisão independente da spec e do diff | Sem bloqueadores remanescentes no recorte. Limite executivo, conciliação dos totais, clareza do seletor, layout e identidade do formulário por revisão foram conferidos. |

Os **65 testes focados** acima foram executados nesta evolução. A suíte completa de 120 casos registrada na entrega inicial não foi repetida integralmente por uma alteração de leitura e apresentação. Os casos novos não são contados como funcionalidades completas do mapa.

A comparação usa as ocorrências preservadas, sem juntar itens somente pelo código. Duas linhas de meia unidade vendidas a um centavo cada somam dois centavos após o arredondamento por linha; intermediários monetários grandes usam inteiros. O teste de limite exercita 10.000 itens de cada lado e 20.000 linhas de resultado sem truncamento. A formatação em BRL também evita perder o último centavo pela divisão de um número grande em ponto flutuante.

### Ambiente de navegador desta evolução

A primeira tentativa não chegou aos cenários: o executável temporário usado anteriormente não existia mais. O instalador padrão do Playwright recebeu uma página HTML no lugar do ZIP. Foi obtida a distribuição oficial **Chrome for Testing 156.0.8078.80**, mantendo proxy e TLS, sem alterar dependências ou lockfile. Caminho temporário nesta sessão: `/tmp/system-test-browsers/chrome-headless-shell-156.0.8078.80/chrome-headless-shell-linux64/chrome-headless-shell`.

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/tmp/system-test-browsers/chrome-headless-shell-156.0.8078.80/chrome-headless-shell-linux64/chrome-headless-shell npm run test:e2e -- tests/e2e/review-comparison.spec.ts
```

Na execução integrada, os dois cenários existentes passaram e o cenário novo identificou transbordamento da página em 390 px. O mínimo automático da grade propagava a largura da tabela. A correção dá largura completa à revisão e permite encolher a grade externa, preservando a rolagem interna. A repetição passou e demonstrou acesso à última coluna. Foram inspecionadas capturas de computador e celular.

O formulário de aceite também passou a ter identidade própria por revisão: atualizar o snapshot reinicia checkbox e justificativa. A revisão independente identificou uma colisão de chaves no primeiro ajuste; a chave foi diferenciada da comparação. Depois de congelar essa correção, o build e o cenário completo passaram novamente, incluindo a checagem de console sem erros.

O caso executado usa 54 linhas comparadas, páginas de 50 e 4, com 51 itens equivalentes. Confere um contrato de R$ 250,00 e revisão de R$ 350,00; uma importação posterior de R$ 500,00 não altera a comparação salva nem permite aprová-la desatualizada. Depois de atualizar, conferir novamente e aprovar, contrato e orçamento continuam em R$ 250,00. Todas as operações do cenário usam a interface e dados sintéticos no PGlite; não é homologação do Supabase hospedado.

## Ainda não verificado

- Projeto Supabase real: aplicar as migrações, validar Auth por senha, renovação de sessão, PostgREST, chave privada de importação, RLS pela API e configuração de implantação.
- Concorrência em sessões PostgreSQL independentes, especialmente reserva de saldo, fechamento de projeto e repetição simultânea de comandos. O banco contém bloqueios; a validação hospedada ainda precisa ocorrer.
- XML real do exportador do usuário. As fixtures são sintéticas e não demonstram compatibilidade universal com Promob.
- Homologação dos operadores, carga de produção, recuperação operacional e recursos avançados que permanecem no plano.

Para retomar, usar [estado atual](estado-atual.md), [plano do núcleo](planos/2026-10-31-nucleo-erp.md) e [ordem das próximas fases](planos/ordem-de-implementacao.md).
