-- One-store operational core. Supabase Auth must exist before this migration.
CREATE SCHEMA app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'commercial' CHECK (role IN ('admin','commercial','operations','finance')),
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION app_private.on_auth_user_created() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles(id, name) VALUES (NEW.id, coalesce(split_part(NEW.email, '@', 1), 'Novo usuário'));
  RETURN NEW;
END $$;
CREATE TRIGGER create_inactive_profile AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION app_private.on_auth_user_created();
INSERT INTO public.profiles(id, name)
SELECT id, coalesce(split_part(email, '@', 1), 'Novo usuário') FROM auth.users
ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  document text, email text, phone text, notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id)
);
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  document text, email text, phone text, notes text,
  active boolean NOT NULL DEFAULT true,
  lead_days integer NOT NULL DEFAULT 7 CHECK (lead_days BETWEEN 1 AND 3650),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id)
);
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','closed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id)
);
CREATE TABLE public.environments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id)
);
CREATE TABLE public.environment_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id uuid NOT NULL REFERENCES public.environments(id),
  version_number integer NOT NULL CHECK (version_number > 0),
  file_name text NOT NULL CHECK (length(file_name) BETWEEN 1 AND 255),
  raw_xml text NOT NULL CHECK (octet_length(raw_xml) BETWEEN 1 AND 5242880),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  import_fingerprint text NOT NULL CHECK (import_fingerprint ~ '^[a-f0-9]{64}$'),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  cost_cents bigint NOT NULL CHECK (cost_cents BETWEEN 0 AND 9000000000000000),
  sale_cents bigint NOT NULL CHECK (sale_cents BETWEEN 0 AND 9000000000000000),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
  UNIQUE (environment_id, version_number),
  UNIQUE (environment_id, import_fingerprint)
);
CREATE TABLE public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','contracted')),
  total_cents bigint NOT NULL DEFAULT 0 CHECK (total_cents BETWEEN 0 AND 9000000000000000),
  cost_cents bigint NOT NULL DEFAULT 0 CHECK (cost_cents BETWEEN 0 AND 9000000000000000),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id)
);
CREATE TABLE public.budget_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES public.budgets(id),
  environment_id uuid NOT NULL REFERENCES public.environments(id),
  environment_version_id uuid NOT NULL REFERENCES public.environment_versions(id),
  source_item_index integer NOT NULL CHECK (source_item_index > 0),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  code text NOT NULL, description text NOT NULL, unit text NOT NULL,
  variant_key text NOT NULL DEFAULT '',
  quantity numeric(18,4) NOT NULL CHECK (quantity > 0 AND quantity <= 1000000),
  unit_cost_cents bigint NOT NULL CHECK (unit_cost_cents BETWEEN 0 AND 1000000000000),
  unit_sale_cents bigint NOT NULL CHECK (unit_sale_cents BETWEEN 0 AND 1000000000000),
  cost_cents bigint GENERATED ALWAYS AS (round(quantity * unit_cost_cents)::bigint) STORED,
  sale_cents bigint GENERATED ALWAYS AS (round(quantity * unit_sale_cents)::bigint) STORED,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
  UNIQUE (budget_id, environment_version_id, source_item_index),
  CHECK (cost_cents BETWEEN 0 AND 9000000000000000 AND sale_cents BETWEEN 0 AND 9000000000000000)
);
CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number bigint GENERATED BY DEFAULT AS IDENTITY UNIQUE,
  budget_id uuid NOT NULL UNIQUE REFERENCES public.budgets(id),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','completed','cancelled')),
  total_cents bigint NOT NULL CHECK (total_cents BETWEEN 1 AND 9000000000000000),
  signed_at timestamptz,
  commercial_approved_at timestamptz,
  financial_approved_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id)
);
CREATE TABLE public.technical_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id),
  revision_number integer NOT NULL CHECK (revision_number > 0),
  status text NOT NULL CHECK (status IN ('pending','blocked','approved','superseded')),
  snapshot jsonb NOT NULL,
  snapshot_hash text NOT NULL,
  sale_cents bigint NOT NULL CHECK (sale_cents BETWEEN 0 AND 9000000000000000),
  cost_cents bigint NOT NULL CHECK (cost_cents BETWEEN 0 AND 9000000000000000),
  difference_cents bigint NOT NULL,
  has_difference boolean NOT NULL,
  approved_at timestamptz,
  approved_by uuid REFERENCES public.profiles(id),
  difference_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
  UNIQUE (contract_id, revision_number)
);
CREATE UNIQUE INDEX technical_reviews_current ON public.technical_reviews(contract_id) WHERE status <> 'superseded';
CREATE INDEX technical_reviews_snapshot_idx ON public.technical_reviews(contract_id, snapshot_hash);
CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  code text NOT NULL, description text NOT NULL, unit text NOT NULL,
  variant_key text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
  UNIQUE (supplier_id, code, unit, variant_key)
);
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number bigint GENERATED BY DEFAULT AS IDENTITY UNIQUE,
  technical_review_id uuid NOT NULL REFERENCES public.technical_reviews(id),
  contract_id uuid NOT NULL REFERENCES public.contracts(id),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','partially_received','received','cancelled')),
  total_cents bigint NOT NULL DEFAULT 0 CHECK (total_cents BETWEEN 0 AND 9000000000000000),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
  UNIQUE (technical_review_id, supplier_id)
);
CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id),
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id),
  environment_id uuid NOT NULL REFERENCES public.environments(id),
  code text NOT NULL, description text NOT NULL, unit text NOT NULL,
  quantity numeric(18,4) NOT NULL CHECK (quantity > 0 AND quantity <= 1000000),
  received_quantity numeric(18,4) NOT NULL DEFAULT 0 CHECK (received_quantity >= 0 AND received_quantity <= quantity),
  unit_cost_cents bigint NOT NULL CHECK (unit_cost_cents BETWEEN 0 AND 1000000000000),
  total_cents bigint GENERATED ALWAYS AS (round(quantity * unit_cost_cents)::bigint) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
  CHECK (total_cents BETWEEN 0 AND 9000000000000000)
);
CREATE TABLE public.stock_balances (
  inventory_item_id uuid PRIMARY KEY REFERENCES public.inventory_items(id),
  on_hand numeric(18,4) NOT NULL DEFAULT 0,
  reserved numeric(18,4) NOT NULL DEFAULT 0,
  available numeric(18,4) GENERATED ALWAYS AS (on_hand - reserved) STORED,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (on_hand >= 0 AND reserved >= 0 AND reserved <= on_hand)
);
CREATE TABLE public.stock_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id),
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id),
  quantity numeric(18,4) NOT NULL CHECK (quantity > 0 AND quantity <= 1000000),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','fulfilled','released')),
  fulfilled_at timestamptz,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id)
);
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id),
  kind text NOT NULL CHECK (kind IN ('delivery','assembly')),
  assigned_to uuid NOT NULL REFERENCES public.profiles(id),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled')),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
  CHECK (ends_at > starts_at),
  UNIQUE (contract_id, kind, starts_at, ends_at)
);
CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id),
  purchase_order_item_id uuid REFERENCES public.purchase_order_items(id),
  contract_id uuid REFERENCES public.contracts(id),
  appointment_id uuid REFERENCES public.appointments(id),
  kind text NOT NULL CHECK (kind IN ('receipt','reserve','release','delivery')),
  quantity_delta numeric(18,4) NOT NULL DEFAULT 0,
  reserved_delta numeric(18,4) NOT NULL DEFAULT 0,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
  CHECK (quantity_delta <> 0 OR reserved_delta <> 0)
);
CREATE TABLE public.assistance_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES public.contracts(id),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 500),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id)
);
CREATE TABLE public.assistance_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.assistance_tickets(id),
  description text NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 2000),
  payer text NOT NULL CHECK (payer IN ('customer','store','factory','carrier')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
  CHECK (status <> 'resolved' OR length(btrim(resolution)) > 0)
);
CREATE TABLE public.financial_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number bigint GENERATED BY DEFAULT AS IDENTITY UNIQUE,
  direction text NOT NULL CHECK (direction IN ('receivable','payable')),
  origin text NOT NULL CHECK (origin IN ('manual','contract','purchase_order')),
  contract_id uuid REFERENCES public.contracts(id),
  purchase_order_id uuid REFERENCES public.purchase_orders(id),
  customer_id uuid REFERENCES public.customers(id),
  supplier_id uuid REFERENCES public.suppliers(id),
  description text NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 500),
  amount_cents bigint NOT NULL CHECK (amount_cents BETWEEN 1 AND 9000000000000000),
  paid_cents bigint NOT NULL DEFAULT 0 CHECK (paid_cents >= 0 AND paid_cents <= amount_cents),
  balance_cents bigint GENERATED ALWAYS AS (CASE WHEN status = 'cancelled' THEN 0 ELSE amount_cents - paid_cents END) STORED,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'forecast' CHECK (status IN ('forecast','open','partially_paid','paid','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
  CHECK ((direction = 'receivable' AND customer_id IS NOT NULL AND supplier_id IS NULL) OR
         (direction = 'payable' AND supplier_id IS NOT NULL AND customer_id IS NULL)),
  CHECK ((origin = 'contract' AND contract_id IS NOT NULL AND purchase_order_id IS NULL AND direction = 'receivable') OR
         (origin = 'purchase_order' AND purchase_order_id IS NOT NULL AND contract_id IS NOT NULL AND direction = 'payable') OR
         (origin = 'manual' AND purchase_order_id IS NULL AND contract_id IS NULL)),
  CHECK ((status IN ('forecast','open','cancelled') AND paid_cents = 0) OR
         (status = 'partially_paid' AND paid_cents > 0 AND paid_cents < amount_cents) OR
         (status = 'paid' AND paid_cents = amount_cents))
);
CREATE UNIQUE INDEX financial_title_contract_origin ON public.financial_titles(contract_id) WHERE origin = 'contract';
CREATE UNIQUE INDEX financial_title_purchase_origin ON public.financial_titles(purchase_order_id) WHERE origin = 'purchase_order';
CREATE TABLE public.settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_title_id uuid NOT NULL REFERENCES public.financial_titles(id),
  amount_cents bigint NOT NULL CHECK (amount_cents BETWEEN 1 AND 9000000000000000),
  paid_at date NOT NULL,
  request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
  UNIQUE (created_by, request_id)
);
CREATE TABLE public.settlement_reversals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id uuid NOT NULL UNIQUE REFERENCES public.settlements(id),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 5),
  request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
  UNIQUE (created_by, request_id)
);
CREATE TABLE public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id)
);
CREATE TABLE public.command_receipts (
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  request_id uuid NOT NULL,
  operation text NOT NULL,
  payload_hash text NOT NULL,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_id, request_id)
);

CREATE INDEX environments_project_idx ON public.environments(project_id);
CREATE INDEX budget_items_budget_idx ON public.budget_items(budget_id);
CREATE INDEX contracts_customer_idx ON public.contracts(customer_id);
CREATE INDEX purchase_orders_contract_idx ON public.purchase_orders(contract_id);
CREATE INDEX purchase_order_items_order_idx ON public.purchase_order_items(purchase_order_id);
CREATE INDEX stock_reservations_contract_idx ON public.stock_reservations(contract_id, status);
CREATE INDEX stock_movements_inventory_idx ON public.stock_movements(inventory_item_id, created_at);
CREATE INDEX appointments_schedule_idx ON public.appointments(assigned_to, starts_at, ends_at) WHERE status = 'scheduled';
CREATE INDEX assistance_occurrences_ticket_idx ON public.assistance_occurrences(ticket_id);
CREATE INDEX financial_titles_due_idx ON public.financial_titles(status, due_date);
CREATE INDEX settlements_title_idx ON public.settlements(financial_title_id);
CREATE INDEX audit_events_entity_idx ON public.audit_events(entity_type, entity_id, created_at);

CREATE FUNCTION app_private.has_role(p_roles text[] DEFAULT NULL) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND active
    AND (p_roles IS NULL OR role = 'admin' OR role = ANY(p_roles)));
$$;
CREATE FUNCTION app_private.require_role(p_roles text[]) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT app_private.has_role(p_roles) THEN
    RAISE EXCEPTION 'Usuário ativo e permissão adequada são obrigatórios' USING ERRCODE = '42501';
  END IF;
  RETURN v_actor;
END $$;
CREATE FUNCTION app_private.audit(p_entity text, p_id uuid, p_action text, p_details jsonb DEFAULT '{}') RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.audit_events(entity_type, entity_id, action, details) VALUES (p_entity, p_id, p_action, p_details);
$$;
CREATE FUNCTION app_private.immutable_history() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Histórico imutável: atualização ou exclusão não permitida';
END $$;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['environment_versions','budget_items','stock_movements','settlements','settlement_reversals','audit_events'] LOOP
    EXECUTE format('CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION app_private.immutable_history()', t);
  END LOOP;
END $$;

CREATE FUNCTION app_private.command_result(p_actor uuid, p_request_id uuid, p_operation text, p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.command_receipts; v_hash text;
BEGIN
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'request_id obrigatório'; END IF;
  v_hash := encode(sha256(convert_to(p_payload::text, 'UTF8')), 'hex');
  INSERT INTO public.command_receipts(actor_id, request_id, operation, payload_hash)
  VALUES (p_actor, p_request_id, p_operation, v_hash) ON CONFLICT DO NOTHING;
  SELECT * INTO v_row FROM public.command_receipts WHERE actor_id = p_actor AND request_id = p_request_id FOR UPDATE;
  IF v_row.operation <> p_operation OR v_row.payload_hash <> v_hash THEN
    RAISE EXCEPTION 'request_id já utilizado com outro conteúdo ou operação';
  END IF;
  RETURN v_row.result;
END $$;
CREATE FUNCTION app_private.finish_command(p_actor uuid, p_request_id uuid, p_result jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.command_receipts SET result = p_result WHERE actor_id = p_actor AND request_id = p_request_id;
  RETURN p_result;
END $$;

-- No browser-role table writes. Every exposed mutation goes through an authorized RPC.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    IF t NOT IN ('command_receipts','profiles','financial_titles','settlements','settlement_reversals','audit_events') THEN
      EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
      EXECUTE format('CREATE POLICY active_read ON public.%I FOR SELECT TO authenticated USING (app_private.has_role())', t);
    END IF;
  END LOOP;
END $$;
GRANT SELECT ON public.profiles, public.financial_titles, public.settlements, public.settlement_reversals, public.audit_events TO authenticated;
CREATE POLICY profile_read ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR app_private.has_role(ARRAY['admin']));
CREATE POLICY finance_read ON public.financial_titles FOR SELECT TO authenticated USING (app_private.has_role(ARRAY['finance']));
CREATE POLICY finance_read ON public.settlements FOR SELECT TO authenticated USING (app_private.has_role(ARRAY['finance']));
CREATE POLICY finance_read ON public.settlement_reversals FOR SELECT TO authenticated USING (app_private.has_role(ARRAY['finance']));
CREATE POLICY audit_read ON public.audit_events FOR SELECT TO authenticated
USING (app_private.has_role(ARRAY['admin']) OR (created_by = auth.uid() AND app_private.has_role()));
GRANT USAGE ON SCHEMA public, app_private TO authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_private.has_role(text[]) TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA app_private REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
