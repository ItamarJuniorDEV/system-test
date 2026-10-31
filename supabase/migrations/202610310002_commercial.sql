CREATE FUNCTION public.upsert_customer(p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.customers; v_id uuid := nullif(p_data->>'id', '')::uuid;
BEGIN
  PERFORM app_private.require_role(ARRAY['commercial','operations']);
  IF jsonb_typeof(p_data) <> 'object' THEN RAISE EXCEPTION 'Dados do cliente inválidos'; END IF;
  IF v_id IS NULL THEN
    INSERT INTO public.customers(name,document,email,phone,notes,active)
    VALUES (btrim(p_data->>'name'),p_data->>'document',p_data->>'email',p_data->>'phone',p_data->>'notes',coalesce((p_data->>'active')::boolean,true)) RETURNING * INTO v_row;
  ELSE
    SELECT * INTO v_row FROM public.customers WHERE id=v_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cliente não encontrado'; END IF;
    UPDATE public.customers SET name=coalesce(btrim(p_data->>'name'),name),
      document=CASE WHEN p_data?'document' THEN p_data->>'document' ELSE document END,
      email=CASE WHEN p_data?'email' THEN p_data->>'email' ELSE email END,
      phone=CASE WHEN p_data?'phone' THEN p_data->>'phone' ELSE phone END,
      notes=CASE WHEN p_data?'notes' THEN p_data->>'notes' ELSE notes END,
      active=coalesce((p_data->>'active')::boolean,active) WHERE id=v_id RETURNING * INTO v_row;
  END IF;
  PERFORM app_private.audit('customer',v_row.id,CASE WHEN v_id IS NULL THEN 'created' ELSE 'updated' END);
  RETURN to_jsonb(v_row);
END $$;

CREATE FUNCTION public.upsert_supplier(p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.suppliers; v_id uuid := nullif(p_data->>'id', '')::uuid;
BEGIN
  PERFORM app_private.require_role(ARRAY['commercial','operations']);
  IF jsonb_typeof(p_data) <> 'object' THEN RAISE EXCEPTION 'Dados do fornecedor inválidos'; END IF;
  IF v_id IS NULL THEN
    INSERT INTO public.suppliers(name,document,email,phone,notes,active,lead_days)
    VALUES (btrim(p_data->>'name'),p_data->>'document',p_data->>'email',p_data->>'phone',p_data->>'notes',coalesce((p_data->>'active')::boolean,true),coalesce((p_data->>'lead_days')::integer,7)) RETURNING * INTO v_row;
  ELSE
    SELECT * INTO v_row FROM public.suppliers WHERE id=v_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Fornecedor não encontrado'; END IF;
    UPDATE public.suppliers SET name=coalesce(btrim(p_data->>'name'),name),
      document=CASE WHEN p_data?'document' THEN p_data->>'document' ELSE document END,
      email=CASE WHEN p_data?'email' THEN p_data->>'email' ELSE email END,
      phone=CASE WHEN p_data?'phone' THEN p_data->>'phone' ELSE phone END,
      notes=CASE WHEN p_data?'notes' THEN p_data->>'notes' ELSE notes END,
      active=coalesce((p_data->>'active')::boolean,active),lead_days=coalesce((p_data->>'lead_days')::integer,lead_days)
    WHERE id=v_id RETURNING * INTO v_row;
  END IF;
  PERFORM app_private.audit('supplier',v_row.id,CASE WHEN v_id IS NULL THEN 'created' ELSE 'updated' END);
  RETURN to_jsonb(v_row);
END $$;

CREATE FUNCTION public.create_project(p_customer_id uuid, p_name text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.projects;
BEGIN
  PERFORM app_private.require_role(ARRAY['commercial']);
  IF NOT EXISTS(SELECT 1 FROM public.customers WHERE id=p_customer_id AND active) THEN RAISE EXCEPTION 'Cliente ativo obrigatório'; END IF;
  INSERT INTO public.projects(customer_id,name) VALUES(p_customer_id,btrim(p_name)) RETURNING * INTO v_row;
  PERFORM app_private.audit('project',v_row.id,'created');
  RETURN to_jsonb(v_row);
END $$;

CREATE FUNCTION public.create_environment(p_project_id uuid, p_supplier_id uuid, p_name text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.environments; v_project public.projects;
BEGIN
  PERFORM app_private.require_role(ARRAY['commercial','operations']);
  SELECT * INTO v_project FROM public.projects WHERE id=p_project_id FOR UPDATE;
  IF NOT FOUND OR v_project.status IN ('cancelled','closed') THEN RAISE EXCEPTION 'Projeto aberto obrigatório'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.suppliers WHERE id=p_supplier_id AND active) THEN RAISE EXCEPTION 'Fornecedor ativo obrigatório'; END IF;
  INSERT INTO public.environments(project_id,supplier_id,name) VALUES(p_project_id,p_supplier_id,btrim(p_name)) RETURNING * INTO v_row;
  PERFORM app_private.audit('environment',v_row.id,'created');
  RETURN to_jsonb(v_row);
END $$;

CREATE FUNCTION app_private.normalize_snapshot(p_snapshot jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_item jsonb; v_items jsonb := '[]'; v_quantity numeric; v_cost numeric; v_sale numeric; v_meta jsonb;
BEGIN
  IF p_snapshot IS NULL OR jsonb_typeof(p_snapshot) <> 'object' OR jsonb_typeof(p_snapshot->'items') <> 'array' THEN
    RAISE EXCEPTION 'Snapshot deve conter uma lista de itens';
  END IF;
  IF jsonb_array_length(p_snapshot->'items') NOT BETWEEN 1 AND 10000 OR octet_length(p_snapshot::text) > 5242880 THEN
    RAISE EXCEPTION 'Snapshot deve conter de 1 a 10000 itens e no máximo 5 MB';
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_snapshot->'items') LOOP
    IF jsonb_typeof(v_item) <> 'object' OR length(btrim(coalesce(v_item->>'code',''))) NOT BETWEEN 1 AND 120
      OR length(btrim(coalesce(v_item->>'description',''))) NOT BETWEEN 1 AND 500
      OR length(btrim(coalesce(v_item->>'unit',''))) NOT BETWEEN 1 AND 20 THEN
      RAISE EXCEPTION 'Cada item exige código, descrição e unidade válidos';
    END IF;
    IF jsonb_typeof(v_item->'quantity') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Quantidade numérica obrigatória'; END IF;
    v_quantity := (v_item->>'quantity')::numeric;
    IF v_quantity <= 0 OR v_quantity > 1000000 OR round(v_quantity,4) <> v_quantity THEN
      RAISE EXCEPTION 'Quantidade deve ser positiva, até 1000000 e com no máximo quatro decimais';
    END IF;
    IF jsonb_typeof(v_item->'costCents') IS DISTINCT FROM 'number' OR jsonb_typeof(v_item->'saleCents') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'Valores monetários devem ser centavos inteiros';
    END IF;
    v_cost := (v_item->>'costCents')::numeric; v_sale := (v_item->>'saleCents')::numeric;
    IF v_cost < 0 OR v_cost > 1000000000000 OR trunc(v_cost) <> v_cost OR v_sale < 0 OR v_sale > 1000000000000 OR trunc(v_sale) <> v_sale THEN
      RAISE EXCEPTION 'Valores monetários inválidos; use centavos inteiros não negativos';
    END IF;
    v_meta := coalesce(v_item->'metadata','{}'::jsonb);
    IF jsonb_typeof(v_meta) <> 'object' OR length(coalesce(v_meta->>'variantKey','')) > 500 THEN RAISE EXCEPTION 'Metadados do item inválidos'; END IF;
    IF v_meta?'variantKey' AND jsonb_typeof(v_meta->'variantKey') NOT IN ('string','null') THEN RAISE EXCEPTION 'variantKey deve ser texto'; END IF;
    IF nullif(btrim(v_meta->>'variantKey'),'') IS NULL AND (v_meta-'variantKey')<>'{}'::jsonb THEN
      v_meta := v_meta || jsonb_build_object('variantKey',encode(sha256(convert_to((v_meta-'variantKey')::text,'UTF8')),'hex'));
    END IF;
    v_items := v_items || jsonb_build_array(jsonb_build_object('code',btrim(v_item->>'code'),'description',btrim(v_item->>'description'),
      'quantity',v_quantity,'unit',upper(btrim(v_item->>'unit')),'costCents',v_cost::bigint,'saleCents',v_sale::bigint,'metadata',v_meta));
  END LOOP;
  RETURN (p_snapshot - 'items' - 'fingerprint') || jsonb_build_object('items',v_items);
END $$;

CREATE FUNCTION public.import_environment_version(p_environment_id uuid,p_file_name text,p_raw_xml text,p_sha256 text,p_snapshot jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.environment_versions; v_env public.environments; v_hash text; v_fingerprint text; v_snapshot jsonb;
  v_cost numeric; v_sale numeric; v_number integer;
BEGIN
  PERFORM app_private.require_role(ARRAY['commercial','operations']);
  SELECT * INTO v_env FROM public.environments WHERE id=p_environment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ambiente não encontrado'; END IF;
  IF p_raw_xml IS NULL OR octet_length(p_raw_xml) NOT BETWEEN 1 AND 5242880 OR left(ltrim(p_raw_xml,E' \t\r\n'||chr(65279)),1) <> '<' THEN
    RAISE EXCEPTION 'Arquivo XML vazio, inválido ou maior que 5 MB';
  END IF;
  v_hash := encode(sha256(convert_to(p_raw_xml,'UTF8')),'hex');
  IF lower(p_sha256) IS DISTINCT FROM v_hash THEN RAISE EXCEPTION 'Hash SHA-256 não corresponde ao arquivo XML'; END IF;
  v_snapshot := app_private.normalize_snapshot(p_snapshot);
  v_fingerprint := encode(sha256(convert_to(v_hash || ':' || v_snapshot::text,'UTF8')),'hex');
  SELECT * INTO v_row FROM public.environment_versions WHERE environment_id=p_environment_id AND import_fingerprint=v_fingerprint;
  IF FOUND THEN RETURN (to_jsonb(v_row)-'raw_xml') || jsonb_build_object('duplicate',true); END IF;
  SELECT sum(round((i->>'quantity')::numeric*(i->>'costCents')::numeric)), sum(round((i->>'quantity')::numeric*(i->>'saleCents')::numeric))
    INTO v_cost,v_sale FROM jsonb_array_elements(v_snapshot->'items') i;
  IF v_cost > 9000000000000000 OR v_sale > 9000000000000000 THEN RAISE EXCEPTION 'Total excede o limite monetário'; END IF;
  SELECT coalesce(max(version_number),0)+1 INTO v_number FROM public.environment_versions WHERE environment_id=p_environment_id;
  INSERT INTO public.environment_versions(environment_id,version_number,file_name,raw_xml,sha256,import_fingerprint,snapshot,cost_cents,sale_cents)
  VALUES(p_environment_id,v_number,p_file_name,p_raw_xml,v_hash,v_fingerprint,v_snapshot || jsonb_build_object('fingerprint',v_fingerprint),v_cost::bigint,v_sale::bigint)
  RETURNING * INTO v_row;
  PERFORM app_private.audit('environment_version',v_row.id,'imported',jsonb_build_object('environment_id',p_environment_id,'version_number',v_number,'sha256',v_hash,'item_count',jsonb_array_length(v_snapshot->'items')));
  RETURN to_jsonb(v_row)-'raw_xml';
END $$;

CREATE FUNCTION public.create_budget(p_project_id uuid,p_name text,p_environment_ids uuid[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.budgets; v_project public.projects; v_env public.environments; v_version public.environment_versions; v_item record; v_count integer;
BEGIN
  PERFORM app_private.require_role(ARRAY['commercial']);
  SELECT * INTO v_project FROM public.projects WHERE id=p_project_id FOR UPDATE;
  IF NOT FOUND OR v_project.status IN ('cancelled','closed') THEN RAISE EXCEPTION 'Projeto aberto obrigatório'; END IF;
  IF p_environment_ids IS NULL OR cardinality(p_environment_ids) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Selecione de 1 a 100 ambientes'; END IF;
  SELECT count(DISTINCT id) INTO v_count FROM unnest(p_environment_ids) id;
  IF v_count <> cardinality(p_environment_ids) THEN RAISE EXCEPTION 'Ambientes duplicados na seleção'; END IF;
  SELECT count(*) INTO v_count FROM public.environments WHERE id=ANY(p_environment_ids) AND project_id=p_project_id;
  IF v_count <> cardinality(p_environment_ids) THEN RAISE EXCEPTION 'Todos os ambientes devem pertencer ao projeto'; END IF;
  INSERT INTO public.budgets(project_id,name) VALUES(p_project_id,btrim(p_name)) RETURNING * INTO v_row;
  FOR v_env IN SELECT * FROM public.environments WHERE id=ANY(p_environment_ids) ORDER BY id FOR SHARE LOOP
    SELECT * INTO v_version FROM public.environment_versions WHERE environment_id=v_env.id ORDER BY version_number DESC LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'Ambiente % não possui versão importada',v_env.name; END IF;
    FOR v_item IN SELECT value,ordinality FROM jsonb_array_elements(v_version.snapshot->'items') WITH ORDINALITY LOOP
      INSERT INTO public.budget_items(budget_id,environment_id,environment_version_id,source_item_index,supplier_id,code,description,unit,variant_key,quantity,unit_cost_cents,unit_sale_cents,metadata)
      VALUES(v_row.id,v_env.id,v_version.id,v_item.ordinality,v_env.supplier_id,v_item.value->>'code',v_item.value->>'description',v_item.value->>'unit',
        coalesce(v_item.value#>>'{metadata,variantKey}',''),(v_item.value->>'quantity')::numeric,(v_item.value->>'costCents')::bigint,(v_item.value->>'saleCents')::bigint,v_item.value->'metadata');
    END LOOP;
  END LOOP;
  UPDATE public.budgets SET total_cents=(SELECT sum(sale_cents) FROM public.budget_items WHERE budget_id=v_row.id),
    cost_cents=(SELECT sum(cost_cents) FROM public.budget_items WHERE budget_id=v_row.id)
    WHERE id=v_row.id RETURNING * INTO v_row;
  PERFORM app_private.audit('budget',v_row.id,'snapshot_created',jsonb_build_object('total_cents',v_row.total_cents,'environment_ids',to_jsonb(p_environment_ids)));
  RETURN to_jsonb(v_row);
END $$;

CREATE FUNCTION public.create_contract(p_budget_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_budget public.budgets; v_row public.contracts; v_customer uuid;
BEGIN
  PERFORM app_private.require_role(ARRAY['commercial']);
  SELECT * INTO v_budget FROM public.budgets WHERE id=p_budget_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orçamento não encontrado'; END IF;
  SELECT * INTO v_row FROM public.contracts WHERE budget_id=p_budget_id;
  IF FOUND THEN RETURN to_jsonb(v_row); END IF;
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

CREATE FUNCTION public.set_contract_approval(p_contract_id uuid,p_approval text,p_approved boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.contracts; v_stamp timestamptz;
BEGIN
  IF p_approval IN ('signature','commercial') THEN PERFORM app_private.require_role(ARRAY['commercial']);
  ELSIF p_approval='financial' THEN PERFORM app_private.require_role(ARRAY['finance']);
  ELSE RAISE EXCEPTION 'Tipo de aprovação inválido'; END IF;
  IF p_approved IS NULL THEN RAISE EXCEPTION 'Informe se a aprovação está concedida'; END IF;
  SELECT * INTO v_row FROM public.contracts WHERE id=p_contract_id FOR UPDATE;
  IF NOT FOUND OR v_row.status IN ('cancelled','completed') THEN RAISE EXCEPTION 'Contrato não permite alteração de aprovação'; END IF;
  IF NOT p_approved AND EXISTS(SELECT 1 FROM public.purchase_orders WHERE contract_id=p_contract_id AND status<>'cancelled') THEN
    RAISE EXCEPTION 'Cancele os pedidos vinculados antes de retirar a aprovação';
  END IF;
  IF p_approval='financial' THEN
    PERFORM id FROM public.financial_titles WHERE contract_id=p_contract_id ORDER BY id FOR UPDATE;
    IF NOT p_approved AND EXISTS(SELECT 1 FROM public.financial_titles WHERE contract_id=p_contract_id AND paid_cents>0) THEN
      RAISE EXCEPTION 'Estorne os pagamentos antes de retirar a aprovação financeira';
    END IF;
  END IF;
  v_stamp := CASE WHEN p_approved THEN now() ELSE NULL END;
  UPDATE public.contracts SET
    signed_at=CASE WHEN p_approval='signature' THEN CASE WHEN p_approved THEN coalesce(signed_at,v_stamp) ELSE NULL END ELSE signed_at END,
    commercial_approved_at=CASE WHEN p_approval='commercial' THEN CASE WHEN p_approved THEN coalesce(commercial_approved_at,v_stamp) ELSE NULL END ELSE commercial_approved_at END,
    financial_approved_at=CASE WHEN p_approval='financial' THEN CASE WHEN p_approved THEN coalesce(financial_approved_at,v_stamp) ELSE NULL END ELSE financial_approved_at END
  WHERE id=p_contract_id RETURNING * INTO v_row;
  UPDATE public.contracts SET status=CASE WHEN signed_at IS NOT NULL AND commercial_approved_at IS NOT NULL AND financial_approved_at IS NOT NULL THEN 'active' ELSE 'draft' END
    WHERE id=p_contract_id RETURNING * INTO v_row;
  IF p_approval='financial' THEN
    UPDATE public.financial_titles SET status=CASE WHEN p_approved THEN 'open' ELSE 'forecast' END
      WHERE contract_id=p_contract_id AND origin='contract' AND status IN ('forecast','open');
  END IF;
  PERFORM app_private.audit('contract',v_row.id,'approval_changed',jsonb_build_object('approval',p_approval,'approved',p_approved));
  RETURN to_jsonb(v_row);
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_private.has_role(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_customer(jsonb), public.upsert_supplier(jsonb), public.create_project(uuid,text), public.create_environment(uuid,uuid,text),
  public.import_environment_version(uuid,text,text,text,jsonb), public.create_budget(uuid,text,uuid[]), public.create_contract(uuid), public.set_contract_approval(uuid,text,boolean) TO authenticated;
