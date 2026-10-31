# Núcleo transacional: contrato de integração

Uma loja, sem tenant_id e sem módulo fiscal. PostgreSQL/Supabase é a autoridade dos totais, aprovações, saldos e transições. A interface consulta tabelas permitidas e as gravações passam por RPCs. A persistência do snapshot XML exige o backend confiável descrito abaixo; não admite chamada direta do navegador. Os campos monetários são bigint em centavos e quantidades numeric(18,4). Identificadores são UUID. Todas as datas usam ISO; instantes são timestamptz.

## Campos usados pela interface

As tabelas de negócio têm id, created_at e created_by, salvo os saldos e perfis. Campo opcional é indicado por `?`.

| Tabela | Campos principais |
| --- | --- |
| profiles | id (= auth.users.id), name, role (`admin/commercial/operations/finance`), active |
| customers | name, document?, email?, phone?, notes?, active |
| suppliers | name, document?, email?, phone?, notes?, active, lead_days |
| projects | customer_id, name, status (`open/in_progress/closed/cancelled`) |
| environments | project_id, supplier_id, name |
| environment_versions | environment_id, version_number, file_name, raw_xml, sha256, import_fingerprint, snapshot, cost_cents, sale_cents |
| budgets | project_id, name, status (`draft/contracted`), total_cents, cost_cents |
| budget_items | budget_id, environment_id, environment_version_id, source_item_index, supplier_id, code, description, unit, variant_key, quantity, unit_cost_cents, unit_sale_cents, cost_cents, sale_cents, metadata |
| contracts | number, budget_id, project_id, customer_id, status (`draft/active/completed/cancelled`), total_cents, signed_at?, commercial_approved_at?, financial_approved_at?, cancelled_at?, cancellation_reason? |
| technical_reviews | contract_id, revision_number, status (`pending/blocked/approved/superseded`), snapshot, snapshot_hash, sale_cents, cost_cents, difference_cents, has_difference, approved_at?, difference_reason? |
| purchase_orders | number, technical_review_id, contract_id, supplier_id, status (`draft/sent/partially_received/received/cancelled`), total_cents, sent_at? |
| purchase_order_items | purchase_order_id, inventory_item_id, environment_id, code, description, unit, quantity, received_quantity, unit_cost_cents, total_cents |
| inventory_items | supplier_id, code, description, unit, variant_key |
| stock_balances | inventory_item_id (PK), on_hand, reserved, available (calculado), updated_at |
| stock_movements | inventory_item_id, purchase_order_item_id?, contract_id?, appointment_id?, kind (`receipt/reserve/release/delivery`), quantity_delta, reserved_delta, reason? |
| stock_reservations | contract_id, inventory_item_id, quantity, status (`active/fulfilled/released`), fulfilled_at?, released_at? |
| appointments | contract_id, kind (`delivery/assembly`), assigned_to, starts_at, ends_at, notes?, status (`scheduled/completed/cancelled`), completed_at? |
| assistance_tickets | contract_id?, customer_id, title, status (`open/closed`), closed_at? |
| assistance_occurrences | ticket_id, description, payer (`customer/store/factory/carrier`), status (`open/resolved`), resolution?, resolved_at? |
| financial_titles | number, direction (`receivable/payable`), origin (`manual/contract/purchase_order`), contract_id?, purchase_order_id?, customer_id?, supplier_id?, description, amount_cents, paid_cents, balance_cents (calculado), due_date, status (`forecast/open/partially_paid/paid/cancelled`) |
| settlements | financial_title_id, amount_cents, paid_at, request_id |
| settlement_reversals | settlement_id (único), reason, request_id |
| audit_events | entity_type, entity_id, action, details (sem XML/segredos), created_at, created_by |
| command_receipts | actor_id, request_id, operation, payload_hash, result; uso interno para idempotência |

## RPCs

Todas retornam JSON com `id` principal. `create_purchase_order` retorna também `orders`, um pedido por fornecedor; `id` é o primeiro pedido para redirecionamento, não representa um agrupador. `receive_purchase_order` retorna o pedido atualizado; `reserve_stock` retorna `reservations` e o primeiro id.

```text
upsert_customer(p_data jsonb)
upsert_supplier(p_data jsonb)
create_project(p_customer_id uuid, p_name text)
create_environment(p_project_id uuid, p_supplier_id uuid, p_name text)
import_environment_version_verified(p_actor_id uuid, p_environment_id uuid, p_file_name text, p_raw_xml text, p_sha256 text, p_snapshot jsonb) [somente service_role]
create_budget(p_project_id uuid, p_name text, p_environment_ids uuid[])
create_contract(p_budget_id uuid)
set_contract_approval(p_contract_id uuid, p_approval text, p_approved boolean)
start_technical_review(p_contract_id uuid)
complete_technical_review(p_review_id uuid, p_accept_difference boolean DEFAULT false, p_reason text DEFAULT NULL)
create_purchase_order(p_review_id uuid)
send_purchase_order(p_order_id uuid)
receive_purchase_order(p_order_id uuid, p_items jsonb, p_request_id uuid)
reserve_stock(p_contract_id uuid, p_items jsonb, p_request_id uuid)
create_appointment(p_contract_id uuid, p_kind text, p_starts_at timestamptz, p_ends_at timestamptz, p_notes text DEFAULT NULL)
complete_appointment(p_appointment_id uuid)
open_assistance(p_contract_id uuid, p_customer_id uuid, p_title text)
add_assistance_occurrence(p_ticket_id uuid, p_description text, p_payer text)
resolve_assistance_occurrence(p_occurrence_id uuid, p_resolution text)
close_assistance(p_ticket_id uuid)
create_financial_title(p_direction text, p_description text, p_amount_cents bigint, p_due_date date, p_customer_id uuid DEFAULT NULL, p_supplier_id uuid DEFAULT NULL)
activate_financial_title(p_title_id uuid)
settle_financial_title(p_title_id uuid, p_amount_cents bigint, p_paid_at date, p_request_id uuid)
reverse_settlement(p_settlement_id uuid, p_reason text, p_request_id uuid)
cancel_purchase_order(p_order_id uuid, p_reason text, p_request_id uuid)
cancel_contract(p_contract_id uuid, p_reason text, p_request_id uuid)
set_user_profile(p_user_id uuid, p_name text, p_role text, p_active boolean)
```

`p_data` aceita `id` na edição, name, document, email, phone, notes e active; fornecedor também lead_days. Campos omitidos na edição preservam valor.

`p_approval`: `signature`, `commercial` ou `financial`. Admin pode todas; commercial controla assinatura/comercial e finance controla financeira.

### Fronteira de confiança da importação

`import_environment_version_verified` só pode ser executada por `service_role`. O servidor verifica a sessão com o Supabase Auth, obtém o usuário verificado e interpreta o XML antes de chamar essa função. `p_actor_id` vem dessa verificação, e `p_snapshot` vem do parser no servidor; nenhum deles é aceito como autoridade a partir do navegador. A credencial de serviço `SUPABASE_SECRET_KEY` fica exclusivamente no servidor, em módulo protegido por `server-only`, sem prefixo `NEXT_PUBLIC_`; seu cliente não é reutilizado para consultas comuns da interface.

A função define a identidade do ator apenas durante a persistência e restaura os claims anteriores ao terminar. A função interna continua verificando perfil ativo e papel `commercial`/`operations` (ou `admin`), mesmo quando a chamada usa a credencial de serviço. Assim a auditoria pertence ao usuário verificado e uma credencial de serviço não dispensa sua autorização de negócio. `public.import_environment_version(...)` permanece como implementação interna, sem EXECUTE para `PUBLIC`, `anon`, `authenticated` ou `service_role`; o wrapper a chama como proprietário. Usuários de API não podem contornar o parser enviando um snapshot arbitrário para qualquer uma dessas funções.

Itens de recebimento: `[{"itemId":"UUID da linha do pedido","quantity":2}]`. Itens de reserva: `[{"inventoryItemId":"UUID do item de estoque","quantity":2}]`. Arrays não podem repetir a mesma linha/item.

Snapshot XML: `{name, items:[{code, description, quantity, unit, costCents, saleCents, metadata}], sourceEnvironmentIndex?, mapping?, fingerprint?}`. `metadata.variantKey` discrimina variações do mesmo código; fornecedor+code+unit+variantKey identifica o estoque. Quando a chave não é informada, mas há outros metadados, o banco deriva uma chave do hash desses metadados, evitando misturar variações de medidas/acabamento. Metadados vazios mantêm a variante vazia. Uma chave explícita deve identificar completamente a variante.

`settle_financial_title` retorna a baixa (`id` da baixa, `financial_title_id` e `title` atualizado). `reverse_settlement` retorna o estorno (`id` do estorno e `financial_title_id`); o título atualizado também vem na primeira execução. O estorno é um registro próprio: a baixa original permanece no histórico.

## Imutabilidade e idempotência

`sha256` é validado contra os bytes UTF-8 do texto `raw_xml` recebido pelo banco, sem remover caracteres nessa etapa. No fluxo de upload, `decodeXmlBytes` remove o BOM UTF-8 antes do cálculo e da persistência; portanto, esse hash identifica o texto validado, não todos os bytes originais do arquivo. O banco calcula `import_fingerprint` a partir desse hash e do JSONB normalizado do snapshot, excluindo a chave fingerprint recebida. Assim seleção de ambiente e mapeamento participam da identificação. Hash do XML não substitui fingerprint da importação. Um XML repetido com o mesmo recorte devolve a versão existente com `duplicate: true`, sem inserir outro registro. Novas importações não alteram os itens congelados de orçamentos e contratos anteriores. O parser no servidor interpreta o XML; o banco valida a forma do snapshot, o hash e os valores, mas não repete a interpretação do XML.

Recebimentos, reservas, pagamentos, estornos e cancelamento usam request_id, vinculado ao usuário e ao conteúdo. Repetir o comando devolve seu resultado; reutilizar a chave com outro conteúdo falha. Isso não substitui os bloqueios de linhas nem as restrições de saldo no banco.

Snapshots de versões XML, itens de orçamento, movimentos de estoque, baixas, estornos e auditoria são imutáveis. Os valores originais de contratos, pedidos e títulos também são protegidos. As RPCs só alteram estados, aprovações e contadores derivados autorizados; alteração direta do valor de um título não é uma forma de corrigir uma baixa.

## Regras desta fatia operacional

Novas revisões, novas compras e novas reservas exigem contrato ativo, com assinatura, aprovação comercial e aprovação financeira independentes. Cada nova revisão captura as versões executivas atuais. Se houver diferença em relação ao orçamento, a aprovação exige admin e justificativa explícita, sem alterar o valor contratado. Nova versão depois da revisão impede usar uma revisão desatualizada.

Pedido cancelado permanece no histórico. Reemitir compras exige iniciar uma nova revisão, inclusive quando o conteúdo executivo é idêntico. A criação de pedidos nunca devolve um pedido cancelado como uma compra ativa. Cancelamento de pedido ou contrato exige justificativa e é bloqueado quando há recebimento, entrega ou saldo de baixas não estornadas relacionado; os cancelamentos permitidos liberam reservas ativas e cancelam as previsões/títulos associados.

Recebimento aceita quantidades parciais e rejeita excesso sobre o pedido. A reserva exige saldo físico disponível e vínculo do item com uma compra ativa do contrato; a soma reservada/entregue não pode ultrapassar a quantidade da compra executiva. Concluir uma entrega consome todas as reservas ativas daquele contrato naquele momento. É possível realizar entregas parciais; concluir montagem exige que a quantidade total comprada tenha sido entregue. A agenda desta fatia atribui o compromisso ao usuário que o cria e bloqueia sobreposição de seus compromissos agendados.

O estoque físico é global por item/variante na loja. Um contrato pode ser entregue usando saldo recebido em outra compra. Por isso, as migrações 007/008 permitem finalizar a entrada de um pedido já existente mesmo com o contrato concluído, desde que assinatura e ambas as aprovações permaneçam registradas: um pedido em `draft` pode ter seu envio local registrado, passando a `sent`, e pedidos `sent` ou `partially_received` podem ser recebidos. O registro de envio não se comunica com fornecedores, e essas operações não reabrem o contrato. A exceção não autoriza nova revisão, compra ou reserva em contrato concluído.

Criação de orçamento, criação de contrato e conclusão de agenda usam o projeto como ponto comum de serialização. A conclusão bloqueia primeiro o projeto e depois o contrato; a criação de contrato bloqueia primeiro o projeto e depois o orçamento. O fechamento só ocorre após consultar novamente os contratos pendentes e os orçamentos em rascunho. Se a criação do orçamento vencer a disputa pelo lock, o fechamento verá o rascunho; se o fechamento vencer, a criação seguinte verá o projeto fechado e será recusada. Evita-se adquirir projeto depois de contrato/orçamento nessas operações.

Contrato cria uma previsão a receber única; sua aprovação financeira a transforma em título aberto. Cada compra com custo positivo cria uma previsão a pagar única, ativada explicitamente pelo financeiro. Essas previsões usam vencimento inicial de 30 dias nesta fatia. Título manual começa aberto. Baixas parciais reduzem o saldo; a baixa integral muda o estado para pago. Estorno interno restaura o saldo sem apagar a baixa e sem executar reembolso bancário.

Assistência pode existir com ou sem contrato, sempre vinculada a um cliente. Todas as ocorrências precisam ser resolvidas antes do encerramento. A indicação de responsável pelo custo registra a decisão, sem gerar cobrança ou compra automaticamente.

## Bootstrap de teste/demonstração

`supabase/tests/bootstrap.sql` simula SOMENTE auth.users, auth.uid() e papéis SQL em um PGlite vazio. Não execute esse arquivo contra um projeto Supabase. Execute depois as migrations, crie auth.users e atualize o perfil de teste para admin ativo. A migração de produção cria perfis inativos ao cadastrar um usuário; o primeiro admin é ativado por SQL administrativo, não por RPC pública.

Cada requisição de demo deve usar uma transação PGlite e `select set_config('request.jwt.claim.sub', '<uuid>', true)` DENTRO dessa transação. Não compartilhe identidade por SET global entre requisições concorrentes. Os testes exercitam RLS com SET LOCAL ROLE authenticated.

Somente a persistência de XML já interpretado usa `SET LOCAL ROLE service_role` na demonstração/testes, chamando o wrapper verificado com o ator conhecido. Os testes de banco simulam esse servidor confiável e fornecem os snapshots; a interpretação do XML é verificada pela suíte própria do parser. A suíte inclui rejeição de snapshot arbitrário via API autenticada, rejeição de ator financeiro/inativo no wrapper, recebimento tardio após entrega com estoque de outro contrato e preservação de projeto aberto quando existe orçamento pendente. A disputa real entre sessões independentes para criação/fechamento ainda precisa ser homologada em PostgreSQL/Supabase; PGlite serializa as transações locais.

## Limites de escopo

Esta fatia não emite notas, integra fábricas/bancos nem envia ordens externamente. `send_purchase_order` registra a decisão local de envio. Revisão executiva com diferença requer aceite explícito de admin e justificativa; não reajusta o valor do contrato do cliente. Contrato complementar, devolução física após entrega, reembolso externo, capacidade de equipes, comissões e integrações são extensões separadas. PGlite testa SQL e políticas localmente; não comprova gateway, Auth real, infraestrutura ou concorrência de múltiplas sessões do Supabase.
