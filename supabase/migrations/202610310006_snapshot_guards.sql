-- Preserve business snapshots even against accidental direct administrative UPDATEs.
-- Authorized transitions still pass through RPCs; this is an additional integrity boundary.
CREATE FUNCTION app_private.guard_business_snapshot() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_mutable text[]; v_expected_sale numeric; v_expected_cost numeric; v_expected_paid numeric;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Histórico imutável: exclusão não permitida'; END IF;
  CASE TG_TABLE_NAME
    WHEN 'budgets' THEN
      v_mutable := ARRAY['status','total_cents','cost_cents'];
      IF NEW.total_cents IS DISTINCT FROM OLD.total_cents OR NEW.cost_cents IS DISTINCT FROM OLD.cost_cents THEN
        SELECT coalesce(sum(sale_cents),0),coalesce(sum(cost_cents),0) INTO v_expected_sale,v_expected_cost FROM public.budget_items WHERE budget_id=OLD.id;
        IF OLD.status='contracted' OR NEW.total_cents<>v_expected_sale OR NEW.cost_cents<>v_expected_cost THEN
          RAISE EXCEPTION 'Snapshot de orçamento imutável: totais devem vir dos itens congelados';
        END IF;
      END IF;
      IF OLD.status='contracted' AND NEW.status<>'contracted' THEN RAISE EXCEPTION 'Orçamento contratado é imutável'; END IF;
    WHEN 'contracts' THEN
      v_mutable := ARRAY['status','signed_at','commercial_approved_at','financial_approved_at','cancelled_at','cancellation_reason'];
    WHEN 'technical_reviews' THEN
      v_mutable := ARRAY['status','approved_at','approved_by','difference_reason'];
    WHEN 'purchase_orders' THEN
      v_mutable := ARRAY['status','sent_at','total_cents'];
      IF NEW.total_cents IS DISTINCT FROM OLD.total_cents THEN
        SELECT coalesce(sum(total_cents),0) INTO v_expected_cost FROM public.purchase_order_items WHERE purchase_order_id=OLD.id;
        IF OLD.status<>'draft' OR EXISTS(SELECT 1 FROM public.financial_titles WHERE purchase_order_id=OLD.id) OR NEW.total_cents<>v_expected_cost THEN
          RAISE EXCEPTION 'Snapshot de pedido imutável: total deve vir dos itens';
        END IF;
      END IF;
    WHEN 'purchase_order_items' THEN
      -- Generated columns are not populated in NEW during a BEFORE trigger.
      v_mutable := ARRAY['received_quantity','total_cents'];
    WHEN 'stock_reservations' THEN
      v_mutable := ARRAY['status','fulfilled_at','released_at'];
    WHEN 'appointments' THEN
      v_mutable := ARRAY['status','completed_at'];
    WHEN 'financial_titles' THEN
      v_mutable := ARRAY['status','paid_cents','balance_cents'];
      IF NEW.paid_cents IS DISTINCT FROM OLD.paid_cents THEN
        SELECT coalesce(sum(s.amount_cents),0) INTO v_expected_paid FROM public.settlements s
          WHERE s.financial_title_id=OLD.id AND NOT EXISTS(SELECT 1 FROM public.settlement_reversals r WHERE r.settlement_id=s.id);
        IF NEW.paid_cents<>v_expected_paid THEN RAISE EXCEPTION 'Histórico financeiro imutável: saldo deve corresponder às baixas e estornos'; END IF;
      END IF;
    ELSE
      RAISE EXCEPTION 'Tabela não reconhecida pela proteção de histórico';
  END CASE;
  IF (to_jsonb(NEW)-v_mutable) IS DISTINCT FROM (to_jsonb(OLD)-v_mutable) THEN
    RAISE EXCEPTION 'Snapshot imutável: campos originais não podem ser alterados';
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['budgets','contracts','technical_reviews','purchase_orders','purchase_order_items','stock_reservations','appointments','financial_titles'] LOOP
    EXECUTE format('CREATE TRIGGER protect_business_snapshot BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION app_private.guard_business_snapshot()',t);
  END LOOP;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_private.has_role(text[]) TO authenticated;
