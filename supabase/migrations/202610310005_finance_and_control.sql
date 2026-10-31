CREATE FUNCTION public.create_financial_title(p_direction text,p_description text,p_amount_cents bigint,p_due_date date,p_customer_id uuid DEFAULT NULL,p_supplier_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.financial_titles;
BEGIN
  PERFORM app_private.require_role(ARRAY['finance']);
  IF p_direction NOT IN ('receivable','payable') OR p_direction IS NULL THEN RAISE EXCEPTION 'Direção financeira inválida'; END IF;
  IF p_amount_cents IS NULL OR p_amount_cents NOT BETWEEN 1 AND 9000000000000000 THEN RAISE EXCEPTION 'Valor financeiro deve ser positivo em centavos'; END IF;
  IF (p_direction='receivable' AND (p_customer_id IS NULL OR p_supplier_id IS NOT NULL))
    OR (p_direction='payable' AND (p_supplier_id IS NULL OR p_customer_id IS NOT NULL)) THEN
    RAISE EXCEPTION 'Recebível exige cliente; pagamento exige fornecedor';
  END IF;
  INSERT INTO public.financial_titles(direction,origin,customer_id,supplier_id,description,amount_cents,due_date,status)
  VALUES(p_direction,'manual',p_customer_id,p_supplier_id,btrim(p_description),p_amount_cents,p_due_date,'open') RETURNING * INTO v_row;
  PERFORM app_private.audit('financial_title',v_row.id,'manual_created',jsonb_build_object('direction',p_direction,'amount_cents',p_amount_cents));
  RETURN to_jsonb(v_row);
END $$;

CREATE FUNCTION public.activate_financial_title(p_title_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.financial_titles;
BEGIN
  PERFORM app_private.require_role(ARRAY['finance']);
  SELECT * INTO v_row FROM public.financial_titles WHERE id=p_title_id FOR UPDATE;
  IF NOT FOUND OR v_row.status='cancelled' THEN RAISE EXCEPTION 'Título não está disponível'; END IF;
  IF v_row.status<>'forecast' THEN RETURN to_jsonb(v_row); END IF;
  IF v_row.origin='contract' AND NOT EXISTS(SELECT 1 FROM public.contracts WHERE id=v_row.contract_id AND financial_approved_at IS NOT NULL AND status<>'cancelled') THEN
    RAISE EXCEPTION 'Contrato ainda não possui aprovação financeira';
  END IF;
  IF v_row.origin='purchase_order' AND NOT EXISTS(SELECT 1 FROM public.purchase_orders WHERE id=v_row.purchase_order_id AND status<>'cancelled') THEN
    RAISE EXCEPTION 'Pedido não está ativo';
  END IF;
  UPDATE public.financial_titles SET status='open' WHERE id=p_title_id RETURNING * INTO v_row;
  PERFORM app_private.audit('financial_title',p_title_id,'activated');
  RETURN to_jsonb(v_row);
END $$;

CREATE FUNCTION public.settle_financial_title(p_title_id uuid,p_amount_cents bigint,p_paid_at date,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor uuid; v_previous jsonb; v_title public.financial_titles; v_payment public.settlements; v_paid bigint;
BEGIN
  v_actor := app_private.require_role(ARRAY['finance']);
  v_previous := app_private.command_result(v_actor,p_request_id,'settle_financial_title',jsonb_build_object('title',p_title_id,'amount',p_amount_cents,'date',p_paid_at));
  IF v_previous IS NOT NULL THEN RETURN v_previous; END IF;
  SELECT * INTO v_title FROM public.financial_titles WHERE id=p_title_id FOR UPDATE;
  IF NOT FOUND OR v_title.status NOT IN ('open','partially_paid') THEN RAISE EXCEPTION 'Somente títulos efetivos com saldo podem ser baixados'; END IF;
  IF p_amount_cents IS NULL OR p_amount_cents<=0 OR p_amount_cents>v_title.balance_cents THEN RAISE EXCEPTION 'Valor da baixa deve ser positivo e não exceder o saldo'; END IF;
  IF p_paid_at IS NULL THEN RAISE EXCEPTION 'Informe a data da baixa'; END IF;
  INSERT INTO public.settlements(financial_title_id,amount_cents,paid_at,request_id) VALUES(p_title_id,p_amount_cents,p_paid_at,p_request_id) RETURNING * INTO v_payment;
  v_paid := v_title.paid_cents+p_amount_cents;
  UPDATE public.financial_titles SET paid_cents=v_paid,status=CASE WHEN v_paid=amount_cents THEN 'paid' ELSE 'partially_paid' END
    WHERE id=p_title_id RETURNING * INTO v_title;
  PERFORM app_private.audit('financial_title',p_title_id,'settled',jsonb_build_object('settlement_id',v_payment.id,'amount_cents',p_amount_cents,'request_id',p_request_id));
  RETURN app_private.finish_command(v_actor,p_request_id,to_jsonb(v_payment) || jsonb_build_object('title',to_jsonb(v_title)));
END $$;

CREATE FUNCTION public.reverse_settlement(p_settlement_id uuid,p_reason text,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor uuid; v_previous jsonb; v_payment public.settlements; v_reversal public.settlement_reversals; v_title public.financial_titles; v_paid bigint;
BEGIN
  v_actor := app_private.require_role(ARRAY['finance']);
  IF length(btrim(coalesce(p_reason,'')))<5 THEN RAISE EXCEPTION 'Justifique o estorno com ao menos cinco caracteres'; END IF;
  v_previous := app_private.command_result(v_actor,p_request_id,'reverse_settlement',jsonb_build_object('settlement',p_settlement_id,'reason',p_reason));
  IF v_previous IS NOT NULL THEN RETURN v_previous; END IF;
  SELECT * INTO v_payment FROM public.settlements WHERE id=p_settlement_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Baixa não encontrada'; END IF;
  SELECT * INTO v_title FROM public.financial_titles WHERE id=v_payment.financial_title_id FOR UPDATE;
  SELECT * INTO v_reversal FROM public.settlement_reversals WHERE settlement_id=p_settlement_id;
  IF FOUND THEN RETURN app_private.finish_command(v_actor,p_request_id,to_jsonb(v_reversal) || jsonb_build_object('financial_title_id',v_title.id)); END IF;
  IF v_title.status NOT IN ('partially_paid','paid') OR v_title.paid_cents<v_payment.amount_cents THEN RAISE EXCEPTION 'Saldo incompatível com o estorno desta baixa'; END IF;
  INSERT INTO public.settlement_reversals(settlement_id,reason,request_id) VALUES(p_settlement_id,btrim(p_reason),p_request_id) RETURNING * INTO v_reversal;
  v_paid := v_title.paid_cents-v_payment.amount_cents;
  UPDATE public.financial_titles SET paid_cents=v_paid,status=CASE WHEN v_paid=0 THEN 'open' ELSE 'partially_paid' END
    WHERE id=v_title.id RETURNING * INTO v_title;
  PERFORM app_private.audit('financial_title',v_title.id,'settlement_reversed',jsonb_build_object('settlement_id',p_settlement_id,'reversal_id',v_reversal.id,'amount_cents',v_payment.amount_cents,'reason',btrim(p_reason)));
  RETURN app_private.finish_command(v_actor,p_request_id,to_jsonb(v_reversal) || jsonb_build_object('financial_title_id',v_title.id,'title',to_jsonb(v_title)));
END $$;

CREATE FUNCTION app_private.release_reservations(p_contract_id uuid,p_inventory_ids uuid[],p_reason text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.stock_reservations; v_count integer := 0;
BEGIN
  FOR v_row IN SELECT * FROM public.stock_reservations WHERE contract_id=p_contract_id AND status='active'
    AND (p_inventory_ids IS NULL OR inventory_item_id=ANY(p_inventory_ids)) ORDER BY inventory_item_id,id FOR UPDATE LOOP
    PERFORM inventory_item_id FROM public.stock_balances WHERE inventory_item_id=v_row.inventory_item_id FOR UPDATE;
    UPDATE public.stock_balances SET reserved=reserved-v_row.quantity,updated_at=now() WHERE inventory_item_id=v_row.inventory_item_id;
    UPDATE public.stock_reservations SET status='released',released_at=now() WHERE id=v_row.id;
    INSERT INTO public.stock_movements(inventory_item_id,contract_id,kind,reserved_delta,reason) VALUES(v_row.inventory_item_id,p_contract_id,'release',-v_row.quantity,p_reason);
    v_count := v_count+1;
  END LOOP;
  RETURN v_count;
END $$;

CREATE FUNCTION public.cancel_purchase_order(p_order_id uuid,p_reason text,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor uuid; v_previous jsonb; v_order public.purchase_orders; v_items uuid[]; v_released integer;
BEGIN
  v_actor := app_private.require_role(ARRAY['operations']);
  IF length(btrim(coalesce(p_reason,'')))<10 THEN RAISE EXCEPTION 'Justifique o cancelamento com ao menos dez caracteres'; END IF;
  v_previous := app_private.command_result(v_actor,p_request_id,'cancel_purchase_order',jsonb_build_object('order',p_order_id,'reason',p_reason));
  IF v_previous IS NOT NULL THEN RETURN v_previous; END IF;
  SELECT * INTO v_order FROM public.purchase_orders WHERE id=p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  PERFORM id FROM public.contracts WHERE id=v_order.contract_id FOR UPDATE;
  SELECT * INTO v_order FROM public.purchase_orders WHERE id=p_order_id FOR UPDATE;
  IF v_order.status='cancelled' THEN RETURN app_private.finish_command(v_actor,p_request_id,to_jsonb(v_order)); END IF;
  IF EXISTS(SELECT 1 FROM public.purchase_order_items WHERE purchase_order_id=p_order_id AND received_quantity>0) THEN
    RAISE EXCEPTION 'Pedido possui recebimento; devolução física não faz parte deste cancelamento';
  END IF;
  PERFORM id FROM public.financial_titles WHERE purchase_order_id=p_order_id ORDER BY id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.financial_titles WHERE purchase_order_id=p_order_id AND paid_cents>0) THEN
    RAISE EXCEPTION 'Estorne as baixas do pedido antes de cancelar';
  END IF;
  SELECT array_agg(DISTINCT inventory_item_id) INTO v_items FROM public.purchase_order_items WHERE purchase_order_id=p_order_id;
  IF EXISTS(SELECT 1 FROM public.stock_reservations WHERE contract_id=v_order.contract_id AND inventory_item_id=ANY(v_items) AND status='fulfilled') THEN
    RAISE EXCEPTION 'Itens já entregues exigem processo de devolução';
  END IF;
  v_released := app_private.release_reservations(v_order.contract_id,v_items,btrim(p_reason));
  UPDATE public.financial_titles SET status='cancelled' WHERE purchase_order_id=p_order_id AND status<>'cancelled';
  UPDATE public.purchase_orders SET status='cancelled' WHERE id=p_order_id RETURNING * INTO v_order;
  PERFORM app_private.audit('purchase_order',p_order_id,'cancelled',jsonb_build_object('reason',btrim(p_reason),'released_reservations',v_released,'external_integration',false));
  RETURN app_private.finish_command(v_actor,p_request_id,to_jsonb(v_order));
END $$;

CREATE FUNCTION public.cancel_contract(p_contract_id uuid,p_reason text,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor uuid; v_previous jsonb; v_contract public.contracts; v_released integer;
BEGIN
  v_actor := app_private.require_role(ARRAY['commercial']);
  IF length(btrim(coalesce(p_reason,'')))<10 THEN RAISE EXCEPTION 'Justifique o cancelamento com ao menos dez caracteres'; END IF;
  v_previous := app_private.command_result(v_actor,p_request_id,'cancel_contract',jsonb_build_object('contract',p_contract_id,'reason',p_reason));
  IF v_previous IS NOT NULL THEN RETURN v_previous; END IF;
  SELECT * INTO v_contract FROM public.contracts WHERE id=p_contract_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato não encontrado'; END IF;
  IF v_contract.status='cancelled' THEN RETURN app_private.finish_command(v_actor,p_request_id,to_jsonb(v_contract)); END IF;
  IF v_contract.status='completed' THEN RAISE EXCEPTION 'Contrato concluído exige processo de devolução'; END IF;
  PERFORM id FROM public.purchase_orders WHERE contract_id=p_contract_id ORDER BY id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.purchase_order_items i JOIN public.purchase_orders o ON o.id=i.purchase_order_id WHERE o.contract_id=p_contract_id AND i.received_quantity>0) THEN
    RAISE EXCEPTION 'Contrato possui recebimento; devolução física não faz parte deste cancelamento';
  END IF;
  IF EXISTS(SELECT 1 FROM public.stock_reservations WHERE contract_id=p_contract_id AND status='fulfilled') THEN
    RAISE EXCEPTION 'Contrato possui itens entregues; registre uma devolução';
  END IF;
  PERFORM id FROM public.financial_titles WHERE contract_id=p_contract_id ORDER BY id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.financial_titles WHERE contract_id=p_contract_id AND paid_cents>0) THEN
    RAISE EXCEPTION 'Estorne os pagamentos antes de cancelar o contrato';
  END IF;
  v_released := app_private.release_reservations(p_contract_id,NULL,btrim(p_reason));
  UPDATE public.purchase_orders SET status='cancelled' WHERE contract_id=p_contract_id AND status<>'cancelled';
  UPDATE public.financial_titles SET status='cancelled' WHERE contract_id=p_contract_id AND status<>'cancelled';
  UPDATE public.appointments SET status='cancelled' WHERE contract_id=p_contract_id AND status='scheduled';
  UPDATE public.technical_reviews SET status='superseded' WHERE contract_id=p_contract_id AND status<>'superseded';
  UPDATE public.contracts SET status='cancelled',cancelled_at=now(),cancellation_reason=btrim(p_reason) WHERE id=p_contract_id RETURNING * INTO v_contract;
  PERFORM app_private.audit('contract',p_contract_id,'cancelled',jsonb_build_object('reason',btrim(p_reason),'released_reservations',v_released,'request_id',p_request_id));
  RETURN app_private.finish_command(v_actor,p_request_id,to_jsonb(v_contract));
END $$;

CREATE FUNCTION public.set_user_profile(p_user_id uuid,p_name text,p_role text,p_active boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor uuid; v_before public.profiles; v_row public.profiles; v_admins integer;
BEGIN
  v_actor := app_private.require_role(ARRAY['admin']);
  IF p_role NOT IN ('admin','commercial','operations','finance') OR p_role IS NULL OR p_active IS NULL THEN RAISE EXCEPTION 'Perfil inválido'; END IF;
  IF length(btrim(coalesce(p_name,''))) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Informe o nome do usuário'; END IF;
  IF p_user_id=v_actor AND NOT p_active THEN RAISE EXCEPTION 'Não é permitida auto-desativação'; END IF;
  -- Serialize role changes, including two administrators trying to demote one another.
  LOCK TABLE public.profiles IN SHARE ROW EXCLUSIVE MODE;
  IF NOT app_private.has_role(ARRAY['admin']) THEN RAISE EXCEPTION 'Permissão de administrador necessária' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_before FROM public.profiles WHERE id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Usuário precisa ser convidado pelo Supabase Auth primeiro'; END IF;
  SELECT count(*) INTO v_admins FROM public.profiles WHERE active AND role='admin';
  IF v_before.active AND v_before.role='admin' AND (NOT p_active OR p_role<>'admin') AND v_admins<=1 THEN
    RAISE EXCEPTION 'Não é permitido remover o último administrador ativo';
  END IF;
  UPDATE public.profiles SET name=btrim(p_name),role=p_role,active=p_active,updated_at=now() WHERE id=p_user_id RETURNING * INTO v_row;
  PERFORM app_private.audit('profile',p_user_id,'access_changed',jsonb_build_object('previous_role',v_before.role,'previous_active',v_before.active,'role',p_role,'active',p_active));
  RETURN to_jsonb(v_row);
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_private.has_role(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_financial_title(text,text,bigint,date,uuid,uuid),public.activate_financial_title(uuid),
  public.settle_financial_title(uuid,bigint,date,uuid),public.reverse_settlement(uuid,text,uuid),public.cancel_purchase_order(uuid,text,uuid),
  public.cancel_contract(uuid,text,uuid),public.set_user_profile(uuid,text,text,boolean) TO authenticated;
