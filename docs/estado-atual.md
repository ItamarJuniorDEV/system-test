# Estado atual e continuidade

Atualização: 01/11/2026. Execução pela IA, com escopo e envio ao repositório autorizados por Itamar. A compreensão e homologação do usuário ainda não foram avaliadas.

Registro de publicação: 30/10/2026, no fuso America/Sao_Paulo. As datas das verificações anteriores usam UTC.

## Objetivo e resultado

O mapa completo foi usado para iniciar o ERP em `ItamarJuniorDEV/system-test`: uma loja, sem fiscal, TypeScript/Next.js/Supabase e importação XML vinculada ao ambiente. A aplicação contém um núcleo comercial e operacional com tela, validação e funções transacionais PostgreSQL, além do plano das extensões.

O mapa reúne **14 blocos e 115 funcionalidades**. Isso é escopo documentado, não contagem de funcionalidades implementadas. O catálogo contém 395 referências: 377 textos funcionais lidos, 8 históricos triados, 1 documento visual e 9 destinos sem conteúdo recuperado. Não republica os corpos dos manuais.

A evolução de 01/11 aplica os princípios úteis de **Fábrica de Sistemas com IA**, fornecido pelo usuário. As 179 páginas foram lidas em três recortes complementares, com conferência visual dos diagramas relevantes. O método foi incorporado ao plano existente e aplicado à [comparação do contratado com a revisão executiva](planos/2026-11-01-comparacao-revisao.md): especificação, revisão prévia, implementação, verificação e revisão do diff.

## Decisões vigentes

- Stack aceita pelo usuário: TypeScript, Next.js, React, Tailwind/componentes no padrão shadcn e Supabase.
- Uma loja; fiscal e multitenancy excluídos expressamente.
- XML: layout configurável, ambiente de origem selecionado explicitamente, destino já cadastrado, versões imutáveis e deduplicação. Os exemplos atuais são sintéticos.
- A gravação do snapshot XML passa por RPC reservada ao servidor, com chave privada somente no backend e ator autenticado revalidado no banco. A API do usuário não aceita snapshots enviados diretamente.
- Configuração inicial: revisão exige assinatura e aprovações comercial/financeira. Diferença executiva exige aceite administrativo justificado e não altera o contrato original.
- A comparação lê os itens congelados do orçamento e o snapshot da revisão salva. Identidades distintas e duplicatas não são unidas por suposição; diferenças e totais são calculados em inteiros e conciliados com os valores oficiais. Filtro e paginação alteram somente a apresentação.
- Compras são agrupadas por fornecedor; envio é um registro local. Integrações externas não foram simuladas como reais.
- Reserva é explícita. Concluir entrega consome todas as reservas ativas do contrato; montagem exige entrega integral.
- Previsão, efetivação, baixa e estorno têm operações distintas. Estorno preserva a baixa original e não movimenta bancos.
- A demonstração usa as mesmas migrações SQL em PGlite, com dados fictícios e bloqueio em produção.
- Webpack selecionado porque o Turbopack encontrou erro de subprocesso/porta no ambiente de execução. O build final de produção passou.
- Cada próxima fatia identifica usuários, ações, telas, dados, regras e aceites. Origem documentada, decisão adotada, confirmação no código e homologação são registradas separadamente. Credenciais ou XML real pendentes não bloqueiam tarefas independentes.

## Evidência de verificação

Verificação da entrega inicial em 31/10/2026 UTC, com Node.js 24.22.1 e dependências do lockfile:

| Verificação | Resultado observado |
| --- | --- |
| `npm run check` | Exit code 0: ESLint, TypeScript, 120 testes em 5 arquivos e build de produção Next.js/Webpack passaram. |
| `npm run test:e2e` com Chromium local | 3 testes passaram: fluxo comercial/operacional/financeiro completo, navegação em celular e importação/reimportação XML com validações. |
| Revisão independente de regras e segurança | Defeitos encontrados foram corrigidos; revisão final delimitada sem bloqueadores identificados. |

Os 120 testes compreendem 59 de XML, 15 de dinheiro, 24 de entradas operacionais, 3 do bloqueio de demonstração e 19 cenários de banco. O fluxo completo de navegador também verifica ausência de erros de execução da página.

As correções de revisão incluem importação persistida apenas pelo servidor autenticado, bloqueio do projeto durante conclusão, envio/recebimento tardio de pedido existente após montagem, ambientes efetivamente contratados e permissão do botão de cancelamento. Detalhes e limites: [validação](validacao.md).

### Evolução de 01/11/2026

Passaram 44 testes focados da comparação e 21 de dinheiro, lint, TypeScript e build de produção. No navegador, os dois cenários existentes de fluxo operacional/mobile passaram; o novo cenário completo de comparação passou após corrigir o transbordamento em 390 px. A validação final também confirma rolagem interna, acesso à última coluna, reinício do aceite ao mudar a revisão e ausência de erros de página/console.

O caso demonstra contratado de R$ 250,00, revisão de R$ 350,00 e nova versão de R$ 500,00. A revisão salva permanece em R$ 350,00 até ser atualizada; sua aprovação desatualizada é recusada. Aprovar a nova revisão preserva contrato e orçamento em R$ 250,00. As evidências são locais, com XML sintético e PGlite. Nenhum bloco foi promovido a `implemented` por essa fatia.

## Situação do envio ao GitHub

O código foi publicado na branch `main` de `https://github.com/ItamarJuniorDEV/system-test` pela API do GitHub, após a liberação do repositório na instalação pelo usuário. Commit remoto da implementação: `ae2456ee0e8fbc900d9b52c479b86dbd29eaef8f`.

A árvore `f20df647d551b079c63bade1367108c656aac105` foi conferida com `git fetch` e `git diff`: os 107 arquivos correspondem integralmente ao conteúdo do commit local `e0a1bed048ecfd892b601220a1d332c37e0e9640`. Os hashes dos commits diferem porque a publicação pela API criou um novo commit. O histórico local original foi preservado na branch `archive/implementacao-inicial` e no pacote entregue; a branch local `main` acompanha `origin/main`.

O erro 403 anterior foi resolvido ao incluir `system-test` no acesso da instalação. A atualização da branch remota foi feita sem `force`, conferindo o SHA anterior. A publicação do código não representa implantação da aplicação nem homologação do Supabase hospedado. O commit documental `9f13c3d` registra a publicação inicial; a comparação e a adaptação do método constituem a evolução posterior, identificada pelo histórico de `main`.

## Limites atuais

- Projeto Supabase hospedado, Auth real e PostgREST ainda não conectados nesta sessão. Validar migrações, login, sessões, RLS através da API e concorrência em sessões independentes no projeto escolhido.
- XML real do exportador do usuário ainda não fornecido. Confirmar caminhos, códigos/variações, unidade, quantidade, custos e preços de venda. O layout sintético não prova compatibilidade Promob.
- A interface possui identidade própria. Não houve comparação visual sistemática com telas de um ambiente FoccoLOJAS autenticado.
- Listagens gerais mostram os 500 registros mais recentes e informam o recorte. Coleções para conferência usam paginação interna com teto explícito de 10.000 registros; o histórico financeiro mostra até 50 baixas com estornos consultados individualmente.
- A comparação aceita até 10.000 itens em cada entrada, produzindo no máximo 20.000 linhas. A tela mostra um ambiente por vez, com páginas de 50 linhas. Comparar qualquer par de revisões históricas e reativar versões continuam planejados.
- Autenticação inicial por senha; convites, recuperação de senha e MFA ainda requerem os fluxos completos de Auth.
- As extensões comerciais, logísticas, financeiras, Enterprise e de integração permanecem no plano. Nenhum dos 14 blocos deve ser marcado como integralmente concluído.

## Próximas ações após esta entrega

1. **Próxima fatia funcional independente:** especificar a negociação das condições e parcelas do orçamento e sua origem nas previsões a receber, usando as fontes já catalogadas, especialmente 31114825599761 e 35899486685585. Fechar soma exata, vencimentos, preservação do contratado, permissões e repetição antes de implementar. Ainda não implementada; as demais extensões permanecem no [plano completo](planos/ordem-de-implementacao.md).
2. **Supabase hospedado, adiado pelo usuário em 01/11:** manter a integração preparada e continuar o desenvolvimento local. O usuário pediu expressamente para deixar a conexão para depois; não solicitar instalação ou reabrir autenticação enquanto essa decisão estiver vigente. Quando ele retomar, criar ou selecionar o projeto dedicado e validar migrações, Auth, PostgREST e RLS real. A autorização técnica para criar/conectar já havia sido dada, mas a autenticação anterior não terminou e o conector estava disponível, não instalado, na última consulta.
3. **XML real:** homologar um arquivo autorizado de um ambiente, comparando códigos, variações, quantidades e valores com o exportador. Critério: importação/reimportação corretas, sem mistura de ambientes, contrato anterior preservado e confirmação do operador.
4. **Entrada em operação:** cumprir os critérios de implantação, retorno compatível, restauração de backup, saúde/alerta e uso pelo operador registrados no plano. Publicação do código e demonstração local não concluem esses critérios.
