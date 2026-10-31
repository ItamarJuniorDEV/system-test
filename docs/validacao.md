# Evidências da entrega inicial

Data: 31/10/2026. Escopo: núcleo operacional para uma loja, sem fiscal nem multitenancy. Os resultados abaixo registram verificações executadas; não representam homologação de todas as 115 funcionalidades do mapa.

## Ambiente e comandos

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

## Ainda não verificado

- Projeto Supabase real: aplicar as migrações, validar Auth por senha, renovação de sessão, PostgREST, chave privada de importação, RLS pela API e configuração de implantação.
- Concorrência em sessões PostgreSQL independentes, especialmente reserva de saldo, fechamento de projeto e repetição simultânea de comandos. O banco contém bloqueios; a validação hospedada ainda precisa ocorrer.
- XML real do exportador do usuário. As fixtures são sintéticas e não demonstram compatibilidade universal com Promob.
- Homologação dos operadores, carga de produção, recuperação operacional e recursos avançados que permanecem no plano.
- Push remoto: integração GitHub respondeu 403 e o Git local não tem credencial. Não existe confirmação de commit remoto nesta entrega.

Para retomar, usar [estado atual](estado-atual.md), [plano do núcleo](planos/2026-10-31-nucleo-erp.md) e [ordem das próximas fases](planos/ordem-de-implementacao.md).
