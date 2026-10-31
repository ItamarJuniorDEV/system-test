-- Correct the trust boundary for XML persistence, allow pending receipts after
-- operational completion, and serialize project closure with budget/contract creation.

REVOKE ALL ON FUNCTION public.import_environment_version(uuid,text,text,text,jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON FUNCTION public.import_environment_version(uuid,text,text,text,jsonb) IS
  'Internal persistence only. Use the service-only verified wrapper after server-side XML parsing and verified user lookup.';

CREATE FUNCTION public.import_environment_version_verified(
  p_actor_id uuid, p_environment_id uuid, p_file_name text,
  p_raw_xml text, p_sha256 text, p_snapshot jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_previous_sub text := current_setting('request.jwt.claim.sub',true);
  v_previous_claims text := current_setting('request.jwt.claims',true);
  v_result jsonb;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'Usuário verificado obrigatório' USING ERRCODE='42501'; END IF;
  -- Service credentials authorize the transport; business permission and audit
  -- belong to the human actor verified by the server before calling this wrapper.
  PERFORM set_config('request.jwt.claim.sub',p_actor_id::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',p_actor_id,'role','authenticated')::text,true);
  v_result := public.import_environment_version(p_environment_id,p_file_name,p_raw_xml,p_sha256,p_snapshot);
  PERFORM set_config('request.jwt.claim.sub',coalesce(v_previous_sub,''),true);
  PERFORM set_config('request.jwt.claims',coalesce(v_previous_claims,''),true);
  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('request.jwt.claim.sub',coalesce(v_previous_sub,''),true);
  PERFORM set_config('request.jwt.claims',coalesce(v_previous_claims,''),true);
  RAISE;
END $$;
REVOKE ALL ON FUNCTION public.import_environment_version_verified(uuid,uuid,text,text,text,jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT EXECUTE ON FUNCTION public.import_environment_version_verified(uuid,uuid,text,text,text,jsonb) TO service_role;
COMMENT ON FUNCTION public.import_environment_version_verified(uuid,uuid,text,text,text,jsonb) IS
  'Trusted server only: verify user with Auth and derive snapshot by parsing XML before calling. Never expose service credentials or accept browser-supplied snapshots.';

-- Global stock may fulfill a contract before that contract's own purchase arrives.
-- Only receipt uses this helper. Review/new purchases/reservations stay active-only.
CREATE FUNCTION app_private.lock_contract_for_receipt(p_contract_id uuid) RETURNS public.contracts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_contract public.contracts;
BEGIN
  SELECT * INTO v_contract FROM public.contracts WHERE id=p_contract_id FOR UPDATE;
  IF NOT FOUND OR v_contract.status NOT IN ('active','completed') OR v_contract.signed_at IS NULL
    OR v_contract.commercial_approved_at IS NULL OR v_contract.financial_approved_at IS NULL THEN
    RAISE EXCEPTION 'Recebimento exige contrato ativo ou concluído, com assinatura e aprovações comercial e financeira';
  END IF;
  RETURN v_contract;
END $$;
REVOKE ALL ON FUNCTION app_private.lock_contract_for_receipt(uuid) FROM PUBLIC, anon, authenticated, service_role;


CREATE OR REPLACE FUNCTION public.receive_purchase_order(p_order_id uuid,p_items jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor uuid; v_previous jsonb; v_order public.purchase_orders; v_contract uuid; v_line record;
  v_quantity numeric; v_count integer;
BEGIN
  v_actor := app_private.require_role(ARRAY['operations']);
  v_previous := app_private.command_result(v_actor,p_request_id,'receive_purchase_order',jsonb_build_object('order',p_order_id,'items',p_items));
  IF v_previous IS NOT NULL THEN RETURN v_previous; END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'Selecione itens para receber'; END IF;
  SELECT contract_id INTO v_contract FROM public.purchase_orders WHERE id=p_order_id;
  PERFORM app_private.lock_contract_for_receipt(v_contract);
  SELECT * INTO v_order FROM public.purchase_orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.status NOT IN ('sent','partially_received') THEN RAISE EXCEPTION 'Pedido precisa estar enviado e possuir saldo pendente'; END IF;
  SELECT count(DISTINCT x->>'itemId') INTO v_count FROM jsonb_array_elements(p_items) x;
  IF v_count<>jsonb_array_length(p_items) THEN RAISE EXCEPTION 'Não repita itens no recebimento'; END IF;
  SELECT count(*) INTO v_count FROM jsonb_array_elements(p_items) x JOIN public.purchase_order_items i ON i.id=(x->>'itemId')::uuid AND i.purchase_order_id=p_order_id;
  IF v_count<>jsonb_array_length(p_items) THEN RAISE EXCEPTION 'Item não pertence ao pedido'; END IF;
  FOR v_line IN SELECT i.*,x.value AS input FROM jsonb_array_elements(p_items) x(value)
    JOIN public.purchase_order_items i ON i.id=(x.value->>'itemId')::uuid ORDER BY i.inventory_item_id,i.id FOR UPDATE OF i LOOP
    IF jsonb_typeof(v_line.input->'quantity') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Quantidade numérica obrigatória'; END IF;
    v_quantity := (v_line.input->>'quantity')::numeric;
    IF v_quantity<=0 OR v_quantity>1000000 OR round(v_quantity,4)<>v_quantity THEN RAISE EXCEPTION 'Quantidade de recebimento inválida'; END IF;
    IF v_quantity>v_line.quantity-v_line.received_quantity THEN RAISE EXCEPTION 'Recebimento excede a quantidade pendente'; END IF;
    PERFORM inventory_item_id FROM public.stock_balances WHERE inventory_item_id=v_line.inventory_item_id FOR UPDATE;
    UPDATE public.purchase_order_items SET received_quantity=received_quantity+v_quantity WHERE id=v_line.id;
    UPDATE public.stock_balances SET on_hand=on_hand+v_quantity,updated_at=now() WHERE inventory_item_id=v_line.inventory_item_id;
    INSERT INTO public.stock_movements(inventory_item_id,purchase_order_item_id,contract_id,kind,quantity_delta)
      VALUES(v_line.inventory_item_id,v_line.id,v_contract,'receipt',v_quantity);
  END LOOP;
  UPDATE public.purchase_orders SET status=CASE WHEN EXISTS(SELECT 1 FROM public.purchase_order_items WHERE purchase_order_id=p_order_id AND received_quantity<quantity)
    THEN 'partially_received' ELSE 'received' END WHERE id=p_order_id RETURNING * INTO v_order;
  PERFORM app_private.audit('purchase_order',p_order_id,'received',jsonb_build_object('request_id',p_request_id,'items',p_items,'status',v_order.status));
  RETURN app_private.finish_command(v_actor,p_request_id,to_jsonb(v_order));
END $$;

CREATE OR REPLACE FUNCTION public.create_contract(p_budget_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_budget public.budgets; v_row public.contracts; v_customer uuid; v_project public.projects; v_project_id uuid;
BEGIN
  PERFORM app_private.require_role(ARRAY['commercial']);
  -- Project -> budget -> new contract, consistent with budget creation and closure.
  SELECT project_id INTO v_project_id FROM public.budgets WHERE id=p_budget_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orçamento não encontrado'; END IF;
  SELECT * INTO v_project FROM public.projects WHERE id=v_project_id FOR UPDATE;
  SELECT * INTO v_budget FROM public.budgets WHERE id=p_budget_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orçamento não encontrado'; END IF;
  SELECT * INTO v_row FROM public.contracts WHERE budget_id=p_budget_id;
  IF FOUND THEN RETURN to_jsonb(v_row); END IF;
  IF v_project.status IN ('cancelled','closed') THEN RAISE EXCEPTION 'Projeto aberto obrigatório'; END IF;
  IF v_budget.status <> 'draft' OR v_budget.total_cents <= 0 THEN RAISE EXCEPTION 'Orçamento deve estar disponível e ter valor positivo'; END IF;
  SELECT customer_id INTO v_customer FROM public.projects WHERE id=v_budget.project_id;
  INSERT INTO public.contracts(budget_id,project_id,customer_id,total_cents)
    VALUES(p_budget_id,v_budget.project_id,v_customer,v_budget.total_cents) RETURNING * INTO v_row;
  UPDATE public.budgets SET status='contracted' WHERE id=p_budget_id;
  UPDATE public.projects SET status='in_progress' WHERE id=v_budget.project_id;
  INSERT INTO public.financial_titles(direction,origin,contract_id,customer_id,description,amount_cents,due_date,status)
    VALUES('receivable','contract',v_row.id,v_customer,'Contrato '||v_row.number,v_row.total_cents,current_date+30,'forecast');
  PERFORM app_private.audit('contract',v_row.id,'created',jsonb_build_object('budget_id',p_budget_id,'total_cents',v_row.total_cents));
  RETURN to_jsonb(v_row);
END $$;

CREATE OR REPLACE FUNCTION public.complete_appointment(p_appointment_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.appointments; v_contract public.contracts; v_reservation public.stock_reservations; v_count integer := 0; v_project_id uuid;
BEGIN
  PERFORM app_private.require_role(ARRAY['operations']);
  SELECT * INTO v_row FROM public.appointments WHERE id=p_appointment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Agenda não encontrada'; END IF;
  IF v_row.status='completed' THEN RETURN to_jsonb(v_row); END IF;
  -- Lock project before contract: a concurrent budget/contract creation either
  -- commits before this check or observes the closed project after waiting.
  SELECT project_id INTO v_project_id FROM public.contracts WHERE id=v_row.contract_id;
  PERFORM id FROM public.projects WHERE id=v_project_id FOR UPDATE;
  -- Another completion may have finished while the project lock was awaited.
  SELECT * INTO v_row FROM public.appointments WHERE id=p_appointment_id;
  IF v_row.status='completed' THEN RETURN to_jsonb(v_row); END IF;
  v_contract := app_private.lock_approved_contract(v_row.contract_id);
  SELECT * INTO v_row FROM public.appointments WHERE id=p_appointment_id FOR UPDATE;
  IF v_row.status='completed' THEN RETURN to_jsonb(v_row); END IF;
  IF v_row.status<>'scheduled' THEN RAISE EXCEPTION 'Agenda não está disponível para conclusão'; END IF;
  IF v_row.kind='delivery' THEN
    FOR v_reservation IN SELECT * FROM public.stock_reservations WHERE contract_id=v_row.contract_id AND status='active' ORDER BY inventory_item_id,id FOR UPDATE LOOP
      PERFORM inventory_item_id FROM public.stock_balances WHERE inventory_item_id=v_reservation.inventory_item_id FOR UPDATE;
      UPDATE public.stock_balances SET on_hand=on_hand-v_reservation.quantity,reserved=reserved-v_reservation.quantity,updated_at=now()
        WHERE inventory_item_id=v_reservation.inventory_item_id;
      UPDATE public.stock_reservations SET status='fulfilled',fulfilled_at=now() WHERE id=v_reservation.id;
      INSERT INTO public.stock_movements(inventory_item_id,contract_id,appointment_id,kind,quantity_delta,reserved_delta)
      VALUES(v_reservation.inventory_item_id,v_row.contract_id,v_row.id,'delivery',-v_reservation.quantity,-v_reservation.quantity);
      v_count := v_count+1;
    END LOOP;
    IF v_count=0 THEN RAISE EXCEPTION 'Reserve os itens antes de concluir a entrega'; END IF;
  ELSE
    IF NOT EXISTS(SELECT 1 FROM public.purchase_orders WHERE contract_id=v_row.contract_id AND status<>'cancelled') OR EXISTS(
      SELECT i.inventory_item_id FROM public.purchase_order_items i JOIN public.purchase_orders o ON o.id=i.purchase_order_id
      WHERE o.contract_id=v_row.contract_id AND o.status<>'cancelled' GROUP BY i.inventory_item_id
      HAVING sum(i.quantity)>coalesce((SELECT sum(r.quantity) FROM public.stock_reservations r WHERE r.contract_id=v_row.contract_id
        AND r.inventory_item_id=i.inventory_item_id AND r.status='fulfilled'),0)
    ) THEN RAISE EXCEPTION 'A montagem exige a entrega integral dos itens do contrato'; END IF;
    UPDATE public.contracts SET status='completed' WHERE id=v_row.contract_id;
    IF NOT EXISTS(SELECT 1 FROM public.contracts WHERE project_id=v_contract.project_id AND status NOT IN ('completed','cancelled'))
      AND NOT EXISTS(SELECT 1 FROM public.budgets WHERE project_id=v_contract.project_id AND status='draft') THEN
      UPDATE public.projects SET status='closed' WHERE id=v_contract.project_id;
    END IF;
  END IF;
  UPDATE public.appointments SET status='completed',completed_at=now() WHERE id=p_appointment_id RETURNING * INTO v_row;
  PERFORM app_private.audit('appointment',v_row.id,'completed',jsonb_build_object('kind',v_row.kind,'fulfilled_reservations',v_count));
  RETURN to_jsonb(v_row);
END $$;

-- Replacements retain authenticated grants; restate their intended ACL.
REVOKE ALL ON FUNCTION public.receive_purchase_order(uuid,jsonb,uuid),public.create_contract(uuid),public.complete_appointment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.receive_purchase_order(uuid,jsonb,uuid),public.create_contract(uuid),public.complete_appointment(uuid) TO authenticated;
