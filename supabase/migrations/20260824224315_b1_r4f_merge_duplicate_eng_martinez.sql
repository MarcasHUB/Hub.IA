-- B1-R.4F.2 Merge Engenharia Martinez

DO $$
DECLARE
  v_canonical_id uuid := '443a272a-e960-4d55-8be9-3babde9bbb5a';
  v_duplicate_id uuid := '4aa73909-fe5c-4b35-876e-79202b7b79c4';
  v_count integer;
  v_cnpj_canonical text;
  v_cnpj_duplicate text;
BEGIN
  -- 1. Confirm that both exist
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_canonical_id) THEN
    RAISE EXCEPTION 'Canonical organization not found';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_duplicate_id) THEN
    -- If duplicate is already merged/deleted, just exit
    RETURN;
  END IF;

  -- 2. Confirm CNPJs are the same and match expected
  SELECT regexp_replace(coalesce(cnpj, ''), '[^0-9]', '', 'g') INTO v_cnpj_canonical
  FROM public.organizations WHERE id = v_canonical_id;

  SELECT regexp_replace(coalesce(cnpj, ''), '[^0-9]', '', 'g') INTO v_cnpj_duplicate
  FROM public.organizations WHERE id = v_duplicate_id;

  IF v_cnpj_canonical != v_cnpj_duplicate OR v_cnpj_canonical != '01001002000102' THEN
    RAISE EXCEPTION 'CNPJ mismatch or not expected % vs %', v_cnpj_canonical, v_cnpj_duplicate;
  END IF;

  -- 3. Reapontar dependencias

  -- Profiles
  UPDATE public.profiles SET organization_id = v_canonical_id 
  WHERE organization_id = v_duplicate_id;

  -- Operators
  UPDATE public.operators SET organization_id = v_canonical_id 
  WHERE organization_id = v_duplicate_id;

  -- User Roles
  UPDATE public.user_roles SET organization_id = v_canonical_id 
  WHERE organization_id = v_duplicate_id;

  -- Connection Requests
  UPDATE public.connection_requests SET requester_company_id = v_canonical_id 
  WHERE requester_company_id = v_duplicate_id;

  UPDATE public.connection_requests SET target_company_id = v_canonical_id 
  WHERE target_company_id = v_duplicate_id;

  -- Outras possíveis tabelas baseadas no schema
  UPDATE public.categories SET organization_id = v_canonical_id WHERE organization_id = v_duplicate_id;
  UPDATE public.products SET organization_id = v_canonical_id WHERE organization_id = v_duplicate_id;
  UPDATE public.quotation_requests SET organization_id = v_canonical_id WHERE organization_id = v_duplicate_id;
  UPDATE public.product_offers SET organization_id = v_canonical_id WHERE organization_id = v_duplicate_id;
  UPDATE public.organization_invites SET organization_id = v_canonical_id WHERE organization_id = v_duplicate_id;
  UPDATE public.product_suppliers SET organization_id = v_canonical_id WHERE organization_id = v_duplicate_id;
  UPDATE public.invitations SET organization_id = v_canonical_id WHERE organization_id = v_duplicate_id;
  UPDATE public.operator_invitations SET organization_id = v_canonical_id WHERE organization_id = v_duplicate_id;
  UPDATE public.delegations SET organization_id = v_canonical_id WHERE organization_id = v_duplicate_id;
  
  -- Para tabelas de junção, usar DELETE se causar UNIQUE VIOLATION
  -- company_segments
  -- organization_segments
  -- empresa_parceiros (organization_id, partner_id)

  -- organization_segments
  UPDATE public.organization_segments SET organization_id = v_canonical_id WHERE organization_id = v_duplicate_id 
  AND NOT EXISTS (
    SELECT 1 FROM public.organization_segments os2 
    WHERE os2.organization_id = v_canonical_id 
    AND os2.segment_id = public.organization_segments.segment_id
  );
  DELETE FROM public.organization_segments WHERE organization_id = v_duplicate_id;

  -- company_segments
  UPDATE public.company_segments SET organization_id = v_canonical_id WHERE organization_id = v_duplicate_id 
  AND NOT EXISTS (
    SELECT 1 FROM public.company_segments cs2 
    WHERE cs2.organization_id = v_canonical_id 
    AND cs2.segment_id = public.company_segments.segment_id
  );
  DELETE FROM public.company_segments WHERE organization_id = v_duplicate_id;

  -- empresa_parceiros (onde era organization_id)
  UPDATE public.empresa_parceiros SET organization_id = v_canonical_id WHERE organization_id = v_duplicate_id
  AND NOT EXISTS (
    SELECT 1 FROM public.empresa_parceiros ep2 
    WHERE ep2.organization_id = v_canonical_id 
    AND ep2.partner_id = public.empresa_parceiros.partner_id
  );
  DELETE FROM public.empresa_parceiros WHERE organization_id = v_duplicate_id;

  -- empresa_parceiros (onde era partner_id)
  UPDATE public.empresa_parceiros SET partner_id = v_canonical_id WHERE partner_id = v_duplicate_id
  AND NOT EXISTS (
    SELECT 1 FROM public.empresa_parceiros ep2 
    WHERE ep2.partner_id = v_canonical_id 
    AND ep2.organization_id = public.empresa_parceiros.organization_id
  );
  DELETE FROM public.empresa_parceiros WHERE partner_id = v_duplicate_id;


  -- 4. Delete the duplicate after ensuring no FK constraints remain
  DELETE FROM public.organizations WHERE id = v_duplicate_id;

  -- 5. Final check
  SELECT count(*) INTO v_count
  FROM public.organizations
  WHERE regexp_replace(coalesce(cnpj,''),'[^0-9]','','g') = '01001002000102';

  IF v_count != 1 THEN
    RAISE EXCEPTION 'Merge failed, expected exactly 1 organization for CNPJ, found %', v_count;
  END IF;

END $$;
