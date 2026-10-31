CREATE FUNCTION public.create_appointment(p_contract_id uuid,p_kind text,p_starts_at timestamptz,p_ends_at timestamptz,p_notes text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor uuid; v_row public.appointments;
BEGIN
  v_actor := app_private.require_role(ARRAY['operations']);
  PERFORM app_private.lock_approved_contract(p_contract_id);
  IF p_kind NOT IN ('delivery','assembly') OR p_kind IS NULL THEN RAISE EXCEPTION 'Tipo de agenda inválido'; END IF;
  IF p_starts_at IS NULL OR p_ends_at IS NULL OR p_ends_at<=p_starts_at THEN RAISE EXCEPTION 'Informe início e fim válidos'; END IF;
  -- In this slice the creator is also the assignee. Locking that profile serializes their schedule checks.
  PERFORM id FROM public.profiles WHERE id=v_actor FOR UPDATE;
  SELECT * INTO v_row FROM public.appointments WHERE contract_id=p_contract_id AND kind=p_kind AND starts_at=p_starts_at AND ends_at=p_ends_at;
  IF FOUND THEN RETURN to_jsonb(v_row); END IF;
  IF EXISTS(SELECT 1 FROM public.appointments WHERE assigned_to=v_actor AND status='scheduled' AND starts_at<p_ends_at AND ends_at>p_starts_at) THEN
    RAISE EXCEPTION 'Conflito de horário com outra agenda do responsável';
  END IF;
  INSERT INTO public.appointments(contract_id,kind,assigned_to,starts_at,ends_at,notes)
    VALUES(p_contract_id,p_kind,v_actor,p_starts_at,p_ends_at,p_notes) RETURNING * INTO v_row;
  PERFORM app_private.audit('appointment',v_row.id,'scheduled',jsonb_build_object('kind',p_kind,'contract_id',p_contract_id));
  RETURN to_jsonb(v_row);
END $$;

CREATE FUNCTION public.complete_appointment(p_appointment_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.appointments; v_contract public.contracts; v_reservation public.stock_reservations; v_count integer := 0;
BEGIN
  PERFORM app_private.require_role(ARRAY['operations']);
  SELECT * INTO v_row FROM public.appointments WHERE id=p_appointment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Agenda não encontrada'; END IF;
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

CREATE FUNCTION public.open_assistance(p_contract_id uuid,p_customer_id uuid,p_title text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.assistance_tickets; v_customer uuid := p_customer_id; v_contract_customer uuid;
BEGIN
  PERFORM app_private.require_role(ARRAY['operations','commercial']);
  IF p_contract_id IS NOT NULL THEN
    SELECT customer_id INTO v_contract_customer FROM public.contracts WHERE id=p_contract_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Contrato não encontrado'; END IF;
    IF v_customer IS NOT NULL AND v_customer<>v_contract_customer THEN RAISE EXCEPTION 'Cliente da assistência diverge do contrato'; END IF;
    v_customer := v_contract_customer;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.customers WHERE id=v_customer) THEN RAISE EXCEPTION 'Cliente obrigatório'; END IF;
  INSERT INTO public.assistance_tickets(contract_id,customer_id,title) VALUES(p_contract_id,v_customer,btrim(p_title)) RETURNING * INTO v_row;
  PERFORM app_private.audit('assistance_ticket',v_row.id,'opened',jsonb_build_object('contract_id',p_contract_id));
  RETURN to_jsonb(v_row);
END $$;

CREATE FUNCTION public.add_assistance_occurrence(p_ticket_id uuid,p_description text,p_payer text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_ticket public.assistance_tickets; v_row public.assistance_occurrences;
BEGIN
  PERFORM app_private.require_role(ARRAY['operations']);
  SELECT * INTO v_ticket FROM public.assistance_tickets WHERE id=p_ticket_id FOR UPDATE;
  IF NOT FOUND OR v_ticket.status<>'open' THEN RAISE EXCEPTION 'Assistência inexistente ou encerrada'; END IF;
  INSERT INTO public.assistance_occurrences(ticket_id,description,payer) VALUES(p_ticket_id,btrim(p_description),p_payer) RETURNING * INTO v_row;
  PERFORM app_private.audit('assistance_occurrence',v_row.id,'created',jsonb_build_object('ticket_id',p_ticket_id,'payer',p_payer));
  RETURN to_jsonb(v_row);
END $$;

CREATE FUNCTION public.resolve_assistance_occurrence(p_occurrence_id uuid,p_resolution text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_ticket uuid; v_row public.assistance_occurrences;
BEGIN
  PERFORM app_private.require_role(ARRAY['operations']);
  SELECT ticket_id INTO v_ticket FROM public.assistance_occurrences WHERE id=p_occurrence_id;
  PERFORM id FROM public.assistance_tickets WHERE id=v_ticket AND status='open' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assistência inexistente ou encerrada'; END IF;
  SELECT * INTO v_row FROM public.assistance_occurrences WHERE id=p_occurrence_id FOR UPDATE;
  IF v_row.status='resolved' THEN
    IF v_row.resolution IS DISTINCT FROM btrim(p_resolution) THEN RAISE EXCEPTION 'Ocorrência resolvida não pode ser alterada'; END IF;
    RETURN to_jsonb(v_row);
  END IF;
  IF length(btrim(coalesce(p_resolution,''))) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Descreva a solução da ocorrência'; END IF;
  UPDATE public.assistance_occurrences SET status='resolved',resolution=btrim(p_resolution),resolved_at=now() WHERE id=p_occurrence_id RETURNING * INTO v_row;
  PERFORM app_private.audit('assistance_occurrence',v_row.id,'resolved');
  RETURN to_jsonb(v_row);
END $$;

CREATE FUNCTION public.close_assistance(p_ticket_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.assistance_tickets;
BEGIN
  PERFORM app_private.require_role(ARRAY['operations']);
  SELECT * INTO v_row FROM public.assistance_tickets WHERE id=p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assistência não encontrada'; END IF;
  IF v_row.status='closed' THEN RETURN to_jsonb(v_row); END IF;
  IF NOT EXISTS(SELECT 1 FROM public.assistance_occurrences WHERE ticket_id=p_ticket_id) OR EXISTS(
    SELECT 1 FROM public.assistance_occurrences WHERE ticket_id=p_ticket_id AND status<>'resolved'
  ) THEN RAISE EXCEPTION 'Todas as ocorrências devem estar resolvidas antes de encerrar'; END IF;
  UPDATE public.assistance_tickets SET status='closed',closed_at=now() WHERE id=p_ticket_id RETURNING * INTO v_row;
  PERFORM app_private.audit('assistance_ticket',v_row.id,'closed');
  RETURN to_jsonb(v_row);
END $$;

GRANT EXECUTE ON FUNCTION public.create_appointment(uuid,text,timestamptz,timestamptz,text),public.complete_appointment(uuid),
  public.open_assistance(uuid,uuid,text),public.add_assistance_occurrence(uuid,text,text),public.resolve_assistance_occurrence(uuid,text),public.close_assistance(uuid) TO authenticated;
