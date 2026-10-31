-- Read-only aggregates over all permitted rows. No pagination-dependent totals.
CREATE FUNCTION public.dashboard_metrics() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NOT app_private.has_role() THEN RAISE EXCEPTION 'Perfil ativo necessário' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object(
    'projects', (SELECT count(*) FROM public.projects WHERE status NOT IN ('closed','cancelled')),
    'contracts', (SELECT count(*) FROM public.contracts WHERE status IN ('draft','active')),
    'contracted_cents', (SELECT coalesce(sum(total_cents),0)::text FROM public.contracts WHERE status IN ('active','completed')),
    'pending_reviews', (SELECT count(*) FROM public.technical_reviews WHERE status IN ('pending','blocked')),
    'open_assistance', (SELECT count(*) FROM public.assistance_tickets WHERE status='open'),
    'scheduled_appointments', (SELECT count(*) FROM public.appointments WHERE status='scheduled'),
    'receivable_cents', (SELECT coalesce(sum(balance_cents),0)::text FROM public.financial_titles WHERE direction='receivable' AND status IN ('open','partially_paid')),
    'payable_cents', (SELECT coalesce(sum(balance_cents),0)::text FROM public.financial_titles WHERE direction='payable' AND status IN ('open','partially_paid'))
  );
END $$;
REVOKE ALL ON FUNCTION public.dashboard_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_metrics() TO authenticated;
