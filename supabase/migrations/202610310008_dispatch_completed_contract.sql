-- Global stock may fulfill a contract while its existing purchase is still draft.
-- Permit recording that order's dispatch after completion, under the same three
-- approvals as a late receipt. Creating new purchases remains active-only.
CREATE OR REPLACE FUNCTION public.send_purchase_order(p_order_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_order public.purchase_orders; v_contract uuid;
BEGIN
  PERFORM app_private.require_role(ARRAY['operations']);
  SELECT contract_id INTO v_contract FROM public.purchase_orders WHERE id=p_order_id;
  PERFORM app_private.lock_contract_for_receipt(v_contract);
  SELECT * INTO v_order FROM public.purchase_orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.status='cancelled' THEN RAISE EXCEPTION 'Pedido indisponível para envio'; END IF;
  IF v_order.status<>'draft' THEN RETURN to_jsonb(v_order); END IF;
  UPDATE public.purchase_orders SET status='sent',sent_at=now() WHERE id=p_order_id RETURNING * INTO v_order;
  PERFORM app_private.audit('purchase_order',v_order.id,'dispatch_recorded',jsonb_build_object('external_integration',false));
  RETURN to_jsonb(v_order);
END $$;
REVOKE ALL ON FUNCTION public.send_purchase_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_purchase_order(uuid) TO authenticated;
