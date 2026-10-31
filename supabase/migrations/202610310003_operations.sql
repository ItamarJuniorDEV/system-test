CREATE FUNCTION app_private.lock_approved_contract(p_contract_id uuid) RETURNS public.contracts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_contract public.contracts;
BEGIN
  SELECT * INTO v_contract FROM public.contracts WHERE id=p_contract_id FOR UPDATE;
  IF NOT FOUND OR v_contract.status<>'active' OR v_contract.signed_at IS NULL
    OR v_contract.commercial_approved_at IS NULL OR v_contract.financial_approved_at IS NULL THEN
    RAISE EXCEPTION 'Contrato exige assinatura e aprovações comercial e financeira ativas';
  END IF;
  RETURN v_contract;
END $$;

CREATE FUNCTION app_private.assert_current_review(p_snapshot jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_env jsonb; v_latest uuid;
BEGIN
  FOR v_env IN SELECT value FROM jsonb_array_elements(p_snapshot->'environments') ORDER BY value->>'environmentId' LOOP
    PERFORM id FROM public.environments WHERE id=(v_env->>'environmentId')::uuid FOR SHARE;
    SELECT id INTO v_latest FROM public.environment_versions WHERE environment_id=(v_env->>'environmentId')::uuid ORDER BY version_number DESC LIMIT 1;
    IF v_latest IS DISTINCT FROM (v_env->>'versionId')::uuid THEN
      RAISE EXCEPTION 'Revisão desatualizada: inicie nova revisão para considerar a versão mais recente';
    END IF;
  END LOOP;
END $$;

CREATE FUNCTION public.start_technical_review(p_contract_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_contract public.contracts; v_env public.environments; v_version public.environment_versions;
  v_row public.technical_reviews; v_original uuid; v_snapshot jsonb := '{"environments":[]}'; v_hash text;
  v_sale numeric := 0; v_cost numeric := 0; v_changed boolean := false; v_number integer;
BEGIN
  PERFORM app_private.require_role(ARRAY['operations']);
  v_contract := app_private.lock_approved_contract(p_contract_id);
  FOR v_env IN SELECT * FROM public.environments WHERE id IN
      (SELECT environment_id FROM public.budget_items WHERE budget_id=v_contract.budget_id) ORDER BY id FOR SHARE LOOP
    SELECT * INTO v_version FROM public.environment_versions WHERE environment_id=v_env.id ORDER BY version_number DESC LIMIT 1;
    SELECT environment_version_id INTO v_original FROM public.budget_items WHERE budget_id=v_contract.budget_id AND environment_id=v_env.id LIMIT 1;
    v_changed := v_changed OR v_version.id IS DISTINCT FROM v_original;
    v_sale := v_sale+v_version.sale_cents; v_cost := v_cost+v_version.cost_cents;
    v_snapshot := jsonb_set(v_snapshot,'{environments}',(v_snapshot->'environments') || jsonb_build_array(jsonb_build_object(
      'environmentId',v_env.id,'name',v_env.name,'supplierId',v_env.supplier_id,'versionId',v_version.id,'versionNumber',v_version.version_number,'snapshot',v_version.snapshot)));
  END LOOP;
  v_hash := encode(sha256(convert_to(v_snapshot::text,'UTF8')),'hex');
  SELECT * INTO v_row FROM public.technical_reviews WHERE contract_id=p_contract_id AND snapshot_hash=v_hash AND status<>'superseded';
  IF FOUND AND (NOT EXISTS(SELECT 1 FROM public.purchase_orders WHERE technical_review_id=v_row.id)
    OR EXISTS(SELECT 1 FROM public.purchase_orders WHERE technical_review_id=v_row.id AND status<>'cancelled')) THEN
    RETURN to_jsonb(v_row);
  END IF;
  IF EXISTS(SELECT 1 FROM public.purchase_orders WHERE contract_id=p_contract_id AND status<>'cancelled') THEN
    RAISE EXCEPTION 'Cancele os pedidos existentes antes de iniciar outra revisão';
  END IF;
  UPDATE public.technical_reviews SET status='superseded' WHERE contract_id=p_contract_id AND status<>'superseded';
  SELECT coalesce(max(revision_number),0)+1 INTO v_number FROM public.technical_reviews WHERE contract_id=p_contract_id;
  INSERT INTO public.technical_reviews(contract_id,revision_number,status,snapshot,snapshot_hash,sale_cents,cost_cents,difference_cents,has_difference)
  VALUES(p_contract_id,v_number,CASE WHEN v_changed OR v_sale<>v_contract.total_cents THEN 'blocked' ELSE 'pending' END,
    v_snapshot,v_hash,v_sale::bigint,v_cost::bigint,(v_sale-v_contract.total_cents)::bigint,v_changed OR v_sale<>v_contract.total_cents)
  RETURNING * INTO v_row;
  PERFORM app_private.audit('technical_review',v_row.id,'started',jsonb_build_object('contract_id',p_contract_id,'has_difference',v_row.has_difference,'difference_cents',v_row.difference_cents));
  RETURN to_jsonb(v_row);
END $$;

CREATE FUNCTION public.complete_technical_review(p_review_id uuid,p_accept_difference boolean DEFAULT false,p_reason text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.technical_reviews; v_contract uuid; v_actor uuid;
BEGIN
  v_actor := app_private.require_role(ARRAY['operations']);
  SELECT contract_id INTO v_contract FROM public.technical_reviews WHERE id=p_review_id;
  PERFORM app_private.lock_approved_contract(v_contract);
  SELECT * INTO v_row FROM public.technical_reviews WHERE id=p_review_id FOR UPDATE;
  IF NOT FOUND OR v_row.status='superseded' THEN RAISE EXCEPTION 'Revisão não está vigente'; END IF;
  IF v_row.status='approved' THEN RETURN to_jsonb(v_row); END IF;
  PERFORM app_private.assert_current_review(v_row.snapshot);
  IF v_row.has_difference THEN
    IF NOT coalesce(p_accept_difference,false) THEN RAISE EXCEPTION 'Diferença da versão executiva exige aceite explícito de administrador'; END IF;
    PERFORM app_private.require_role(ARRAY['admin']);
    IF length(btrim(coalesce(p_reason,'')))<10 THEN RAISE EXCEPTION 'Justificativa da diferença deve ter ao menos 10 caracteres'; END IF;
  END IF;
  UPDATE public.technical_reviews SET status='approved',approved_at=now(),approved_by=v_actor,
    difference_reason=CASE WHEN has_difference THEN btrim(p_reason) ELSE NULL END WHERE id=p_review_id RETURNING * INTO v_row;
  PERFORM app_private.audit('technical_review',v_row.id,'approved',jsonb_build_object('difference_cents',v_row.difference_cents,'reason',v_row.difference_reason));
  RETURN to_jsonb(v_row);
END $$;

CREATE FUNCTION public.create_purchase_order(p_review_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_review public.technical_reviews; v_order public.purchase_orders; v_supplier uuid; v_inventory uuid;
  v_contract uuid; v_env jsonb; v_item jsonb; v_orders jsonb;
BEGIN
  PERFORM app_private.require_role(ARRAY['operations']);
  SELECT contract_id INTO v_contract FROM public.technical_reviews WHERE id=p_review_id;
  PERFORM app_private.lock_approved_contract(v_contract);
  SELECT * INTO v_review FROM public.technical_reviews WHERE id=p_review_id FOR UPDATE;
  IF NOT FOUND OR v_review.status<>'approved' THEN RAISE EXCEPTION 'Revisão precisa estar aprovada antes da compra'; END IF;
  IF EXISTS(SELECT 1 FROM public.purchase_orders WHERE technical_review_id=p_review_id AND status='cancelled') THEN
    RAISE EXCEPTION 'Pedidos cancelados não são reaproveitados: cancele os demais pedidos e inicie nova revisão';
  END IF;
  SELECT jsonb_agg(to_jsonb(o) ORDER BY o.number) INTO v_orders FROM public.purchase_orders o WHERE technical_review_id=p_review_id;
  IF v_orders IS NOT NULL THEN RETURN jsonb_build_object('id',v_orders->0->>'id','orders',v_orders); END IF;
  PERFORM app_private.assert_current_review(v_review.snapshot);
  FOR v_supplier IN SELECT DISTINCT (e->>'supplierId')::uuid FROM jsonb_array_elements(v_review.snapshot->'environments') e ORDER BY 1 LOOP
    IF NOT EXISTS(SELECT 1 FROM public.suppliers WHERE id=v_supplier AND active) THEN RAISE EXCEPTION 'Fornecedor inativo impede nova compra'; END IF;
    INSERT INTO public.purchase_orders(technical_review_id,contract_id,supplier_id) VALUES(p_review_id,v_contract,v_supplier) RETURNING * INTO v_order;
    FOR v_env IN SELECT value FROM jsonb_array_elements(v_review.snapshot->'environments') WHERE (value->>'supplierId')::uuid=v_supplier LOOP
      FOR v_item IN SELECT value FROM jsonb_array_elements(v_env#>'{snapshot,items}') LOOP
        INSERT INTO public.inventory_items(supplier_id,code,description,unit,variant_key)
        VALUES(v_supplier,v_item->>'code',v_item->>'description',v_item->>'unit',coalesce(v_item#>>'{metadata,variantKey}',''))
        ON CONFLICT(supplier_id,code,unit,variant_key) DO UPDATE SET description=EXCLUDED.description RETURNING id INTO v_inventory;
        INSERT INTO public.stock_balances(inventory_item_id) VALUES(v_inventory) ON CONFLICT DO NOTHING;
        INSERT INTO public.purchase_order_items(purchase_order_id,inventory_item_id,environment_id,code,description,unit,quantity,unit_cost_cents)
        VALUES(v_order.id,v_inventory,(v_env->>'environmentId')::uuid,v_item->>'code',v_item->>'description',v_item->>'unit',(v_item->>'quantity')::numeric,(v_item->>'costCents')::bigint);
      END LOOP;
    END LOOP;
    UPDATE public.purchase_orders SET total_cents=(SELECT sum(total_cents) FROM public.purchase_order_items WHERE purchase_order_id=v_order.id)
      WHERE id=v_order.id RETURNING * INTO v_order;
    IF v_order.total_cents>0 THEN
      INSERT INTO public.financial_titles(direction,origin,contract_id,purchase_order_id,supplier_id,description,amount_cents,due_date,status)
      VALUES('payable','purchase_order',v_contract,v_order.id,v_supplier,'Pedido de compra '||v_order.number,v_order.total_cents,current_date+30,'forecast');
    END IF;
    PERFORM app_private.audit('purchase_order',v_order.id,'created',jsonb_build_object('technical_review_id',p_review_id,'total_cents',v_order.total_cents));
  END LOOP;
  SELECT jsonb_agg(to_jsonb(o) ORDER BY o.number) INTO v_orders FROM public.purchase_orders o WHERE technical_review_id=p_review_id;
  RETURN jsonb_build_object('id',v_orders->0->>'id','orders',v_orders);
END $$;

CREATE FUNCTION public.send_purchase_order(p_order_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_order public.purchase_orders; v_contract uuid;
BEGIN
  PERFORM app_private.require_role(ARRAY['operations']);
  SELECT contract_id INTO v_contract FROM public.purchase_orders WHERE id=p_order_id;
  PERFORM app_private.lock_approved_contract(v_contract);
  SELECT * INTO v_order FROM public.purchase_orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.status='cancelled' THEN RAISE EXCEPTION 'Pedido indisponível para envio'; END IF;
  IF v_order.status<>'draft' THEN RETURN to_jsonb(v_order); END IF;
  UPDATE public.purchase_orders SET status='sent',sent_at=now() WHERE id=p_order_id RETURNING * INTO v_order;
  PERFORM app_private.audit('purchase_order',v_order.id,'dispatch_recorded',jsonb_build_object('external_integration',false));
  RETURN to_jsonb(v_order);
END $$;

CREATE FUNCTION public.receive_purchase_order(p_order_id uuid,p_items jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor uuid; v_previous jsonb; v_order public.purchase_orders; v_contract uuid; v_line record;
  v_quantity numeric; v_count integer;
BEGIN
  v_actor := app_private.require_role(ARRAY['operations']);
  v_previous := app_private.command_result(v_actor,p_request_id,'receive_purchase_order',jsonb_build_object('order',p_order_id,'items',p_items));
  IF v_previous IS NOT NULL THEN RETURN v_previous; END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'Selecione itens para receber'; END IF;
  SELECT contract_id INTO v_contract FROM public.purchase_orders WHERE id=p_order_id;
  PERFORM app_private.lock_approved_contract(v_contract);
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

CREATE FUNCTION public.reserve_stock(p_contract_id uuid,p_items jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor uuid; v_previous jsonb; v_input jsonb; v_item uuid; v_quantity numeric; v_needed numeric; v_allocated numeric;
  v_balance public.stock_balances; v_reservation public.stock_reservations; v_reservations jsonb := '[]'; v_count integer;
BEGIN
  v_actor := app_private.require_role(ARRAY['operations']);
  v_previous := app_private.command_result(v_actor,p_request_id,'reserve_stock',jsonb_build_object('contract',p_contract_id,'items',p_items));
  IF v_previous IS NOT NULL THEN RETURN v_previous; END IF;
  PERFORM app_private.lock_approved_contract(p_contract_id);
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'Selecione itens para reservar'; END IF;
  SELECT count(DISTINCT x->>'inventoryItemId') INTO v_count FROM jsonb_array_elements(p_items) x;
  IF v_count<>jsonb_array_length(p_items) THEN RAISE EXCEPTION 'Não repita itens na reserva'; END IF;
  FOR v_input IN SELECT value FROM jsonb_array_elements(p_items) ORDER BY value->>'inventoryItemId' LOOP
    v_item := (v_input->>'inventoryItemId')::uuid;
    IF jsonb_typeof(v_input->'quantity') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Quantidade numérica obrigatória'; END IF;
    v_quantity := (v_input->>'quantity')::numeric;
    IF v_quantity<=0 OR v_quantity>1000000 OR round(v_quantity,4)<>v_quantity THEN RAISE EXCEPTION 'Quantidade de reserva inválida'; END IF;
    SELECT * INTO v_balance FROM public.stock_balances WHERE inventory_item_id=v_item FOR UPDATE;
    IF NOT FOUND OR v_balance.available<v_quantity THEN RAISE EXCEPTION 'Estoque disponível insuficiente'; END IF;
    SELECT coalesce(sum(i.quantity),0) INTO v_needed FROM public.purchase_order_items i JOIN public.purchase_orders o ON o.id=i.purchase_order_id
      WHERE o.contract_id=p_contract_id AND o.status<>'cancelled' AND i.inventory_item_id=v_item;
    SELECT coalesce(sum(quantity),0) INTO v_allocated FROM public.stock_reservations
      WHERE contract_id=p_contract_id AND inventory_item_id=v_item AND status IN ('active','fulfilled');
    IF v_needed=0 OR v_allocated+v_quantity>v_needed THEN RAISE EXCEPTION 'Reserva excede os itens pendentes do contrato'; END IF;
    UPDATE public.stock_balances SET reserved=reserved+v_quantity,updated_at=now() WHERE inventory_item_id=v_item;
    INSERT INTO public.stock_reservations(contract_id,inventory_item_id,quantity) VALUES(p_contract_id,v_item,v_quantity) RETURNING * INTO v_reservation;
    INSERT INTO public.stock_movements(inventory_item_id,contract_id,kind,reserved_delta) VALUES(v_item,p_contract_id,'reserve',v_quantity);
    v_reservations := v_reservations || jsonb_build_array(to_jsonb(v_reservation));
  END LOOP;
  PERFORM app_private.audit('contract',p_contract_id,'stock_reserved',jsonb_build_object('request_id',p_request_id,'items',p_items));
  RETURN app_private.finish_command(v_actor,p_request_id,jsonb_build_object('id',v_reservations->0->>'id','reservations',v_reservations));
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_private.has_role(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_technical_review(uuid),public.complete_technical_review(uuid,boolean,text),public.create_purchase_order(uuid),
  public.send_purchase_order(uuid),public.receive_purchase_order(uuid,jsonb,uuid),public.reserve_stock(uuid,jsonb,uuid) TO authenticated;
