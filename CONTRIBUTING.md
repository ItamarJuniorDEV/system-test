# Desenvolvimento e validação

Use o [escopo](docs/escopo.md), o [mapa](docs/referencia/mapa-processos.md) e o [estado atual](docs/estado-atual.md) antes de iniciar outra fatia. O usuário autorizou uma loja, sem fiscal e sem multitenancy.

1. Escolha um caso de uso e identifique suas fontes, atores, pré-condições, entradas, efeitos e exceções. Conflitos entre fontes permanecem explícitos até decisão.
2. Defina exemplos verificáveis, inclusive valores, saldos, duplicação e permissões. Os nomes das telas não substituem regras de negócio.
3. Implemente a fatia inteira, atravessando interface, ações, transação e autorização. Acrescente migrações novas depois da primeira instalação; não reescreva migrações já aplicadas em um projeto real.
4. Use testes nas fronteiras públicas: resultado do parser, RPCs, políticas e percurso no navegador. Não contabilize testes como porcentagem de fidelidade ao FoccoLOJAS.
5. Execute as verificações afetadas, faça revisão independente e registre resultado e limitações em `docs/estado-atual.md`.
6. Use Conventional Commits com descrição em português. Não adicione GitHub Actions por padrão.

## Invariantes

- Nenhuma chave privilegiada no frontend ou no repositório.
- Nenhuma confiança em valores monetários, prévias XML, papéis ou hashes recebidos do cliente.
- Perfil inativo não consulta nem altera dados de negócio.
- Dinheiro em centavos e quantidades com precisão explícita, sem correções silenciosas.
- Operações críticas em uma transação; bloqueios e idempotência verificados no banco.
- Snapshot contratado não é substituído por importação nova.
- Efeitos financeiros/estoque são compensados com histórico, não apagados.
- Demonstração local permanece em memória, visível e bloqueada em produção.
- Funcionalidades previstas no mapa permanecem como pendentes até implementação e verificação concretas.

Regras específicas da versão do Next.js: consultar `node_modules/next/dist/docs/`.
