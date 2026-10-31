# Núcleo operacional ERP Implementation Plan

> **For agentic workers:** executar por fatias com implementação delegada, integração central e revisão independente. A autorização de execução já foi dada pelo usuário. Usar checkboxes (`- [ ]` / `- [x]`) para registrar o andamento.

**Goal:** entregar um núcleo operacional executável, com importação XML por ambiente, usando o mapa funcional completo para orientar as próximas entregas.

**Architecture:** aplicação Next.js com ações no servidor e Supabase Auth/PostgreSQL. As transações e autorizações de negócio residem em funções PostgreSQL; o navegador não grava tabelas diretamente. Demonstração local opcional usa as mesmas migrações em PGlite, com dados sintéticos e bloqueio em produção.

**Tech Stack:** TypeScript, Next.js, React, Tailwind, componentes no padrão shadcn/ui, Supabase, Vitest e Playwright.

**Spec:** `../escopo.md` e `../referencia/mapa-processos.md`.

## Global Constraints

- Uma loja; sem `tenant_id`, isolamento por organização ou seleção de lojas.
- Sem módulo fiscal, emissão de notas, tributos ou escrituração.
- XML pertence a uma versão de um ambiente; importação deve mostrar prévia antes de confirmar.
- Não pressupor um formato XML universal. A fixture de demonstração é sintética.
- Dinheiro armazenado em centavos, quantidades decimais; totais recalculados no banco.
- Assinatura, aprovação comercial e aprovação financeira são controles distintos.
- Conservar histórico; nenhuma operação destrutiva para apagar efeitos financeiros.
- Não criar GitHub Actions, serviços pagos, credenciais ou integrações fictícias.
- Nunca anunciar a totalidade do FoccoLOJAS como implementada ou homologada.

## Review Focus

1. Reimportar o mesmo XML ou repetir um recebimento/pagamento não pode duplicar os efeitos.
2. Um usuário sem papel adequado ou desativado não pode executar a função diretamente.
3. Importar nova versão não pode modificar itens e valores já contratados.
4. Receber acima do pedido, entregar sem reserva e baixar acima do saldo devem falhar atomicamente.
5. Erros no XML, decimal ambíguo, DTD/entity e destino incorreto devem produzir erro antes da gravação.

## Task 1: Referência e continuidade

**Files:** `docs/escopo.md`, `docs/referencia/*`, `docs/planos/ordem-de-implementacao.md`, `src/lib/process-map.ts`.

**Interfaces:** `PROCESS_MODULES` fornece blocos, fontes, dependências, situação e critérios documentados para a tela de mapa.

- [x] Consolidar os 14 blocos incluídos e registrar exclusões e lacunas.
- [x] Catalogar somente metadados e hashes das fontes; não republicar os manuais completos.
- [x] Conferir que o plano separa funcionalidade implementada, verificada e pendente de homologação.

## Task 2: XML determinístico

**Files:** `src/lib/imports/*`, `tests/xml-import.test.ts`, `examples/*`, `docs/referencia/importacao-xml.md`.

**Interfaces:** `parseProjectXml(xml, mapping): ParsedProject`, com ambientes e itens normalizados; preços unitários em centavos.

- [x] Escrever e observar testes falhando para formato sintético, múltiplos ambientes, decimais, campos faltantes e XML inseguro.
- [x] Implementar parser com caminhos configuráveis e limites explícitos.
- [x] Implementar prévia com seleção de origem/destino e confirmação no servidor.
- [x] Verificar testes e integração com versão imutável no banco.

## Task 3: Transações e permissões

**Files:** `supabase/migrations/*`, `supabase/tests/*`, `tests/database.test.ts`, `docs/arquitetura-banco.md`.

**Interfaces:** funções RPC descritas em `docs/arquitetura-banco.md`, consumidas exclusivamente por ações do servidor.

- [x] Cobrir fluxo cliente → projeto → ambiente → versão → orçamento → contrato → aprovações → revisão → compra → recebimento → reserva → entrega → montagem.
- [x] Cobrir assistência independente de contrato e encerramento por ocorrências.
- [x] Cobrir previsão → título → baixa parcial → estorno e reexecução idempotente.
- [x] Cobrir negações de permissão e entradas inválidas com rollback.
- [x] Executar migração e testes em PostgreSQL embutido, registrando o limite em relação a Supabase hospedado e concorrência real.

## Task 4: Interface e aplicação

**Files:** `src/app/*`, `src/components/*`, `src/lib/server/*`, `src/lib/format.ts`, `scripts/demo.mjs`.

**Interfaces:** ações tipadas retornam `{ok, message, id?}`; consultas são limitadas e autorizadas. Formulários exibem erros e impedem duplo clique.

- [x] Implementar autenticação Supabase por cookie, verificação de perfil ativo e saída.
- [x] Implementar formulários e telas operacionais para as RPCs entregues.
- [x] Implementar demonstração local isolada usando as mesmas regras do banco.
- [x] Verificar no navegador criação, importação, contratação e operação financeira; testar navegação em celular.

## Task 5: Revisão e entrega

**Files:** `README.md`, `docs/estado-atual.md`, `docs/validacao.md`, configuração e lockfile.

- [x] Executar lint, typecheck, testes de domínio/banco, build e cenários de navegador.
- [x] Revisar permissões, imutabilidade, valores, idempotência e bloqueio de demonstração em produção.
- [x] Corrigir defeitos encontrados e repetir apenas as verificações afetadas.
- [x] Registrar resultado real e pendências em `docs/validacao.md` e `docs/estado-atual.md`.
- [ ] Enviar o commit ao repositório autorizado e conferir o SHA remoto. Bloqueado: GitHub 403 por acesso da integração; Git local sem credencial. Preservar commit local e Git bundle para concluir quando a conexão tiver escrita.

## Decisões de execução

- 31/10/2026: divisão de trabalho por propriedade de arquivos (parser, banco, mapa e aplicação) para permitir trabalho paralelo sem sobrescritas.
- 31/10/2026: formato oficial de XML ainda não recebido; mapeamento configurável e exemplo sintético evitam declarar compatibilidade não verificada.
- 31/10/2026: ambiente não dispõe de Docker/Postgres CLI; PGlite permite executar regras SQL reais, sem representar esse resultado como homologação do Supabase hospedado.
