


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."access_log_tipo" AS ENUM (
    'login',
    'logout',
    'tentativa_falha',
    'bloqueio'
);


ALTER TYPE "public"."access_log_tipo" OWNER TO "postgres";


CREATE TYPE "public"."app_role" AS ENUM (
    'admin',
    'buyer',
    'supplier_manager',
    'requester',
    'manager'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."delegation_status" AS ENUM (
    'ativa',
    'encerrada',
    'cancelada'
);


ALTER TYPE "public"."delegation_status" OWNER TO "postgres";


CREATE TYPE "public"."hubia_signal_tipo" AS ENUM (
    'oportunidade_saving',
    'novo_fornecedor',
    'cobertura_insuficiente',
    'operador_inativo',
    'convite_pendente',
    'tendencia_mercado',
    'segmento_sem_responsavel'
);


ALTER TYPE "public"."hubia_signal_tipo" OWNER TO "postgres";


CREATE TYPE "public"."internal_request_priority" AS ENUM (
    'baixa',
    'normal',
    'alta',
    'urgente',
    'emergencial'
);


ALTER TYPE "public"."internal_request_priority" OWNER TO "postgres";


CREATE TYPE "public"."internal_request_status" AS ENUM (
    'pendente',
    'em_aprovacao',
    'aprovada',
    'rejeitada',
    'em_cotacao',
    'pedido_emitido',
    'entregue',
    'cancelada'
);


ALTER TYPE "public"."internal_request_status" OWNER TO "postgres";


CREATE TYPE "public"."invitation_status" AS ENUM (
    'pendente',
    'aceito',
    'expirado',
    'cancelado'
);


ALTER TYPE "public"."invitation_status" OWNER TO "postgres";


CREATE TYPE "public"."material_source" AS ENUM (
    'manual',
    'csv_import',
    'api',
    'ai',
    'marketplace',
    'migration'
);


ALTER TYPE "public"."material_source" OWNER TO "postgres";


CREATE TYPE "public"."material_validation_status" AS ENUM (
    'pending_review',
    'needs_correction',
    'validated',
    'rejected'
);


ALTER TYPE "public"."material_validation_status" OWNER TO "postgres";


CREATE TYPE "public"."material_visibility" AS ENUM (
    'private',
    'shared',
    'global'
);


ALTER TYPE "public"."material_visibility" OWNER TO "postgres";


CREATE TYPE "public"."operator_perfil" AS ENUM (
    'administrador',
    'gestor',
    'comprador',
    'consulta',
    'solicitante',
    'auditor'
);


ALTER TYPE "public"."operator_perfil" OWNER TO "postgres";


CREATE TYPE "public"."operator_status" AS ENUM (
    'pendente',
    'ativo',
    'inativo',
    'bloqueado',
    'ferias',
    'substituido',
    'cancelado'
);


ALTER TYPE "public"."operator_status" OWNER TO "postgres";


CREATE TYPE "public"."organization_type" AS ENUM (
    'buyer',
    'supplier',
    'both'
);


ALTER TYPE "public"."organization_type" OWNER TO "postgres";


CREATE TYPE "public"."quotation_status" AS ENUM (
    'draft',
    'sent',
    'closed',
    'cancelled',
    'pending_quote'
);


ALTER TYPE "public"."quotation_status" OWNER TO "postgres";


CREATE TYPE "public"."session_status" AS ENUM (
    'ativa',
    'encerrada',
    'expirada'
);


ALTER TYPE "public"."session_status" OWNER TO "postgres";


CREATE TYPE "public"."supplier_quotation_status" AS ENUM (
    'pending',
    'submitted',
    'declined'
);


ALTER TYPE "public"."supplier_quotation_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."block_is_superadmin_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin THEN
        IF NOT public.is_super_admin() THEN
            RAISE EXCEPTION 'Operação não permitida: Apenas SuperAdmins podem alterar privilégios de SuperAdmin.';
        END IF;
        IF NEW.id = auth.uid() AND NEW.is_super_admin = false THEN
            RAISE EXCEPTION 'Prevenção de bloqueio: Você não pode remover seu próprio privilégio de SuperAdmin.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."block_is_superadmin_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_invite"("p_invite_id" "uuid", "p_phone" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_invite record;
  v_user_id uuid;
  v_user_email text;
BEGIN
  -- 1. Obtém o ID do usuário autenticado no Auth
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado no Supabase Auth.';
  END IF;

  -- 2. Busca o convite
  SELECT * INTO v_invite
  FROM public.invites
  WHERE id = p_invite_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite não encontrado.';
  END IF;

  IF v_invite.status != 'pending' THEN
    RAISE EXCEPTION 'Este convite não é mais válido (status: %).', v_invite.status;
  END IF;

  -- 3. Valida se o email bate
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  
  IF v_user_email != v_invite.email THEN
    RAISE EXCEPTION 'O email do usuário logado (%) não corresponde ao email do convite (%).', v_user_email, v_invite.email;
  END IF;

  -- 4. Atualiza a tabela profiles injetando CNPJ e telefone
  UPDATE public.profiles
  SET 
    cnpj = v_invite.cnpj,
    phone = p_phone,
    updated_at = now()
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, full_name, cnpj, phone, status, is_super_admin)
    VALUES (
      v_user_id,
      (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = v_user_id),
      v_invite.cnpj,
      p_phone,
      'active',
      false
    );
  END IF;

  -- 5. Insere a role correta
  DELETE FROM public.user_roles WHERE user_id = v_user_id;
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, v_invite.role);

  -- 6. Muda status do convite
  UPDATE public.invites
  SET 
    status = 'accepted',
    updated_at = now()
  WHERE id = p_invite_id;

  RETURN jsonb_build_object(
    'success', true,
    'cnpj', v_invite.cnpj,
    'role', v_invite.role
  );
END;
$$;


ALTER FUNCTION "public"."claim_invite"("p_invite_id" "uuid", "p_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_invite"("p_invite_id" "uuid", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_invite record;
  v_profile record;
BEGIN
  SELECT * INTO v_invite FROM public.invites WHERE id = p_invite_id AND status = 'pending';
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Convite inválido ou já processado.'); END IF;

  UPDATE public.invites SET status = 'accepted', updated_at = now() WHERE id = p_invite_id;

  INSERT INTO public.user_roles (user_id, cnpj, role)
  VALUES (p_user_id, v_invite.cnpj, v_invite.role)
  ON CONFLICT (user_id, cnpj) DO UPDATE SET role = v_invite.role;

  UPDATE public.profiles SET cnpj = v_invite.cnpj, status = 'active' WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'cnpj', v_invite.cnpj);
END;
$$;


ALTER FUNCTION "public"."claim_invite"("p_invite_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_onboarding"("p_token" "text", "p_auth_id" "uuid", "p_email" "text", "p_full_name" "text", "p_role" "text", "p_org_name" "text", "p_org_trade_name" "text", "p_org_document" "text", "p_org_city" "text", "p_org_state" "text", "p_org_website" "text", "p_segments" "uuid"[]) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_org_id uuid;
  v_seg_id uuid;
  v_slug   text;
BEGIN
  -- Gera slug único: "RAIZEN ENERGIA S.A" → "raizen-energia-s-a-1753415345"
  v_slug := lower(regexp_replace(p_org_name, '[^a-zA-Z0-9]+', '-', 'g'))
            || '-' || floor(extract(epoch from now()))::text;

  -- 1. Cria a organização com os nomes reais das colunas
  INSERT INTO public.organizations (
    name, slug, razao_social, nome_fantasia, cnpj, city, state, website, status
  ) VALUES (
    p_org_name, v_slug, p_org_name, p_org_trade_name, p_org_document,
    p_org_city, p_org_state, p_org_website, 'ativo'
  ) RETURNING id INTO v_org_id;

  -- 2. Insere os segmentos vinculando ao UUID real da org
  IF p_segments IS NOT NULL AND array_length(p_segments, 1) > 0 THEN
    FOREACH v_seg_id IN ARRAY p_segments LOOP
      INSERT INTO public.company_segments (organization_id, segment_id)
      VALUES (v_org_id, v_seg_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- 3. Cria o perfil do usuário na tabela profiles vinculando à organização
  INSERT INTO public.profiles (user_id, organization_id, full_name, email)
  VALUES (p_auth_id, v_org_id, p_full_name, p_email)
  ON CONFLICT (user_id) DO UPDATE SET
    organization_id = v_org_id,
    full_name = p_full_name;

  -- 4. Atualiza o convite para aceito (move de Convites Pendentes para Parceiros)
  UPDATE public.invitations
  SET status = 'aceito', updated_at = NOW()
  WHERE token_hash = p_token;

  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."complete_onboarding"("p_token" "text", "p_auth_id" "uuid", "p_email" "text", "p_full_name" "text", "p_role" "text", "p_org_name" "text", "p_org_trade_name" "text", "p_org_document" "text", "p_org_city" "text", "p_org_state" "text", "p_org_website" "text", "p_segments" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_orc_revision"("p_quotation_id" "uuid") RETURNS TABLE("id" "uuid", "title" "text", "status" "public"."quotation_status", "created_at" timestamp with time zone, "organization_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_org uuid := public.current_org_id();
  v_user uuid := auth.uid();
  v_target public.quotation_requests%ROWTYPE;
  v_root_title text;
  v_head public.quotation_requests%ROWTYPE;
  v_next_rev int;
  v_new_title text;
  v_new public.quotation_requests%ROWTYPE;
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Usuário não pertence a uma organização.';
  END IF;

  SELECT * INTO v_target FROM public.quotation_requests WHERE id = p_quotation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado.';
  END IF;
  IF v_target.organization_id <> v_org THEN
    RAISE EXCEPTION 'Orçamento pertence a outra organização.';
  END IF;
  IF v_target.status IN ('draft'::quotation_status, 'cancelled'::quotation_status, 'closed'::quotation_status) THEN
    RAISE EXCEPTION 'Não é possível criar revisão de um orçamento com status %.', v_target.status;
  END IF;

  v_root_title := regexp_replace(v_target.title, '\.rev[0-9]+$', '');

  SELECT * INTO v_head
  FROM public.quotation_requests
  WHERE organization_id = v_org
    AND (title = v_root_title OR title ~ ('^' || regexp_replace(v_root_title, '([\\.\+\*\?\(\)\[\]\{\}\|\^\$])', '\\\1', 'g') || '\.rev[0-9]+$'))
  ORDER BY
    CASE WHEN title = v_root_title THEN 0
         ELSE (regexp_replace(title, '^.*\.rev([0-9]+)$', '\1'))::int
    END DESC
  LIMIT 1
  FOR UPDATE;

  IF v_head.id <> p_quotation_id THEN
    RAISE EXCEPTION 'Este orçamento já foi substituído por uma revisão mais recente.';
  END IF;

  IF v_head.title = v_root_title THEN
    v_next_rev := 1;
  ELSE
    v_next_rev := (regexp_replace(v_head.title, '^.*\.rev([0-9]+)$', '\1'))::int + 1;
  END IF;

  v_new_title := v_root_title || '.rev' || v_next_rev::text;

  INSERT INTO public.quotation_requests (
    organization_id, title, status, notes, due_date, priority_level, created_by
  ) VALUES (
    v_org, v_new_title, 'draft'::quotation_status,
    v_head.notes, v_head.due_date, v_head.priority_level, v_user
  )
  RETURNING * INTO v_new;

  -- FIX: column is request_id, not quotation_request_id
  INSERT INTO public.quotation_items (request_id, product_id, quantity, unit)
  SELECT v_new.id, product_id, quantity, unit
  FROM public.quotation_items
  WHERE request_id = v_head.id;

  UPDATE public.quotation_requests
  SET status = 'cancelled'::quotation_status, updated_at = now()
  WHERE id = v_head.id;

  PERFORM public.insert_audit_log(
    'quotation_superseded', 'quotation_request', v_head.id,
    jsonb_build_object('superseded_by_id', v_new.id, 'superseded_by_title', v_new.title, 'previous_title', v_head.title),
    v_org
  );
  PERFORM public.insert_audit_log(
    'quotation_revision_created', 'quotation_request', v_new.id,
    jsonb_build_object('supersedes_id', v_head.id, 'supersedes_title', v_head.title, 'title', v_new.title, 'revision', v_next_rev),
    v_org
  );

  RETURN QUERY SELECT v_new.id, v_new.title, v_new.status, v_new.created_at, v_new.organization_id;
END;
$_$;


ALTER FUNCTION "public"."create_orc_revision"("p_quotation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_quotation_request"("p_notes" "text" DEFAULT NULL::"text", "p_due_date" "date" DEFAULT NULL::"date", "p_priority_level" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "title" "text", "status" "public"."quotation_status", "created_at" timestamp with time zone, "organization_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_org uuid := public.current_org_id();
  v_user uuid := auth.uid();
  v_title text;
  v_new public.quotation_requests%ROWTYPE;
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Usuário não pertence a uma organização.';
  END IF;

  v_title := public.next_orc_number(v_org);

  INSERT INTO public.quotation_requests (
    organization_id, title, status, notes, due_date, priority_level, created_by
  ) VALUES (
    v_org, v_title, 'draft'::quotation_status, p_notes, p_due_date, p_priority_level, v_user
  )
  RETURNING * INTO v_new;

  PERFORM public.insert_audit_log(
    'quotation_created',
    'quotation_request',
    v_new.id,
    jsonb_build_object('title', v_new.title),
    v_org
  );

  RETURN QUERY SELECT v_new.id, v_new.title, v_new.status, v_new.created_at, v_new.organization_id;
END;
$$;


ALTER FUNCTION "public"."create_quotation_request"("p_notes" "text", "p_due_date" "date", "p_priority_level" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_rfq_from_conversation"("p_conversation_id" "uuid", "p_buyer_company_id" "uuid", "p_supplier_company_id" "uuid", "p_title" "text", "p_description" "text", "p_category" "text", "p_quantity" numeric, "p_unit" "text", "p_deadline" timestamp with time zone, "p_profile_id" "uuid", "p_supplier_sku" "text" DEFAULT NULL::"text", "p_manufacturer_sku" "text" DEFAULT NULL::"text", "p_brand" "text" DEFAULT NULL::"text", "p_notes" "text" DEFAULT NULL::"text", "p_direct_contract_reason" "text" DEFAULT NULL::"text", "p_purchase_origin" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_rfq_id UUID;
  v_rfq_number INT;
  v_supplier_offered TEXT[];
  v_match_score INT := 50; -- Score base
  v_sys_message TEXT;
  v_rfq_formatted_number TEXT;
BEGIN
  -- 0. Validações Explícitas para erros amigáveis
  IF NOT EXISTS (SELECT 1 FROM public.conversations WHERE id = p_conversation_id) THEN
    RAISE EXCEPTION 'Conversa inválida ou não encontrada.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = p_buyer_company_id) THEN
    RAISE EXCEPTION 'Empresa compradora inválida.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = p_supplier_company_id) THEN
    RAISE EXCEPTION 'Empresa fornecedora inválida.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_profile_id) THEN
    RAISE EXCEPTION 'Perfil de usuário inválido.';
  END IF;

  -- 1. Obter Categorias Ofertadas pelo Fornecedor para calcular Score (Módulo 6)
  SELECT offered_categories INTO v_supplier_offered 
  FROM public.companies WHERE id = p_supplier_company_id;

  IF p_category = ANY(v_supplier_offered) THEN
    v_match_score := 90;
  END IF;

  -- 2. Inserir a Cotação Direcionada (RFQD)
  INSERT INTO public.rfqs (
    conversation_id, buyer_company_id, supplier_company_id,
    title, description, category, quantity, unit, deadline, match_score, created_by,
    type, supplier_sku, manufacturer_sku, brand, notes, direct_contract_reason, purchase_origin
  )
  VALUES (
    p_conversation_id, p_buyer_company_id, p_supplier_company_id,
    p_title, p_description, p_category, p_quantity, p_unit, p_deadline, v_match_score, p_profile_id,
    'RFQD', p_supplier_sku, p_manufacturer_sku, p_brand, p_notes, p_direct_contract_reason, p_purchase_origin
  )
  RETURNING id, rfq_number INTO v_rfq_id, v_rfq_number;

  -- Formatar o número para RFQD-YYYY-XXXXX
  v_rfq_formatted_number := 'RFQD-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(v_rfq_number::text, 5, '0');

  -- 3. Disparar Evento na Timeline (Mensagem de Sistema)
  v_sys_message := 'Nova cotação direcionada enviada. ' || v_rfq_formatted_number;
  
  INSERT INTO public.messages (
    conversation_id, sender_id, content, is_system_message, metadata
  )
  VALUES (
    p_conversation_id, NULL, v_sys_message, true, 
    jsonb_build_object(
      'event_type', 'rfq_created',
      'rfq_id', v_rfq_id,
      'rfq_number', v_rfq_formatted_number,
      'title', p_title,
      'deadline', p_deadline,
      'match_score', v_match_score,
      'quantity', p_quantity,
      'unit', p_unit,
      'supplier_sku', p_supplier_sku,
      'manufacturer_sku', p_manufacturer_sku,
      'brand', p_brand,
      'direct_contract_reason', p_direct_contract_reason,
      'purchase_origin', p_purchase_origin
    )
  );

  RETURN jsonb_build_object(
    'rfq_id', v_rfq_id,
    'rfq_number', v_rfq_formatted_number,
    'match_score', v_match_score
  );
END;
$$;


ALTER FUNCTION "public"."create_rfq_from_conversation"("p_conversation_id" "uuid", "p_buyer_company_id" "uuid", "p_supplier_company_id" "uuid", "p_title" "text", "p_description" "text", "p_category" "text", "p_quantity" numeric, "p_unit" "text", "p_deadline" timestamp with time zone, "p_profile_id" "uuid", "p_supplier_sku" "text", "p_manufacturer_sku" "text", "p_brand" "text", "p_notes" "text", "p_direct_contract_reason" "text", "p_purchase_origin" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_org_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
$$;


ALTER FUNCTION "public"."current_org_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_auth_user_organization_id"() RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT organization_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;


ALTER FUNCTION "public"."get_auth_user_organization_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_company_matches"("p_company_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_target_company record;
  v_matches jsonb := '[]'::jsonb;
  v_match record;
  v_score int;
  v_reasons text[];
BEGIN
  SELECT * INTO v_target_company FROM public.companies WHERE id = p_company_id;
  IF NOT FOUND THEN 
    RETURN jsonb_build_object('success', false, 'error', 'Company not found');
  END IF;

  FOR v_match IN 
    SELECT * FROM public.companies WHERE id != p_company_id
  LOOP
    v_score := 0;
    v_reasons := ARRAY[]::text[];

    IF EXISTS (
      SELECT 1 FROM unnest(v_target_company.demanded_categories) AS t(cat)
      JOIN unnest(v_match.offered_categories) AS m(cat) ON t.cat = m.cat
    ) THEN
      v_score := v_score + 40;
      v_reasons := array_append(v_reasons, 'Alta correspondência de Oferta x Demanda');
    END IF;

    IF EXISTS (
      SELECT 1 FROM unnest(v_target_company.offered_categories) AS t(cat)
      JOIN unnest(v_match.demanded_categories) AS m(cat) ON t.cat = m.cat
    ) THEN
      v_score := v_score + 40;
      IF NOT ('Alta correspondência de Oferta x Demanda' = ANY(v_reasons)) THEN
        v_reasons := array_append(v_reasons, 'Alta correspondência de Oferta x Demanda');
      END IF;
    END IF;

    IF v_match.segment = v_target_company.segment THEN
      v_score := v_score + 25;
      v_reasons := array_append(v_reasons, 'Mesmo Segmento de Mercado');
    END IF;

    IF v_match.cnae IS NOT NULL AND v_match.cnae = v_target_company.cnae THEN
      v_score := v_score + 20;
      v_reasons := array_append(v_reasons, 'Atividades Econômicas Compatíveis');
    END IF;

    IF v_match.hub_score IS NOT NULL THEN
      v_score := v_score + (v_match.hub_score * 0.05)::int;
    END IF;

    IF v_score > 100 THEN v_score := 100; END IF;

    IF v_score > 0 THEN
      v_matches := v_matches || jsonb_build_object(
        'target_company_id', v_match.id,
        'trade_name', v_match.trade_name,
        'company_type', v_match.company_type,
        'segment', v_match.segment,
        'match_score', v_score,
        'reasons', v_reasons
      );
    END IF;
  END LOOP;

  SELECT jsonb_agg(sub.elem) INTO v_matches
  FROM (
    SELECT elem FROM jsonb_array_elements(v_matches) AS elem
    ORDER BY (elem->>'match_score')::int DESC
  ) sub;

  RETURN jsonb_build_object(
    'success', true,
    'source_company', v_target_company.trade_name,
    'matches', COALESCE(v_matches, '[]'::jsonb)
  );
END;
$$;


ALTER FUNCTION "public"."get_company_matches"("p_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_invite_details"("p_invite_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_invite record;
  v_company record;
BEGIN
  SELECT * INTO v_invite FROM public.invites WHERE id = p_invite_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Convite não encontrado ou inválido.'); END IF;
  IF v_invite.status != 'pending' THEN RETURN jsonb_build_object('error', 'Este convite não é mais válido.'); END IF;

  SELECT trade_name, cnpj INTO v_company FROM public.companies WHERE cnpj = v_invite.cnpj;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Empresa não encontrada.'); END IF;

  RETURN jsonb_build_object(
    'success', true,
    'email', v_invite.email,
    'role', v_invite.role,
    'cnpj', v_company.cnpj,
    'organization_name', v_company.trade_name
  );
END;
$$;


ALTER FUNCTION "public"."get_invite_details"("p_invite_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_company_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT c.id FROM public.companies c
  WHERE c.cnpj IN (SELECT p.cnpj FROM public.profiles p WHERE p.user_id = auth.uid())
$$;


ALTER FUNCTION "public"."get_user_company_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_any_role"("_user_id" "uuid", "_org_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND organization_id = _org_id
  )
$$;


ALTER FUNCTION "public"."has_any_role"("_user_id" "uuid", "_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_org_access"("org_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND organization_id = org_id
  );
END;
$$;


ALTER FUNCTION "public"."has_org_access"("org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_org_id" "uuid", "_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND organization_id = _org_id AND role = _role
  )
$$;


ALTER FUNCTION "public"."has_role"("_user_id" "uuid", "_org_id" "uuid", "_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_audit_log"("p_action_type" "text", "p_entity_type" "text", "p_entity_id" "uuid" DEFAULT NULL::"uuid", "p_metadata" "jsonb" DEFAULT NULL::"jsonb", "p_organization_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_log_id UUID;
    v_user_id UUID := auth.uid();
BEGIN
    INSERT INTO public.audit_logs (
        action_type,
        entity_type,
        entity_id,
        user_id,
        organization_id,
        metadata
    ) VALUES (
        p_action_type,
        p_entity_type,
        p_entity_id,
        v_user_id,
        p_organization_id,
        p_metadata
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$;


ALTER FUNCTION "public"."insert_audit_log"("p_action_type" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_metadata" "jsonb", "p_organization_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_super_admin"() RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND is_super_admin = true
  );
END;
$$;


ALTER FUNCTION "public"."is_super_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."manage_operator"("p_target_user_id" "uuid", "p_action" "text", "p_new_role" "text" DEFAULT NULL::"text", "p_new_status" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller_id UUID;
  v_caller_org_id UUID;
  v_caller_role TEXT;
  
  v_target_org_id UUID;
  v_target_role TEXT;
  
  v_admin_count INT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  -- Busca a organização e cargo de quem está chamando a função
  SELECT p.organization_id, r.role 
  INTO v_caller_org_id, v_caller_role
  FROM public.profiles p
  JOIN public.user_roles r ON r.user_id = p.user_id
  WHERE p.user_id = v_caller_id 
  LIMIT 1;

  IF v_caller_role != 'admin' THEN
    RAISE EXCEPTION 'Apenas Administradores podem gerenciar operadores.';
  END IF;

  -- Busca os dados do operador alvo
  SELECT p.organization_id, r.role 
  INTO v_target_org_id, v_target_role
  FROM public.profiles p
  LEFT JOIN public.user_roles r ON r.user_id = p.user_id
  WHERE p.user_id = p_target_user_id 
  LIMIT 1;

  IF v_target_org_id IS NULL OR v_target_org_id != v_caller_org_id THEN
    RAISE EXCEPTION 'O operador alvo não pertence à sua organização.';
  END IF;

  -- Conta quantos admins ativos existem na empresa
  SELECT COUNT(*) INTO v_admin_count
  FROM public.user_roles ur
  JOIN public.profiles pr ON pr.user_id = ur.user_id
  WHERE ur.organization_id = v_caller_org_id 
    AND ur.role = 'admin'
    AND pr.status = 'active';

  -- AÇÃO: REMOVE DA EMPRESA
  IF p_action = 'remove' THEN
    IF v_target_role = 'admin' AND v_admin_count <= 1 THEN
      RAISE EXCEPTION 'É necessário manter pelo menos um Administrador ativo na organização.';
    END IF;

    -- Deleta os cargos (revoga acesso) e zera a organização do perfil (torna órfão)
    DELETE FROM public.user_roles WHERE user_id = p_target_user_id;
    
    UPDATE public.profiles 
    SET organization_id = NULL, status = 'inactive'
    WHERE user_id = p_target_user_id;

    RETURN jsonb_build_object('success', true, 'message', 'Operador removido da empresa com sucesso.');
  
  -- AÇÃO: UPDATE ROLE
  ELSIF p_action = 'update_role' THEN
    IF p_new_role IS NULL THEN
      RAISE EXCEPTION 'Novo perfil de acesso não informado.';
    END IF;

    IF v_target_role = 'admin' AND p_new_role != 'admin' AND v_admin_count <= 1 THEN
      RAISE EXCEPTION 'É necessário manter pelo menos um Administrador ativo na organização.';
    END IF;

    UPDATE public.user_roles 
    SET role = p_new_role::app_role
    WHERE user_id = p_target_user_id;

    RETURN jsonb_build_object('success', true, 'message', 'Perfil de acesso atualizado com sucesso.');

  -- AÇÃO: UPDATE STATUS
  ELSIF p_action = 'update_status' THEN
    IF p_new_status IS NULL THEN
      RAISE EXCEPTION 'Novo status não informado.';
    END IF;

    IF v_target_role = 'admin' AND p_new_status = 'inactive' AND v_admin_count <= 1 THEN
      RAISE EXCEPTION 'É necessário manter pelo menos um Administrador ativo na organização.';
    END IF;

    UPDATE public.profiles 
    SET status = p_new_status
    WHERE user_id = p_target_user_id;

    RETURN jsonb_build_object('success', true, 'message', 'Status atualizado com sucesso.');

  ELSE
    RAISE EXCEPTION 'Ação inválida.';
  END IF;
END;
$$;


ALTER FUNCTION "public"."manage_operator"("p_target_user_id" "uuid", "p_action" "text", "p_new_role" "text", "p_new_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."next_document_number"("p_org_id" "uuid", "p_business_unit_id" "uuid", "p_entity_type" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_year integer := EXTRACT(YEAR FROM (now() AT TIME ZONE 'America/Sao_Paulo'))::int;
  v_num integer;
  v_bu_code text;
  v_prefix text;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'organization_id é obrigatório';
  END IF;

  IF p_entity_type IS NULL OR p_entity_type NOT IN ('PR','ORC','PO') THEN
    RAISE EXCEPTION 'entity_type inválido: %', p_entity_type;
  END IF;

  IF p_business_unit_id IS NOT NULL THEN
    SELECT code INTO v_bu_code
    FROM public.business_units
    WHERE id = p_business_unit_id
      AND organization_id = p_org_id
      AND is_active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Business Unit inválida, inativa ou não pertencente à organização';
    END IF;
  END IF;

  INSERT INTO public.number_counters (organization_id, business_unit_id, entity_type, year, last_number)
  VALUES (p_org_id, p_business_unit_id, p_entity_type, v_year, 1)
  ON CONFLICT (organization_id, (COALESCE(business_unit_id, '00000000-0000-0000-0000-000000000000'::uuid)), entity_type, year)
  DO UPDATE SET last_number = public.number_counters.last_number + 1,
                updated_at = now()
  RETURNING last_number INTO v_num;

  IF v_bu_code IS NOT NULL THEN
    v_prefix := p_entity_type || '-' || v_bu_code;
  ELSE
    v_prefix := p_entity_type;
  END IF;

  RETURN v_prefix || '-' || v_year::text || '-' || lpad(v_num::text, 6, '0');
END;
$$;


ALTER FUNCTION "public"."next_document_number"("p_org_id" "uuid", "p_business_unit_id" "uuid", "p_entity_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."next_orc_number"("p_org_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_year integer := EXTRACT(YEAR FROM (now() AT TIME ZONE 'America/Sao_Paulo'))::int;
  v_num integer;
BEGIN
  INSERT INTO public.quotation_number_counters (organization_id, year, last_number)
  VALUES (p_org_id, v_year, 1)
  ON CONFLICT (organization_id, year)
  DO UPDATE SET last_number = public.quotation_number_counters.last_number + 1,
                updated_at = now()
  RETURNING last_number INTO v_num;

  RETURN 'ORC-' || v_year::text || '-' || lpad(v_num::text, 5, '0');
END;
$$;


ALTER FUNCTION "public"."next_orc_number"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_category_name"("_name" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT lower(
    regexp_replace(
      translate(
        btrim(coalesce(_name, '')),
        'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
        'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
      ),
      '\s+', ' ', 'g'
    )
  )
$$;


ALTER FUNCTION "public"."normalize_category_name"("_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_text_key"("_text" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT lower(regexp_replace(
    translate(btrim(coalesce(_text,'')),
      'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
      'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
    ),'\s+',' ','g'))
$$;


ALTER FUNCTION "public"."normalize_text_key"("_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_on_connection_accepted"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    requester_user_id UUID;
    target_company_name TEXT;
BEGIN
    SELECT c.trade_name INTO target_company_name FROM public.companies c WHERE c.id = NEW.target_company_id;
    
    FOR requester_user_id IN
        SELECT p.user_id FROM public.profiles p
        JOIN public.companies c ON p.cnpj = c.cnpj
        WHERE c.id = NEW.requester_company_id AND p.user_id IS NOT NULL
    LOOP
        INSERT INTO public.notifications (user_id, title, body, type, reference_type, reference_id)
        VALUES (
            requester_user_id,
            'Conexão aceita',
            COALESCE(target_company_name, 'Uma empresa') || ' aceitou sua solicitação de conexão!',
            'connection_accepted',
            'connection_request',
            NEW.id
        );
    END LOOP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_on_connection_accepted"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_on_connection_request"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    target_user_id UUID;
    requester_company_name TEXT;
BEGIN
    SELECT c.trade_name INTO requester_company_name FROM public.companies c WHERE c.id = NEW.requester_company_id;
    
    FOR target_user_id IN
        SELECT p.user_id FROM public.profiles p
        JOIN public.companies c ON p.cnpj = c.cnpj
        WHERE c.id = NEW.target_company_id AND p.user_id IS NOT NULL
    LOOP
        INSERT INTO public.notifications (user_id, title, body, type, reference_type, reference_id)
        VALUES (
            target_user_id,
            'Nova solicitação de conexão',
            COALESCE(requester_company_name, 'Uma empresa') || ' deseja se conectar com você.',
            'connection_request',
            'connection_request',
            NEW.id
        );
    END LOOP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_on_connection_request"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_material_admin_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF public.is_super_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_source IS DISTINCT FROM OLD.created_source
     OR NEW.validated_by IS DISTINCT FROM OLD.validated_by
     OR NEW.validated_at IS DISTINCT FROM OLD.validated_at
     OR NEW.master_owner_organization_id IS DISTINCT FROM OLD.master_owner_organization_id
     OR NEW.validation_status IS DISTINCT FROM OLD.validation_status
     OR NEW.visibility IS DISTINCT FROM OLD.visibility THEN
    RAISE EXCEPTION 'Campos administrativos do material só podem ser alterados por superadministrador';
  END IF;
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."protect_material_admin_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_quotation_item_snapshot"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF OLD.snapshot_source IS NOT NULL THEN
    IF NEW.product_name_snapshot        IS DISTINCT FROM OLD.product_name_snapshot
    OR NEW.manufacturer_name_snapshot   IS DISTINCT FROM OLD.manufacturer_name_snapshot
    OR NEW.manufacturer_code_snapshot   IS DISTINCT FROM OLD.manufacturer_code_snapshot
    OR NEW.internal_sku_snapshot        IS DISTINCT FROM OLD.internal_sku_snapshot
    OR NEW.description_snapshot         IS DISTINCT FROM OLD.description_snapshot
    OR NEW.unit_snapshot                IS DISTINCT FROM OLD.unit_snapshot
    OR NEW.category_name_snapshot       IS DISTINCT FROM OLD.category_name_snapshot
    OR NEW.material_id_snapshot         IS DISTINCT FROM OLD.material_id_snapshot
    OR NEW.organization_material_id_snapshot IS DISTINCT FROM OLD.organization_material_id_snapshot
    OR NEW.snapshot_source              IS DISTINCT FROM OLD.snapshot_source
    OR NEW.snapshot_created_at          IS DISTINCT FROM OLD.snapshot_created_at
    OR NEW.snapshot_version             IS DISTINCT FROM OLD.snapshot_version
    THEN
      RAISE EXCEPTION 'Snapshot histórico é imutável após criação (quotation_items.id=%).', OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."protect_quotation_item_snapshot"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_category_normalized_name"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.normalized_name := public.normalize_category_name(NEW.name);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_category_normalized_name"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_manufacturer_normalized"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.normalized_name := public.normalize_text_key(NEW.name);
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  ELSIF TG_OP = 'INSERT' AND NEW.created_by <> auth.uid() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'created_by deve ser o usuário autenticado';
  END IF;
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."set_manufacturer_normalized"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_material_normalized"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.normalized_official_name := public.normalize_text_key(NEW.official_name);
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."set_material_normalized"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."start_hubia_conversation"("p_source_company_id" "uuid", "p_target_company_id" "uuid", "p_system_message" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_conversation_id UUID;
  v_is_new BOOLEAN := false;
BEGIN
  -- 1. Verifica se a conversa já existe (ordem não importa graças à nossa lógica ou index)
  SELECT id INTO v_conversation_id
  FROM public.conversations
  WHERE (company_a_id = p_source_company_id AND company_b_id = p_target_company_id)
     OR (company_a_id = p_target_company_id AND company_b_id = p_source_company_id)
  LIMIT 1;

  -- 2. Se não existir, cria
  IF v_conversation_id IS NULL THEN
    INSERT INTO public.conversations (company_a_id, company_b_id)
    VALUES (
      LEAST(p_source_company_id, p_target_company_id), 
      GREATEST(p_source_company_id, p_target_company_id)
    )
    RETURNING id INTO v_conversation_id;
    
    v_is_new := true;
  END IF;

  -- 3. Se for nova, insere a mensagem da Hub.IA
  IF v_is_new AND p_system_message IS NOT NULL AND p_system_message != '' THEN
    INSERT INTO public.messages (conversation_id, sender_id, content, is_system_message)
    VALUES (v_conversation_id, NULL, p_system_message, true);
  END IF;

  RETURN jsonb_build_object(
    'success', true, 
    'conversation_id', v_conversation_id,
    'is_new', v_is_new
  );
END;
$$;


ALTER FUNCTION "public"."start_hubia_conversation"("p_source_company_id" "uuid", "p_target_company_id" "uuid", "p_system_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_all_hub_scores"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  org RECORD;
BEGIN

  FOR org IN
    SELECT id
    FROM organizations
  LOOP

    PERFORM update_organization_hub_score(org.id);

  END LOOP;

END;
$$;


ALTER FUNCTION "public"."update_all_hub_scores"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_connection_requests_modtime"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_connection_requests_modtime"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_organization_hub_score"("org_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_score INTEGER := 0;
  v_org RECORD;
  v_operators_count BIGINT := 0;
  v_activity_count BIGINT := 0;
BEGIN

  SELECT * INTO v_org
  FROM organizations
  WHERE id = org_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Dados básicos
  IF v_org.name IS NOT NULL AND v_org.cnpj IS NOT NULL THEN
    v_score := v_score + 5;
  END IF;

  IF v_org.logo_url IS NOT NULL THEN
    v_score := v_score + 5;
  END IF;

  IF v_org.business_email IS NOT NULL
     AND v_org.phone IS NOT NULL THEN
    v_score := v_score + 5;
  END IF;

  -- Cidade/Estado
  IF v_org.city IS NOT NULL
     AND v_org.state IS NOT NULL THEN
    v_score := v_score + 10;
  END IF;

  -- Porte
  IF v_org.company_size IS NOT NULL THEN
    v_score := v_score + 5;
  END IF;

  -- Segmento
  IF v_org.segment IS NOT NULL
     AND jsonb_array_length(v_org.segment::jsonb) > 0 THEN
    v_score := v_score + 15;
  END IF;

  -- Categorias
  IF (
      v_org.interest_categories IS NOT NULL
      AND jsonb_array_length(v_org.interest_categories::jsonb) > 0
     )
     OR (
      v_org.supplied_categories IS NOT NULL
      AND jsonb_array_length(v_org.supplied_categories::jsonb) > 0
     )
  THEN
    v_score := v_score + 20;
  END IF;

  -- Operadores ativos
  SELECT COUNT(*)
  INTO v_operators_count
  FROM profiles
  WHERE organization_id = org_id
    AND status = 'active';

  IF v_operators_count > 0 THEN
    v_score := v_score + 15;
  END IF;

  -- Movimentação
  SELECT COUNT(*)
  INTO v_activity_count
  FROM quotation_requests
  WHERE organization_id = org_id;

  IF v_activity_count = 0 THEN
    SELECT COUNT(*)
    INTO v_activity_count
    FROM supplier_quotations
    WHERE supplier_id = org_id;
  END IF;

  IF v_activity_count > 0 THEN
    v_score := v_score + 20;
  END IF;

  IF v_score > 100 THEN
    v_score := 100;
  END IF;

  UPDATE organizations
  SET
    hub_score = v_score,
    hub_classification =
      CASE
        WHEN v_score >= 85 THEN 'Ouro'
        WHEN v_score >= 60 THEN 'Prata'
        ELSE 'Bronze'
      END
  WHERE id = org_id;

END;
$$;


ALTER FUNCTION "public"."update_organization_hub_score"("org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_company_invite"("p_token" "text") RETURNS TABLE("id" "uuid", "company" "text", "name" "text", "document" "text", "city" "text", "state" "text", "email" "text", "status" "text", "segments" "text"[], "inviter_logo_url" "text", "inviter_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.company::text,
    i.name::text,
    i.document::text,
    i.city::text,
    i.state::text,
    i.email::text,
    i.status::text,
    i.segments,
    o.logo_url::text as inviter_logo_url,
    o.name::text as inviter_name
  FROM public.invitations i
  LEFT JOIN public.organizations o ON i.organization_id = o.id
  WHERE i.token_hash = p_token
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."validate_company_invite"("p_token" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."access_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "operator_id" "uuid",
    "organization_id" "uuid" NOT NULL,
    "tipo" "public"."access_log_tipo" NOT NULL,
    "ip" "text",
    "user_agent" "text",
    "resultado" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "access_logs_resultado_check" CHECK (("resultado" = ANY (ARRAY['sucesso'::"text", 'falha'::"text"])))
);


ALTER TABLE "public"."access_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "action_type" "text" NOT NULL,
    "user_id" "uuid",
    "organization_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "entity_type" "text",
    "entity_id" "uuid"
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_units" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "business_units_code_format" CHECK (("code" ~ '^[A-Z0-9]{2,8}$'::"text"))
);


ALTER TABLE "public"."business_units" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "parent_id" "uuid",
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "normalized_name" "text" NOT NULL
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."certifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."certifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trade_name" "text",
    "legal_name" "text",
    "cnpj" "text" NOT NULL,
    "address" "jsonb" DEFAULT '{}'::"jsonb",
    "contact" "jsonb" DEFAULT '{}'::"jsonb",
    "client_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "hub_score" integer DEFAULT 0,
    "segment" "text",
    "cnae" "text",
    "company_type" "text",
    "offered_categories" "text"[] DEFAULT '{}'::"text"[],
    "demanded_categories" "text"[] DEFAULT '{}'::"text"[],
    "status" "text" DEFAULT 'active'::"text",
    "logo_url" "text",
    "hub_classification" "text",
    "profile_type" "text",
    "company_visibility" "text" DEFAULT 'public'::"text",
    "primary_cnae" "text",
    "company_size" "text",
    "business_activity" "text",
    "business_description" "text",
    "purchase_interests" "jsonb" DEFAULT '[]'::"jsonb",
    "products_supplied" "jsonb" DEFAULT '[]'::"jsonb"
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_segments" (
    "organization_id" "uuid" NOT NULL,
    "segment_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."company_segments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."connection_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "requester_company_id" "uuid" NOT NULL,
    "target_company_id" "uuid" NOT NULL,
    "requested_by_user_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "message" "text",
    "reasons" "text"[],
    "categories" "text"[],
    "interests" "text"[],
    "metadata" "jsonb",
    "responded_by_user_id" "uuid",
    "responded_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "connection_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'rejected'::"text", 'canceled'::"text"])))
);


ALTER TABLE "public"."connection_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversation_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "rfq_id" "uuid",
    "file_name" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_size" bigint,
    "mime_type" "text",
    "sha256_hash" "text",
    "scan_status" "text" DEFAULT 'pending'::"text",
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."conversation_files" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_a_id" "uuid" NOT NULL,
    "company_b_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."delegations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "operador_origem_id" "uuid" NOT NULL,
    "operador_substituto_id" "uuid" NOT NULL,
    "data_inicio" "date" NOT NULL,
    "data_fim" "date" NOT NULL,
    "motivo" "text",
    "status" "public"."delegation_status" DEFAULT 'ativa'::"public"."delegation_status" NOT NULL,
    "segmentos_espelhados" boolean DEFAULT true NOT NULL,
    "permissoes_espelhadas" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."delegations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."empresa_catalogo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "material_id" "uuid",
    "internal_code" character varying(100),
    "brand" character varying(255),
    "manufacturer" character varying(255),
    "description" "text",
    "image_url" "text",
    "status" character varying(50) DEFAULT 'ativo'::character varying,
    "material_type" character varying(50) DEFAULT 'fornecido'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."empresa_catalogo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."empresa_certificacoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "certification_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."empresa_certificacoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."empresa_cnaes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "cnae_code" character varying(50) NOT NULL,
    "description" "text",
    "is_primary" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."empresa_cnaes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."empresa_estados_atendidos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "state_code" character varying(2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."empresa_estados_atendidos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."empresa_parceiros" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "partner_id" "uuid" NOT NULL,
    "relationship_type" character varying(50) NOT NULL,
    "status" character varying(50) DEFAULT 'Novo'::character varying,
    "origem_relacionamento" character varying(50) DEFAULT 'manual'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."empresa_parceiros" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."global_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_name" "text" NOT NULL,
    "contact_name" "text",
    "email" "text" NOT NULL,
    "phone" "text",
    "notes" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "invited_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."global_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hubia_signals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "operator_id" "uuid",
    "segment_id" "uuid",
    "tipo_sinal" "public"."hubia_signal_tipo" NOT NULL,
    "descricao" "text" NOT NULL,
    "dados" "jsonb" DEFAULT '{}'::"jsonb",
    "lido" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."hubia_signals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."internal_request_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "description" character varying(255) NOT NULL,
    "quantity" numeric(15,3) NOT NULL,
    "uom" character varying(20) NOT NULL,
    "product_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."internal_request_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."internal_request_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "message" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."internal_request_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."internal_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "requester_id" "uuid" NOT NULL,
    "requested_by_name" character varying(255) NOT NULL,
    "priority" "public"."internal_request_priority" DEFAULT 'normal'::"public"."internal_request_priority",
    "status" "public"."internal_request_status" DEFAULT 'pendente'::"public"."internal_request_status",
    "expected_date" "date",
    "department" character varying(255),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."internal_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "company" character varying(255) NOT NULL,
    "email" character varying(255) NOT NULL,
    "document" character varying(50) NOT NULL,
    "status" character varying(50) DEFAULT 'Pending'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "token_hash" "text",
    "expires_at" timestamp with time zone,
    "city" "text",
    "state" "text",
    "contact_name" "text",
    "website" "text",
    "message" "text",
    "segments" "text"[] DEFAULT '{}'::"text"[]
);


ALTER TABLE "public"."invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cnpj" "text" NOT NULL,
    "role" "text" DEFAULT 'requester'::"text" NOT NULL,
    "email" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "operator_id" "uuid",
    "action" "text",
    "details" "text",
    "ip_address" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."manufacturers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "normalized_name" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."manufacturers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."materials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "official_name" "text" NOT NULL,
    "normalized_official_name" "text" NOT NULL,
    "description" "text",
    "unit" "text" DEFAULT 'un'::"text" NOT NULL,
    "manufacturer_id" "uuid",
    "manufacturer_code" "text",
    "technical_attributes" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "validation_status" "public"."material_validation_status" DEFAULT 'pending_review'::"public"."material_validation_status" NOT NULL,
    "visibility" "public"."material_visibility" DEFAULT 'private'::"public"."material_visibility" NOT NULL,
    "created_source" "public"."material_source" DEFAULT 'manual'::"public"."material_source" NOT NULL,
    "master_owner_organization_id" "uuid",
    "created_by" "uuid",
    "validated_by" "uuid",
    "validated_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "materials_manufacturer_code_pair" CHECK (((("manufacturer_id" IS NULL) AND ("manufacturer_code" IS NULL)) OR (("manufacturer_id" IS NOT NULL) AND ("manufacturer_code" IS NOT NULL))))
);


ALTER TABLE "public"."materials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_id" "uuid",
    "content" "text" NOT NULL,
    "is_system_message" boolean DEFAULT false,
    "dlp_status" "text" DEFAULT 'pending'::"text",
    "risk_score" integer DEFAULT 0,
    "is_blocked" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "read_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "type" "text" DEFAULT 'system'::"text" NOT NULL,
    "reference_type" "text",
    "reference_id" "uuid",
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['connection_request'::"text", 'connection_accepted'::"text", 'quotation_received'::"text", 'quotation_response'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."number_counters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "business_unit_id" "uuid",
    "entity_type" "text" NOT NULL,
    "year" integer NOT NULL,
    "last_number" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "number_counters_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['PR'::"text", 'ORC'::"text", 'PO'::"text"]))),
    CONSTRAINT "number_counters_last_number_check" CHECK (("last_number" >= 0))
);


ALTER TABLE "public"."number_counters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."operation_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "operator_id" "uuid",
    "organization_id" "uuid" NOT NULL,
    "entidade" "text" NOT NULL,
    "acao" "text" NOT NULL,
    "payload_antes" "jsonb",
    "payload_depois" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."operation_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."operator_categories" (
    "operator_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."operator_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."operator_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "invited_by_id" "uuid",
    "email" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "cargo" "text",
    "perfil" "public"."operator_perfil" DEFAULT 'comprador'::"public"."operator_perfil" NOT NULL,
    "token" "text" NOT NULL,
    "status" "public"."invitation_status" DEFAULT 'pendente'::"public"."invitation_status" NOT NULL,
    "category_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '72:00:00'::interval) NOT NULL,
    "accepted_at" timestamp with time zone,
    "ip_aceite" "text",
    "user_agent_aceite" "text",
    "email_sent_at" timestamp with time zone,
    "email_status" character varying(50),
    "email_error" "text",
    "cancelled_at" timestamp with time zone,
    "todas_categorias" boolean DEFAULT false NOT NULL,
    CONSTRAINT "operator_invitations_perfil_check" CHECK ((("perfil")::"text" = ANY (ARRAY[('administrador'::character varying)::"text", ('gestor'::character varying)::"text", ('comprador'::character varying)::"text", ('solicitante'::character varying)::"text", ('auditor'::character varying)::"text"])))
);


ALTER TABLE "public"."operator_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."operator_segments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "operator_id" "uuid" NOT NULL,
    "segment_id" "uuid" NOT NULL,
    "todos_segmentos" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."operator_segments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."operator_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "operator_id" "uuid" NOT NULL,
    "token_hash" "text" NOT NULL,
    "ip" "text",
    "user_agent" "text",
    "status" "public"."session_status" DEFAULT 'ativa'::"public"."session_status" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone
);


ALTER TABLE "public"."operator_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."operators" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "sobrenome" "text" DEFAULT ''::"text" NOT NULL,
    "email" "text" NOT NULL,
    "telefone" "text",
    "cargo" "text",
    "perfil" "public"."operator_perfil" DEFAULT 'comprador'::"public"."operator_perfil" NOT NULL,
    "status" "public"."operator_status" DEFAULT 'pendente'::"public"."operator_status" NOT NULL,
    "gestor_id" "uuid",
    "invited_at" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "last_login_at" timestamp with time zone,
    "last_activity_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "todas_categorias" boolean DEFAULT false NOT NULL,
    CONSTRAINT "operators_perfil_check" CHECK ((("perfil")::"text" = ANY (ARRAY[('administrador'::character varying)::"text", ('gestor'::character varying)::"text", ('comprador'::character varying)::"text", ('solicitante'::character varying)::"text", ('auditor'::character varying)::"text"])))
);


ALTER TABLE "public"."operators" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."organization_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_materials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "material_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "internal_sku" "text",
    "erp_code" "text",
    "display_name" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "available_for_purchase" boolean DEFAULT true NOT NULL,
    "available_for_sale" boolean DEFAULT false NOT NULL,
    "commercial_config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "logistics_config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "relationship_type" "text",
    CONSTRAINT "organization_materials_relationship_type_check" CHECK (("relationship_type" = ANY (ARRAY['fabricante'::"text", 'distribuidor'::"text", 'revendedor'::"text", 'fornecedor'::"text", 'comprador'::"text"])))
);


ALTER TABLE "public"."organization_materials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_segments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "segment_id" "uuid" NOT NULL,
    "origem" character varying(50) DEFAULT 'usuario'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."organization_segments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "cnpj" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "description" "text",
    "profile_type" "public"."organization_type" DEFAULT 'buyer'::"public"."organization_type",
    "segment" "jsonb" DEFAULT '[]'::"jsonb",
    "interest_categories" "jsonb" DEFAULT '[]'::"jsonb",
    "supplied_categories" "jsonb" DEFAULT '[]'::"jsonb",
    "service_regions" "jsonb" DEFAULT '[]'::"jsonb",
    "service_radius" character varying(50),
    "logo_url" "text",
    "website" "text",
    "linkedin_url" "text",
    "phone" "text",
    "business_email" "text",
    "city" "text",
    "state" "text",
    "country" "text",
    "company_size" "text",
    "status" "text" DEFAULT 'active'::"text",
    "hub_score" integer DEFAULT 0,
    "hub_classification" "text" DEFAULT 'Bronze'::"text",
    "company_visibility" "text" DEFAULT 'public'::"text",
    "razao_social" "text",
    "nome_fantasia" "text",
    "email_corporativo" "text",
    "telefone" "text",
    "gestor_principal_id" "uuid",
    "business_model" character varying(50) DEFAULT 'both'::character varying,
    "address_zip_code" "text",
    "address_street" "text",
    "address_number" "text",
    "address_complement" "text",
    "address_neighborhood" "text",
    "address_reference" "text",
    "whatsapp" "text",
    "profile_completion" integer DEFAULT 0,
    "inscricao_estadual" character varying(50),
    "inscricao_municipal" character varying(50),
    "situacao_cadastral" character varying(50),
    "data_abertura" "date",
    "natureza_juridica" character varying(255),
    "latitude" numeric(10,8),
    "longitude" numeric(11,8),
    "tipo_empresa" character varying(50),
    "perfil_comercial" character varying(50),
    "status_empresa" character varying(50) DEFAULT 'Ativa'::character varying,
    "tipo_cobertura" character varying(50),
    "raio_atendimento_km" integer,
    "recebe_oportunidades" boolean DEFAULT true,
    "nivel_interesse" character varying(50),
    "ultima_sincronizacao_receita" timestamp with time zone,
    "cnae_principal" character varying(50),
    "atividade_principal" "text",
    "nivel_confianca_cadastro" integer DEFAULT 25,
    "geographic_coverage_type" character varying(30),
    CONSTRAINT "chk_geographic_coverage_type" CHECK ((("geographic_coverage_type" IS NULL) OR (("geographic_coverage_type")::"text" = ANY ((ARRAY['local'::character varying, 'regional'::character varying, 'state'::character varying, 'national'::character varying, 'international'::character varying])::"text"[]))))
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


COMMENT ON COLUMN "public"."organizations"."geographic_coverage_type" IS 'Tipo de cobertura geográfica: local, regional, state, national ou international.';



CREATE TABLE IF NOT EXISTS "public"."product_offers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "unit_price" numeric(10,2) NOT NULL,
    "minimum_order_quantity" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."product_offers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."product_suppliers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "sku" "text",
    "name" "text" NOT NULL,
    "description" "text",
    "unit" "text" DEFAULT 'un'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "erp_code" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "segment_id" "uuid",
    "material_id" "uuid"
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "organization_id" "uuid",
    "full_name" "text",
    "email" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "department" character varying(255),
    "cost_center" character varying(255),
    "manager_id" "uuid",
    "theme_preference" "text" DEFAULT 'supplyhub'::"text",
    "phone" "text",
    "job_title" "text",
    "status" "text" DEFAULT 'active'::"text",
    "is_super_admin" boolean DEFAULT false,
    "cnpj" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."theme_preference" IS 'Opções: light, supplyhub, dark, minimalist';



COMMENT ON COLUMN "public"."profiles"."status" IS 'Status do usuário. Ex: active, inactive';



CREATE TABLE IF NOT EXISTS "public"."quotation_decisions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "winner_supplier_id" "uuid" NOT NULL,
    "recommended_supplier_id" "uuid",
    "justification" "text",
    "decision_by" "uuid" NOT NULL,
    "decision_type" character varying(50) DEFAULT 'AI_APPROVED'::character varying,
    "financial_impact" numeric(10,2),
    "financial_impact_percent" numeric(5,2),
    "snapshot" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."quotation_decisions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quotation_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity" numeric(14,3) DEFAULT 1 NOT NULL,
    "unit" "text" DEFAULT 'un'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "product_name_snapshot" "text",
    "manufacturer_name_snapshot" "text",
    "manufacturer_code_snapshot" "text",
    "internal_sku_snapshot" "text",
    "description_snapshot" "text",
    "unit_snapshot" "text",
    "category_name_snapshot" "text",
    "material_id_snapshot" "uuid",
    "organization_material_id_snapshot" "uuid",
    "snapshot_source" "text",
    "snapshot_created_at" timestamp with time zone,
    "snapshot_version" smallint,
    CONSTRAINT "quotation_items_snapshot_source_chk" CHECK ((("snapshot_source" IS NULL) OR ("snapshot_source" = ANY (ARRAY['created_with_quotation'::"text", 'current_state_backfill'::"text"]))))
);


ALTER TABLE "public"."quotation_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quotation_number_counters" (
    "organization_id" "uuid" NOT NULL,
    "year" integer NOT NULL,
    "last_number" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."quotation_number_counters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quotation_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "title" "text" NOT NULL,
    "status" "public"."quotation_status" DEFAULT 'draft'::"public"."quotation_status" NOT NULL,
    "due_date" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "priority_level" "text"
);


ALTER TABLE "public"."quotation_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rfqs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rfq_number" integer NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "buyer_company_id" "uuid" NOT NULL,
    "supplier_company_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "category" "text",
    "quantity" numeric DEFAULT 1 NOT NULL,
    "unit" "text" DEFAULT 'UN'::"text" NOT NULL,
    "deadline" timestamp with time zone,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "match_score" integer DEFAULT 0,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "type" "text" DEFAULT 'RFQD'::"text",
    "supplier_sku" "text",
    "manufacturer_sku" "text",
    "brand" "text",
    "notes" "text",
    "direct_contract_reason" "text",
    "purchase_origin" "text"
);


ALTER TABLE "public"."rfqs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."rfqs_rfq_number_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."rfqs_rfq_number_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."rfqs_rfq_number_seq" OWNED BY "public"."rfqs"."rfq_number";



CREATE TABLE IF NOT EXISTS "public"."segments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "nome" "text" NOT NULL,
    "descricao" "text",
    "status" "text" DEFAULT 'ativo'::"text" NOT NULL,
    "responsavel_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "segments_status_check" CHECK (("status" = ANY (ARRAY['ativo'::"text", 'inativo'::"text"])))
);


ALTER TABLE "public"."segments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supplier_categories" (
    "supplier_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."supplier_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supplier_quotation_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "supplier_quotation_id" "uuid" NOT NULL,
    "quotation_item_id" "uuid" NOT NULL,
    "unit_price" numeric(14,4),
    "lead_time_days" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "refusal_reason" "text",
    "refusal_notes" "text",
    CONSTRAINT "chk_sqi_status" CHECK (("status" = ANY (ARRAY['pending'::"text", 'quoted'::"text", 'refused'::"text"])))
);


ALTER TABLE "public"."supplier_quotation_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supplier_quotations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "status" "public"."supplier_quotation_status" DEFAULT 'pending'::"public"."supplier_quotation_status" NOT NULL,
    "submitted_at" timestamp with time zone,
    "total_amount" numeric(14,2),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."supplier_quotations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supplier_segments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "segment_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."supplier_segments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "legal_name" "text" NOT NULL,
    "trade_name" "text",
    "cnpj" "text",
    "email" "text",
    "phone" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."suppliers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."rfqs" ALTER COLUMN "rfq_number" SET DEFAULT "nextval"('"public"."rfqs_rfq_number_seq"'::"regclass");



ALTER TABLE ONLY "public"."access_logs"
    ADD CONSTRAINT "access_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_units"
    ADD CONSTRAINT "business_units_id_org_unique" UNIQUE ("id", "organization_id");



ALTER TABLE ONLY "public"."business_units"
    ADD CONSTRAINT "business_units_org_code_unique" UNIQUE ("organization_id", "code");



ALTER TABLE ONLY "public"."business_units"
    ADD CONSTRAINT "business_units_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."certifications"
    ADD CONSTRAINT "certifications_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."certifications"
    ADD CONSTRAINT "certifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_cnpj_key" UNIQUE ("cnpj");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_cnpj_unique" UNIQUE ("cnpj");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_segments"
    ADD CONSTRAINT "company_segments_pkey" PRIMARY KEY ("organization_id", "segment_id");



ALTER TABLE ONLY "public"."connection_requests"
    ADD CONSTRAINT "connection_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_files"
    ADD CONSTRAINT "conversation_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."delegations"
    ADD CONSTRAINT "delegations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."empresa_catalogo"
    ADD CONSTRAINT "empresa_catalogo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."empresa_certificacoes"
    ADD CONSTRAINT "empresa_certificacoes_organization_id_certification_id_key" UNIQUE ("organization_id", "certification_id");



ALTER TABLE ONLY "public"."empresa_certificacoes"
    ADD CONSTRAINT "empresa_certificacoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."empresa_cnaes"
    ADD CONSTRAINT "empresa_cnaes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."empresa_estados_atendidos"
    ADD CONSTRAINT "empresa_estados_atendidos_organization_id_state_code_key" UNIQUE ("organization_id", "state_code");



ALTER TABLE ONLY "public"."empresa_estados_atendidos"
    ADD CONSTRAINT "empresa_estados_atendidos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."empresa_parceiros"
    ADD CONSTRAINT "empresa_parceiros_organization_id_partner_id_relationship_t_key" UNIQUE ("organization_id", "partner_id", "relationship_type");



ALTER TABLE ONLY "public"."empresa_parceiros"
    ADD CONSTRAINT "empresa_parceiros_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."global_invites"
    ADD CONSTRAINT "global_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hubia_signals"
    ADD CONSTRAINT "hubia_signals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."internal_request_items"
    ADD CONSTRAINT "internal_request_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."internal_request_messages"
    ADD CONSTRAINT "internal_request_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."internal_requests"
    ADD CONSTRAINT "internal_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."logs"
    ADD CONSTRAINT "logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."manufacturers"
    ADD CONSTRAINT "manufacturers_normalized_name_unique" UNIQUE ("normalized_name");



ALTER TABLE ONLY "public"."manufacturers"
    ADD CONSTRAINT "manufacturers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."materials"
    ADD CONSTRAINT "materials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."number_counters"
    ADD CONSTRAINT "number_counters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."operation_logs"
    ADD CONSTRAINT "operation_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."operator_categories"
    ADD CONSTRAINT "operator_categories_pkey" PRIMARY KEY ("operator_id", "category_id");



ALTER TABLE ONLY "public"."operator_invitations"
    ADD CONSTRAINT "operator_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."operator_invitations"
    ADD CONSTRAINT "operator_invitations_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."operator_segments"
    ADD CONSTRAINT "operator_segments_operator_id_segment_id_key" UNIQUE ("operator_id", "segment_id");



ALTER TABLE ONLY "public"."operator_segments"
    ADD CONSTRAINT "operator_segments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."operator_sessions"
    ADD CONSTRAINT "operator_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."operators"
    ADD CONSTRAINT "operators_organization_id_email_key" UNIQUE ("organization_id", "email");



ALTER TABLE ONLY "public"."operators"
    ADD CONSTRAINT "operators_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_invites"
    ADD CONSTRAINT "organization_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_materials"
    ADD CONSTRAINT "organization_materials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_materials"
    ADD CONSTRAINT "organization_materials_unique" UNIQUE ("organization_id", "material_id");



ALTER TABLE ONLY "public"."organization_segments"
    ADD CONSTRAINT "organization_segments_organization_id_segment_id_key" UNIQUE ("organization_id", "segment_id");



ALTER TABLE ONLY "public"."organization_segments"
    ADD CONSTRAINT "organization_segments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."product_offers"
    ADD CONSTRAINT "product_offers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_suppliers"
    ADD CONSTRAINT "product_suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_suppliers"
    ADD CONSTRAINT "product_suppliers_product_id_supplier_id_key" UNIQUE ("product_id", "supplier_id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."quotation_decisions"
    ADD CONSTRAINT "quotation_decisions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotation_items"
    ADD CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotation_number_counters"
    ADD CONSTRAINT "quotation_number_counters_pkey" PRIMARY KEY ("organization_id", "year");



ALTER TABLE ONLY "public"."quotation_requests"
    ADD CONSTRAINT "quotation_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rfqs"
    ADD CONSTRAINT "rfqs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."segments"
    ADD CONSTRAINT "segments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplier_categories"
    ADD CONSTRAINT "supplier_categories_pkey" PRIMARY KEY ("supplier_id", "category_id");



ALTER TABLE ONLY "public"."supplier_quotation_items"
    ADD CONSTRAINT "supplier_quotation_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplier_quotation_items"
    ADD CONSTRAINT "supplier_quotation_items_supplier_quotation_id_quotation_it_key" UNIQUE ("supplier_quotation_id", "quotation_item_id");



ALTER TABLE ONLY "public"."supplier_quotations"
    ADD CONSTRAINT "supplier_quotations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplier_quotations"
    ADD CONSTRAINT "supplier_quotations_request_id_supplier_id_key" UNIQUE ("request_id", "supplier_id");



ALTER TABLE ONLY "public"."supplier_segments"
    ADD CONSTRAINT "supplier_segments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplier_segments"
    ADD CONSTRAINT "supplier_segments_supplier_id_segment_id_key" UNIQUE ("supplier_id", "segment_id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_organization_id_role_key" UNIQUE ("user_id", "organization_id", "role");



CREATE INDEX "audit_logs_entity_idx" ON "public"."audit_logs" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "audit_logs_org_idx" ON "public"."audit_logs" USING "btree" ("organization_id", "created_at" DESC);



CREATE UNIQUE INDEX "categories_org_normalized_name_uniq" ON "public"."categories" USING "btree" ("organization_id", "normalized_name");



CREATE INDEX "idx_access_logs_op" ON "public"."access_logs" USING "btree" ("operator_id");



CREATE INDEX "idx_business_units_org" ON "public"."business_units" USING "btree" ("organization_id");



CREATE UNIQUE INDEX "idx_decision_request" ON "public"."quotation_decisions" USING "btree" ("request_id");



CREATE INDEX "idx_hubia_signals_org" ON "public"."hubia_signals" USING "btree" ("organization_id", "lido");



CREATE INDEX "idx_invitations_email" ON "public"."operator_invitations" USING "btree" ("email");



CREATE INDEX "idx_invitations_token" ON "public"."operator_invitations" USING "btree" ("token");



CREATE INDEX "idx_notifications_unread" ON "public"."notifications" USING "btree" ("user_id") WHERE ("read_at" IS NULL);



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_operation_logs_op" ON "public"."operation_logs" USING "btree" ("operator_id");



CREATE INDEX "idx_operator_segments_op" ON "public"."operator_segments" USING "btree" ("operator_id");



CREATE INDEX "idx_operators_org" ON "public"."operators" USING "btree" ("organization_id");



CREATE INDEX "idx_operators_status" ON "public"."operators" USING "btree" ("status");



CREATE INDEX "idx_segments_org" ON "public"."segments" USING "btree" ("organization_id");



CREATE INDEX "idx_sessions_operator" ON "public"."operator_sessions" USING "btree" ("operator_id", "status");



CREATE UNIQUE INDEX "idx_unique_active_connection_request" ON "public"."connection_requests" USING "btree" (LEAST("requester_company_id", "target_company_id"), GREATEST("requester_company_id", "target_company_id")) WHERE ("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text"]));



CREATE INDEX "materials_manufacturer_idx" ON "public"."materials" USING "btree" ("manufacturer_id");



CREATE INDEX "materials_owner_idx" ON "public"."materials" USING "btree" ("master_owner_organization_id");



CREATE INDEX "materials_visibility_status_idx" ON "public"."materials" USING "btree" ("visibility", "validation_status");



CREATE UNIQUE INDEX "number_counters_unique" ON "public"."number_counters" USING "btree" ("organization_id", COALESCE("business_unit_id", '00000000-0000-0000-0000-000000000000'::"uuid"), "entity_type", "year");



CREATE INDEX "organization_materials_material_idx" ON "public"."organization_materials" USING "btree" ("material_id");



CREATE INDEX "organization_materials_org_idx" ON "public"."organization_materials" USING "btree" ("organization_id");



CREATE INDEX "products_material_id_idx" ON "public"."products" USING "btree" ("material_id");



CREATE INDEX "quotation_items_material_snapshot_idx" ON "public"."quotation_items" USING "btree" ("material_id_snapshot");



CREATE UNIQUE INDEX "quotation_requests_org_title_uidx" ON "public"."quotation_requests" USING "btree" ("organization_id", "title");



CREATE UNIQUE INDEX "unique_company_conversation" ON "public"."conversations" USING "btree" (LEAST("company_a_id", "company_b_id"), GREATEST("company_a_id", "company_b_id"));



CREATE OR REPLACE TRIGGER "connection_requests_modtime" BEFORE UPDATE ON "public"."connection_requests" FOR EACH ROW EXECUTE FUNCTION "public"."update_connection_requests_modtime"();



CREATE OR REPLACE TRIGGER "on_connection_request_accepted" AFTER UPDATE ON "public"."connection_requests" FOR EACH ROW WHEN ((("old"."status" = 'pending'::"text") AND ("new"."status" = 'accepted'::"text"))) EXECUTE FUNCTION "public"."notify_on_connection_accepted"();



CREATE OR REPLACE TRIGGER "on_connection_request_created" AFTER INSERT ON "public"."connection_requests" FOR EACH ROW WHEN (("new"."status" = 'pending'::"text")) EXECUTE FUNCTION "public"."notify_on_connection_request"();



CREATE OR REPLACE TRIGGER "quotation_items_snapshot_immutable" BEFORE UPDATE ON "public"."quotation_items" FOR EACH ROW EXECUTE FUNCTION "public"."protect_quotation_item_snapshot"();



CREATE OR REPLACE TRIGGER "tr_block_is_superadmin_update" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."block_is_superadmin_update"();



CREATE OR REPLACE TRIGGER "trg_business_units_updated_at" BEFORE UPDATE ON "public"."business_units" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_categories_normalize" BEFORE INSERT OR UPDATE ON "public"."categories" FOR EACH ROW EXECUTE FUNCTION "public"."set_category_normalized_name"();



CREATE OR REPLACE TRIGGER "trg_categories_updated_at" BEFORE UPDATE ON "public"."categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_manufacturers_normalize" BEFORE INSERT OR UPDATE ON "public"."manufacturers" FOR EACH ROW EXECUTE FUNCTION "public"."set_manufacturer_normalized"();



CREATE OR REPLACE TRIGGER "trg_manufacturers_updated" BEFORE UPDATE ON "public"."manufacturers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_materials_normalize" BEFORE INSERT OR UPDATE OF "official_name" ON "public"."materials" FOR EACH ROW EXECUTE FUNCTION "public"."set_material_normalized"();



CREATE OR REPLACE TRIGGER "trg_materials_protect_admin" BEFORE UPDATE ON "public"."materials" FOR EACH ROW EXECUTE FUNCTION "public"."protect_material_admin_fields"();



CREATE OR REPLACE TRIGGER "trg_materials_updated" BEFORE UPDATE ON "public"."materials" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_organization_materials_updated" BEFORE UPDATE ON "public"."organization_materials" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_organizations_updated_at" BEFORE UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_products_updated_at" BEFORE UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_quotation_requests_updated_at" BEFORE UPDATE ON "public"."quotation_requests" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_supplier_quotation_items_updated_at" BEFORE UPDATE ON "public"."supplier_quotation_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_supplier_quotations_updated_at" BEFORE UPDATE ON "public"."supplier_quotations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_suppliers_updated_at" BEFORE UPDATE ON "public"."suppliers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_quotation_number_counters_updated_at" BEFORE UPDATE ON "public"."quotation_number_counters" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."access_logs"
    ADD CONSTRAINT "access_logs_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."access_logs"
    ADD CONSTRAINT "access_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_company_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_units"
    ADD CONSTRAINT "business_units_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_segments"
    ADD CONSTRAINT "company_segments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_segments"
    ADD CONSTRAINT "company_segments_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "public"."segments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."connection_requests"
    ADD CONSTRAINT "connection_requests_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."connection_requests"
    ADD CONSTRAINT "connection_requests_requester_company_id_fkey" FOREIGN KEY ("requester_company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."connection_requests"
    ADD CONSTRAINT "connection_requests_responded_by_user_id_fkey" FOREIGN KEY ("responded_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."connection_requests"
    ADD CONSTRAINT "connection_requests_target_company_id_fkey" FOREIGN KEY ("target_company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_files"
    ADD CONSTRAINT "conversation_files_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_files"
    ADD CONSTRAINT "conversation_files_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_files"
    ADD CONSTRAINT "conversation_files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_company_a_id_fkey" FOREIGN KEY ("company_a_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_company_b_id_fkey" FOREIGN KEY ("company_b_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."delegations"
    ADD CONSTRAINT "delegations_operador_origem_id_fkey" FOREIGN KEY ("operador_origem_id") REFERENCES "public"."operators"("id");



ALTER TABLE ONLY "public"."delegations"
    ADD CONSTRAINT "delegations_operador_substituto_id_fkey" FOREIGN KEY ("operador_substituto_id") REFERENCES "public"."operators"("id");



ALTER TABLE ONLY "public"."delegations"
    ADD CONSTRAINT "delegations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."empresa_catalogo"
    ADD CONSTRAINT "empresa_catalogo_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."empresa_catalogo"
    ADD CONSTRAINT "empresa_catalogo_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."empresa_certificacoes"
    ADD CONSTRAINT "empresa_certificacoes_certification_id_fkey" FOREIGN KEY ("certification_id") REFERENCES "public"."certifications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."empresa_certificacoes"
    ADD CONSTRAINT "empresa_certificacoes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."empresa_cnaes"
    ADD CONSTRAINT "empresa_cnaes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."empresa_estados_atendidos"
    ADD CONSTRAINT "empresa_estados_atendidos_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."empresa_parceiros"
    ADD CONSTRAINT "empresa_parceiros_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."empresa_parceiros"
    ADD CONSTRAINT "empresa_parceiros_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hubia_signals"
    ADD CONSTRAINT "hubia_signals_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."hubia_signals"
    ADD CONSTRAINT "hubia_signals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hubia_signals"
    ADD CONSTRAINT "hubia_signals_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "public"."segments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."internal_request_items"
    ADD CONSTRAINT "internal_request_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."internal_request_items"
    ADD CONSTRAINT "internal_request_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."internal_request_items"
    ADD CONSTRAINT "internal_request_items_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."internal_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."internal_request_messages"
    ADD CONSTRAINT "internal_request_messages_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."internal_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."internal_request_messages"
    ADD CONSTRAINT "internal_request_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."internal_requests"
    ADD CONSTRAINT "internal_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."internal_requests"
    ADD CONSTRAINT "internal_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_cnpj_fkey" FOREIGN KEY ("cnpj") REFERENCES "public"."companies"("cnpj") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."logs"
    ADD CONSTRAINT "logs_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."logs"
    ADD CONSTRAINT "logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."materials"
    ADD CONSTRAINT "materials_manufacturer_id_fkey" FOREIGN KEY ("manufacturer_id") REFERENCES "public"."manufacturers"("id");



ALTER TABLE ONLY "public"."materials"
    ADD CONSTRAINT "materials_master_owner_organization_id_fkey" FOREIGN KEY ("master_owner_organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."number_counters"
    ADD CONSTRAINT "number_counters_bu_org_fkey" FOREIGN KEY ("business_unit_id", "organization_id") REFERENCES "public"."business_units"("id", "organization_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."number_counters"
    ADD CONSTRAINT "number_counters_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."operation_logs"
    ADD CONSTRAINT "operation_logs_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."operation_logs"
    ADD CONSTRAINT "operation_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."operator_categories"
    ADD CONSTRAINT "operator_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."operator_categories"
    ADD CONSTRAINT "operator_categories_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."operator_invitations"
    ADD CONSTRAINT "operator_invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "public"."operators"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."operator_invitations"
    ADD CONSTRAINT "operator_invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."operator_segments"
    ADD CONSTRAINT "operator_segments_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."operator_segments"
    ADD CONSTRAINT "operator_segments_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "public"."segments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."operator_sessions"
    ADD CONSTRAINT "operator_sessions_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."operators"
    ADD CONSTRAINT "operators_gestor_id_fkey" FOREIGN KEY ("gestor_id") REFERENCES "public"."operators"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."operators"
    ADD CONSTRAINT "operators_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_invites"
    ADD CONSTRAINT "organization_invites_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_invites"
    ADD CONSTRAINT "organization_invites_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_materials"
    ADD CONSTRAINT "organization_materials_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id");



ALTER TABLE ONLY "public"."organization_materials"
    ADD CONSTRAINT "organization_materials_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id");



ALTER TABLE ONLY "public"."organization_materials"
    ADD CONSTRAINT "organization_materials_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_segments"
    ADD CONSTRAINT "organization_segments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_segments"
    ADD CONSTRAINT "organization_segments_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "public"."segments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_offers"
    ADD CONSTRAINT "product_offers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."product_offers"
    ADD CONSTRAINT "product_offers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."product_offers"
    ADD CONSTRAINT "product_offers_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_suppliers"
    ADD CONSTRAINT "product_suppliers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_suppliers"
    ADD CONSTRAINT "product_suppliers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."product_suppliers"
    ADD CONSTRAINT "product_suppliers_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "public"."segments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotation_decisions"
    ADD CONSTRAINT "quotation_decisions_decision_by_fkey" FOREIGN KEY ("decision_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."quotation_decisions"
    ADD CONSTRAINT "quotation_decisions_recommended_supplier_id_fkey" FOREIGN KEY ("recommended_supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quotation_decisions"
    ADD CONSTRAINT "quotation_decisions_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."quotation_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotation_decisions"
    ADD CONSTRAINT "quotation_decisions_winner_supplier_id_fkey" FOREIGN KEY ("winner_supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."quotation_items"
    ADD CONSTRAINT "quotation_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."quotation_items"
    ADD CONSTRAINT "quotation_items_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."quotation_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotation_number_counters"
    ADD CONSTRAINT "quotation_number_counters_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotation_requests"
    ADD CONSTRAINT "quotation_requests_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quotation_requests"
    ADD CONSTRAINT "quotation_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rfqs"
    ADD CONSTRAINT "rfqs_buyer_company_id_fkey" FOREIGN KEY ("buyer_company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rfqs"
    ADD CONSTRAINT "rfqs_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rfqs"
    ADD CONSTRAINT "rfqs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rfqs"
    ADD CONSTRAINT "rfqs_supplier_company_id_fkey" FOREIGN KEY ("supplier_company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."segments"
    ADD CONSTRAINT "segments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."segments"
    ADD CONSTRAINT "segments_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "public"."operators"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supplier_categories"
    ADD CONSTRAINT "supplier_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_categories"
    ADD CONSTRAINT "supplier_categories_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_quotation_items"
    ADD CONSTRAINT "supplier_quotation_items_quotation_item_id_fkey" FOREIGN KEY ("quotation_item_id") REFERENCES "public"."quotation_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_quotation_items"
    ADD CONSTRAINT "supplier_quotation_items_supplier_quotation_id_fkey" FOREIGN KEY ("supplier_quotation_id") REFERENCES "public"."supplier_quotations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_quotations"
    ADD CONSTRAINT "supplier_quotations_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."quotation_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_quotations"
    ADD CONSTRAINT "supplier_quotations_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_segments"
    ADD CONSTRAINT "supplier_segments_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "public"."segments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_segments"
    ADD CONSTRAINT "supplier_segments_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Decisions are viewable by users in the same organization" ON "public"."quotation_decisions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."quotation_requests" "qr"
     JOIN "public"."profiles" "p" ON (("p"."organization_id" = "qr"."organization_id")))
  WHERE (("qr"."id" = "quotation_decisions"."request_id") AND ("p"."user_id" = "auth"."uid"())))));



CREATE POLICY "Decisions can be created by users in the same organization" ON "public"."quotation_decisions" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."quotation_requests" "qr"
     JOIN "public"."profiles" "p" ON (("p"."organization_id" = "qr"."organization_id")))
  WHERE (("qr"."id" = "quotation_decisions"."request_id") AND ("p"."user_id" = "auth"."uid"())))));



CREATE POLICY "Enable all operations for users in same organization" ON "public"."product_offers" TO "authenticated" USING (("organization_id" = ( SELECT "profiles"."organization_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Enable insert for users in the organization" ON "public"."organization_invites" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."organization_id" = "organization_invites"."organization_id")))));



CREATE POLICY "Enable read for users in the organization" ON "public"."organization_invites" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."organization_id" = "organization_invites"."organization_id")))));



CREATE POLICY "Enable update for users in the organization" ON "public"."organization_invites" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."organization_id" = "organization_invites"."organization_id")))));



CREATE POLICY "Enable users to view their own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Members can view own org counters" ON "public"."quotation_number_counters" FOR SELECT TO "authenticated" USING (("organization_id" = "public"."current_org_id"()));



CREATE POLICY "Permitir inserção livre de access_logs" ON "public"."access_logs" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Permitir inserção livre de operation_logs" ON "public"."operation_logs" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Permitir visualizacao da propria organizacao segura" ON "public"."profiles" FOR SELECT USING (("organization_id" = "public"."get_auth_user_organization_id"()));



CREATE POLICY "Super admins can see all connection requests" ON "public"."connection_requests" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."is_super_admin" = true)))));



CREATE POLICY "Super admins can view all audit logs" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."is_super_admin" = true)))));



CREATE POLICY "Super admins manage global invites" ON "public"."global_invites" TO "authenticated" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "Target company managers can update connection requests" ON "public"."connection_requests" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."companies" "c" ON (("p"."cnpj" = "c"."cnpj")))
  WHERE (("p"."user_id" = "auth"."uid"()) AND ((("c"."id" = "connection_requests"."target_company_id") AND (EXISTS ( SELECT 1
           FROM "public"."user_roles" "ur"
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'supplier_manager'::"public"."app_role"])))))) OR (("c"."id" = "connection_requests"."requester_company_id") AND ("p"."status" = 'pending'::"text")))))));



CREATE POLICY "Tenant Isolation para access_logs" ON "public"."access_logs" FOR SELECT TO "authenticated" USING (("organization_id" = ( SELECT "operators"."organization_id"
   FROM "public"."operators"
  WHERE ("operators"."id" = "auth"."uid"())
 LIMIT 1)));



CREATE POLICY "Tenant Isolation para operation_logs" ON "public"."operation_logs" FOR SELECT TO "authenticated" USING (("organization_id" = ( SELECT "operators"."organization_id"
   FROM "public"."operators"
  WHERE ("operators"."id" = "auth"."uid"())
 LIMIT 1)));



CREATE POLICY "Users can create connection requests for their company" ON "public"."connection_requests" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."companies" "c" ON (("p"."cnpj" = "c"."cnpj")))
  WHERE (("p"."user_id" = "auth"."uid"()) AND ("c"."id" = "connection_requests"."requester_company_id")))));



CREATE POLICY "Users can insert audit logs" ON "public"."audit_logs" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert their own notifications" ON "public"."notifications" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own notifications" ON "public"."notifications" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view connection requests related to their company" ON "public"."connection_requests" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."companies" "c" ON (("p"."cnpj" = "c"."cnpj")))
  WHERE (("p"."user_id" = "auth"."uid"()) AND (("c"."id" = "connection_requests"."requester_company_id") OR ("c"."id" = "connection_requests"."target_company_id"))))));



CREATE POLICY "Users can view their own notifications" ON "public"."notifications" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Usuários podem anexar arquivos em suas conversas" ON "public"."conversation_files" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."conversations" "conv"
     JOIN "public"."companies" "c" ON ((("c"."id" = "conv"."company_a_id") OR ("c"."id" = "conv"."company_b_id"))))
     JOIN "public"."profiles" "p" ON (("p"."cnpj" = "c"."cnpj")))
  WHERE (("conv"."id" = "conversation_files"."conversation_id") AND ("p"."user_id" = "auth"."uid"())))));



CREATE POLICY "Usuários podem atualizar RFQs de suas empresas" ON "public"."rfqs" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."companies" "c" ON (("p"."cnpj" = "c"."cnpj")))
  WHERE (("p"."user_id" = "auth"."uid"()) AND (("c"."id" = "rfqs"."buyer_company_id") OR ("c"."id" = "rfqs"."supplier_company_id"))))));



CREATE POLICY "Usuários podem criar RFQs para suas empresas" ON "public"."rfqs" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."companies" "c" ON (("p"."cnpj" = "c"."cnpj")))
  WHERE (("p"."user_id" = "auth"."uid"()) AND ("c"."id" = "rfqs"."buyer_company_id")))));



CREATE POLICY "Usuários podem criar conversas para suas empresas" ON "public"."conversations" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."companies" "c" ON (("p"."cnpj" = "c"."cnpj")))
  WHERE (("p"."user_id" = "auth"."uid"()) AND (("c"."id" = "conversations"."company_a_id") OR ("c"."id" = "conversations"."company_b_id"))))));



CREATE POLICY "Usuários podem enviar mensagens para suas conversas" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."conversations" "conv"
     JOIN "public"."companies" "c" ON ((("c"."id" = "conv"."company_a_id") OR ("c"."id" = "conv"."company_b_id"))))
     JOIN "public"."profiles" "p" ON (("p"."cnpj" = "c"."cnpj")))
  WHERE (("conv"."id" = "messages"."conversation_id") AND ("p"."user_id" = "auth"."uid"())))));



CREATE POLICY "Usuários podem ver RFQs de suas empresas" ON "public"."rfqs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."companies" "c" ON (("p"."cnpj" = "c"."cnpj")))
  WHERE (("p"."user_id" = "auth"."uid"()) AND (("c"."id" = "rfqs"."buyer_company_id") OR ("c"."id" = "rfqs"."supplier_company_id"))))));



CREATE POLICY "Usuários podem ver arquivos de suas conversas" ON "public"."conversation_files" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."conversations" "conv"
     JOIN "public"."companies" "c" ON ((("c"."id" = "conv"."company_a_id") OR ("c"."id" = "conv"."company_b_id"))))
     JOIN "public"."profiles" "p" ON (("p"."cnpj" = "c"."cnpj")))
  WHERE (("conv"."id" = "conversation_files"."conversation_id") AND ("p"."user_id" = "auth"."uid"())))));



CREATE POLICY "Usuários podem ver conversas de suas empresas" ON "public"."conversations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."companies" "c" ON (("p"."cnpj" = "c"."cnpj")))
  WHERE (("p"."user_id" = "auth"."uid"()) AND (("c"."id" = "conversations"."company_a_id") OR ("c"."id" = "conversations"."company_b_id"))))));



CREATE POLICY "Usuários podem ver mensagens das suas conversas" ON "public"."messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."conversations" "conv"
     JOIN "public"."companies" "c" ON ((("c"."id" = "conv"."company_a_id") OR ("c"."id" = "conv"."company_b_id"))))
     JOIN "public"."profiles" "p" ON (("p"."cnpj" = "c"."cnpj")))
  WHERE (("conv"."id" = "messages"."conversation_id") AND ("p"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."access_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_logs_org_admin_select" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING ((("organization_id" IN ( SELECT "c"."id"
   FROM ("public"."companies" "c"
     JOIN "public"."profiles" "p" ON (("p"."cnpj" = "c"."cnpj")))
  WHERE ("p"."user_id" = "auth"."uid"()))) AND (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"public"."app_role"))))));



CREATE POLICY "bu_insert_admin" ON "public"."business_units" FOR INSERT TO "authenticated" WITH CHECK ((("organization_id" = "public"."current_org_id"()) AND "public"."has_role"("auth"."uid"(), "public"."current_org_id"(), 'admin'::"public"."app_role")));



CREATE POLICY "bu_select_same_org" ON "public"."business_units" FOR SELECT TO "authenticated" USING (("organization_id" = "public"."current_org_id"()));



CREATE POLICY "bu_update_admin" ON "public"."business_units" FOR UPDATE TO "authenticated" USING ((("organization_id" = "public"."current_org_id"()) AND "public"."has_role"("auth"."uid"(), "public"."current_org_id"(), 'admin'::"public"."app_role"))) WITH CHECK ((("organization_id" = "public"."current_org_id"()) AND "public"."has_role"("auth"."uid"(), "public"."current_org_id"(), 'admin'::"public"."app_role")));



ALTER TABLE "public"."business_units" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "categories_org_select" ON "public"."categories" FOR SELECT TO "authenticated" USING (("organization_id" = "public"."current_org_id"()));



CREATE POLICY "categories_org_write" ON "public"."categories" TO "authenticated" USING ((("organization_id" = "public"."current_org_id"()) AND ("public"."has_role"("auth"."uid"(), "organization_id", 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), "organization_id", 'buyer'::"public"."app_role")))) WITH CHECK ((("organization_id" = "public"."current_org_id"()) AND ("public"."has_role"("auth"."uid"(), "organization_id", 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), "organization_id", 'buyer'::"public"."app_role"))));



ALTER TABLE "public"."certifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "certifications_read_all" ON "public"."certifications" FOR SELECT USING (true);



ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "companies_select_scoped" ON "public"."companies" FOR SELECT TO "authenticated" USING (("public"."is_super_admin"() OR ("cnpj" IN ( SELECT "p"."cnpj"
   FROM "public"."profiles" "p"
  WHERE (("p"."user_id" = "auth"."uid"()) AND ("p"."cnpj" IS NOT NULL))))));



CREATE POLICY "companies_super_admin_all" ON "public"."companies" TO "authenticated" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



ALTER TABLE "public"."connection_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversation_files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."delegations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "delegations_delete_policy" ON "public"."delegations" FOR DELETE TO "authenticated" USING ((("organization_id" = ( SELECT "operators"."organization_id"
   FROM "public"."operators"
  WHERE ("operators"."id" = "auth"."uid"()))) AND ((( SELECT "operators"."perfil"
   FROM "public"."operators"
  WHERE ("operators"."id" = "auth"."uid"())) = ANY (ARRAY['administrador'::"public"."operator_perfil", 'gestor'::"public"."operator_perfil"])) OR ("operador_origem_id" = "auth"."uid"()))));



CREATE POLICY "delegations_insert_policy" ON "public"."delegations" FOR INSERT TO "authenticated" WITH CHECK ((("organization_id" = ( SELECT "operators"."organization_id"
   FROM "public"."operators"
  WHERE ("operators"."id" = "auth"."uid"()))) AND ((( SELECT "operators"."perfil"
   FROM "public"."operators"
  WHERE ("operators"."id" = "auth"."uid"())) = ANY (ARRAY['administrador'::"public"."operator_perfil", 'gestor'::"public"."operator_perfil"])) OR ("operador_origem_id" = "auth"."uid"()))));



CREATE POLICY "delegations_select_policy" ON "public"."delegations" FOR SELECT TO "authenticated" USING (("organization_id" = ( SELECT "operators"."organization_id"
   FROM "public"."operators"
  WHERE ("operators"."id" = "auth"."uid"()))));



CREATE POLICY "delegations_update_policy" ON "public"."delegations" FOR UPDATE TO "authenticated" USING ((("organization_id" = ( SELECT "operators"."organization_id"
   FROM "public"."operators"
  WHERE ("operators"."id" = "auth"."uid"()))) AND ((( SELECT "operators"."perfil"
   FROM "public"."operators"
  WHERE ("operators"."id" = "auth"."uid"())) = ANY (ARRAY['administrador'::"public"."operator_perfil", 'gestor'::"public"."operator_perfil"])) OR ("operador_origem_id" = "auth"."uid"())))) WITH CHECK ((("organization_id" = ( SELECT "operators"."organization_id"
   FROM "public"."operators"
  WHERE ("operators"."id" = "auth"."uid"()))) AND ((( SELECT "operators"."perfil"
   FROM "public"."operators"
  WHERE ("operators"."id" = "auth"."uid"())) = ANY (ARRAY['administrador'::"public"."operator_perfil", 'gestor'::"public"."operator_perfil"])) OR ("operador_origem_id" = "auth"."uid"()))));



ALTER TABLE "public"."empresa_catalogo" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "empresa_catalogo_org_all" ON "public"."empresa_catalogo" USING (("organization_id" = "public"."current_org_id"()));



CREATE POLICY "empresa_catalogo_read_all" ON "public"."empresa_catalogo" FOR SELECT USING (true);



ALTER TABLE "public"."empresa_certificacoes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "empresa_certificacoes_org_all" ON "public"."empresa_certificacoes" USING (("organization_id" = "public"."current_org_id"()));



CREATE POLICY "empresa_certificacoes_read_all" ON "public"."empresa_certificacoes" FOR SELECT USING (true);



ALTER TABLE "public"."empresa_cnaes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "empresa_cnaes_org_all" ON "public"."empresa_cnaes" USING (("organization_id" = "public"."current_org_id"()));



CREATE POLICY "empresa_cnaes_read_all" ON "public"."empresa_cnaes" FOR SELECT USING (true);



ALTER TABLE "public"."empresa_estados_atendidos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "empresa_estados_atendidos_org_all" ON "public"."empresa_estados_atendidos" USING (("organization_id" = "public"."current_org_id"()));



CREATE POLICY "empresa_estados_atendidos_read_all" ON "public"."empresa_estados_atendidos" FOR SELECT USING (true);



ALTER TABLE "public"."empresa_parceiros" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "empresa_parceiros_org_all" ON "public"."empresa_parceiros" USING ((("organization_id" = "public"."current_org_id"()) OR ("partner_id" = "public"."current_org_id"())));



CREATE POLICY "empresa_parceiros_read_all" ON "public"."empresa_parceiros" FOR SELECT USING (true);



ALTER TABLE "public"."global_invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hubia_signals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hubia_signals_org_read" ON "public"."hubia_signals" FOR SELECT USING (("organization_id" IN ( SELECT "user_roles"."organization_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."internal_request_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "internal_request_items_delete" ON "public"."internal_request_items" FOR DELETE TO "authenticated" USING (("request_id" IN ( SELECT "internal_requests"."id"
   FROM "public"."internal_requests"
  WHERE ("internal_requests"."organization_id" = ( SELECT "operators"."organization_id"
           FROM "public"."operators"
          WHERE ("operators"."id" = "auth"."uid"()))))));



CREATE POLICY "internal_request_items_insert" ON "public"."internal_request_items" FOR INSERT TO "authenticated" WITH CHECK (("request_id" IN ( SELECT "internal_requests"."id"
   FROM "public"."internal_requests"
  WHERE ("internal_requests"."organization_id" = ( SELECT "operators"."organization_id"
           FROM "public"."operators"
          WHERE ("operators"."id" = "auth"."uid"()))))));



CREATE POLICY "internal_request_items_select" ON "public"."internal_request_items" FOR SELECT TO "authenticated" USING (("request_id" IN ( SELECT "internal_requests"."id"
   FROM "public"."internal_requests"
  WHERE ("internal_requests"."organization_id" = ( SELECT "operators"."organization_id"
           FROM "public"."operators"
          WHERE ("operators"."id" = "auth"."uid"()))))));



CREATE POLICY "internal_request_items_update" ON "public"."internal_request_items" FOR UPDATE TO "authenticated" USING (("request_id" IN ( SELECT "internal_requests"."id"
   FROM "public"."internal_requests"
  WHERE ("internal_requests"."organization_id" = ( SELECT "operators"."organization_id"
           FROM "public"."operators"
          WHERE ("operators"."id" = "auth"."uid"()))))));



ALTER TABLE "public"."internal_request_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "internal_request_messages_insert" ON "public"."internal_request_messages" FOR INSERT TO "authenticated" WITH CHECK ((("sender_id" = "auth"."uid"()) AND ("request_id" IN ( SELECT "internal_requests"."id"
   FROM "public"."internal_requests"
  WHERE ("internal_requests"."organization_id" = ( SELECT "operators"."organization_id"
           FROM "public"."operators"
          WHERE ("operators"."id" = "auth"."uid"())))))));



CREATE POLICY "internal_request_messages_select" ON "public"."internal_request_messages" FOR SELECT TO "authenticated" USING (("request_id" IN ( SELECT "internal_requests"."id"
   FROM "public"."internal_requests"
  WHERE ("internal_requests"."organization_id" = ( SELECT "operators"."organization_id"
           FROM "public"."operators"
          WHERE ("operators"."id" = "auth"."uid"()))))));



ALTER TABLE "public"."internal_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "internal_requests_insert" ON "public"."internal_requests" FOR INSERT TO "authenticated" WITH CHECK ((("organization_id" = ( SELECT "operators"."organization_id"
   FROM "public"."operators"
  WHERE ("operators"."id" = "auth"."uid"()))) AND ("requester_id" = "auth"."uid"())));



CREATE POLICY "internal_requests_select" ON "public"."internal_requests" FOR SELECT TO "authenticated" USING (("organization_id" = ( SELECT "operators"."organization_id"
   FROM "public"."operators"
  WHERE ("operators"."id" = "auth"."uid"()))));



CREATE POLICY "internal_requests_update" ON "public"."internal_requests" FOR UPDATE TO "authenticated" USING (("organization_id" = ( SELECT "operators"."organization_id"
   FROM "public"."operators"
  WHERE ("operators"."id" = "auth"."uid"()))));



ALTER TABLE "public"."invitations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invitations_org_all" ON "public"."invitations" USING (("organization_id" = "public"."current_org_id"())) WITH CHECK (("organization_id" = "public"."current_org_id"()));



ALTER TABLE "public"."invites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invites_invitee_select" ON "public"."invites" FOR SELECT TO "authenticated" USING (("email" = (( SELECT "users"."email"
   FROM "auth"."users"
  WHERE ("users"."id" = "auth"."uid"())))::"text"));



CREATE POLICY "invites_super_admin_all" ON "public"."invites" TO "authenticated" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



ALTER TABLE "public"."logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "logs_org_insert" ON "public"."logs" FOR INSERT TO "authenticated" WITH CHECK ((("organization_id" = "public"."get_auth_user_organization_id"()) OR "public"."is_super_admin"()));



CREATE POLICY "logs_org_select" ON "public"."logs" FOR SELECT TO "authenticated" USING ((("organization_id" = "public"."get_auth_user_organization_id"()) OR "public"."is_super_admin"()));



ALTER TABLE "public"."manufacturers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "manufacturers_insert_authored" ON "public"."manufacturers" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "manufacturers_select_all" ON "public"."manufacturers" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "manufacturers_update_super_admin" ON "public"."manufacturers" FOR UPDATE TO "authenticated" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



ALTER TABLE "public"."materials" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "materials_insert_owner_pending" ON "public"."materials" FOR INSERT TO "authenticated" WITH CHECK ((("master_owner_organization_id" = "public"."current_org_id"()) AND ("created_by" = "auth"."uid"()) AND ("validation_status" = 'pending_review'::"public"."material_validation_status") AND ("visibility" = 'private'::"public"."material_visibility") AND ("validated_by" IS NULL) AND ("validated_at" IS NULL) AND ("created_source" = ANY (ARRAY['manual'::"public"."material_source", 'csv_import'::"public"."material_source", 'api'::"public"."material_source", 'ai'::"public"."material_source", 'marketplace'::"public"."material_source"])) AND ("public"."has_role"("auth"."uid"(), "public"."current_org_id"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), "public"."current_org_id"(), 'buyer'::"public"."app_role"))));



CREATE POLICY "materials_select_scoped" ON "public"."materials" FOR SELECT TO "authenticated" USING (("public"."is_super_admin"() OR (("visibility" = 'global'::"public"."material_visibility") AND ("validation_status" = 'validated'::"public"."material_validation_status")) OR ("master_owner_organization_id" = "public"."current_org_id"())));



CREATE POLICY "materials_super_admin_all" ON "public"."materials" TO "authenticated" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "materials_update_owner_pending" ON "public"."materials" FOR UPDATE TO "authenticated" USING ((("master_owner_organization_id" = "public"."current_org_id"()) AND ("validation_status" = ANY (ARRAY['pending_review'::"public"."material_validation_status", 'needs_correction'::"public"."material_validation_status"])) AND ("public"."has_role"("auth"."uid"(), "public"."current_org_id"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), "public"."current_org_id"(), 'buyer'::"public"."app_role")))) WITH CHECK ((("master_owner_organization_id" = "public"."current_org_id"()) AND ("visibility" = 'private'::"public"."material_visibility") AND ("validated_by" IS NULL) AND ("validated_at" IS NULL) AND ("created_source" = ANY (ARRAY['manual'::"public"."material_source", 'csv_import'::"public"."material_source", 'api'::"public"."material_source", 'ai'::"public"."material_source", 'marketplace'::"public"."material_source"])) AND ("validation_status" = ANY (ARRAY['pending_review'::"public"."material_validation_status", 'needs_correction'::"public"."material_validation_status"]))));



ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."number_counters" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "number_counters_select_same_org" ON "public"."number_counters" FOR SELECT TO "authenticated" USING (("organization_id" = "public"."current_org_id"()));



ALTER TABLE "public"."operation_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."operator_invitations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "operator_invitations_org_insert" ON "public"."operator_invitations" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_org_access"("organization_id"));



CREATE POLICY "operator_invitations_org_select" ON "public"."operator_invitations" FOR SELECT TO "authenticated" USING ("public"."has_org_access"("organization_id"));



CREATE POLICY "operator_invitations_org_update" ON "public"."operator_invitations" FOR UPDATE TO "authenticated" USING ("public"."has_org_access"("organization_id"));



ALTER TABLE "public"."operator_segments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "operator_segments_by_operator_delete" ON "public"."operator_segments" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."operators" "op"
  WHERE (("op"."id" = "operator_segments"."operator_id") AND "public"."has_org_access"("op"."organization_id")))));



CREATE POLICY "operator_segments_by_operator_insert" ON "public"."operator_segments" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."operators" "op"
  WHERE (("op"."id" = "operator_segments"."operator_id") AND "public"."has_org_access"("op"."organization_id")))));



CREATE POLICY "operator_segments_by_operator_select" ON "public"."operator_segments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."operators" "op"
  WHERE (("op"."id" = "operator_segments"."operator_id") AND "public"."has_org_access"("op"."organization_id")))));



CREATE POLICY "operator_segments_by_operator_update" ON "public"."operator_segments" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."operators" "op"
  WHERE (("op"."id" = "operator_segments"."operator_id") AND "public"."has_org_access"("op"."organization_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."operators" "op"
  WHERE (("op"."id" = "operator_segments"."operator_id") AND "public"."has_org_access"("op"."organization_id")))));



ALTER TABLE "public"."operator_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."operators" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "operators_insert_self" ON "public"."operators" FOR INSERT TO "authenticated" WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "operators_org_insert" ON "public"."operators" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_org_access"("organization_id") OR "public"."is_super_admin"()));



CREATE POLICY "operators_org_read" ON "public"."operators" FOR SELECT USING (("organization_id" IN ( SELECT "user_roles"."organization_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "operators_org_select" ON "public"."operators" FOR SELECT TO "authenticated" USING (("public"."has_org_access"("organization_id") OR "public"."is_super_admin"()));



CREATE POLICY "operators_org_update" ON "public"."operators" FOR UPDATE TO "authenticated" USING (("public"."has_org_access"("organization_id") OR "public"."is_super_admin"()));



CREATE POLICY "operators_update_self_or_admin" ON "public"."operators" FOR UPDATE TO "authenticated" USING ((("id" = "auth"."uid"()) OR ("organization_id" IN ( SELECT "user_roles"."organization_id"
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role"))))));



CREATE POLICY "org_admin_update" ON "public"."organizations" FOR UPDATE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), "id", 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), "id", 'admin'::"public"."app_role"));



CREATE POLICY "org_members_select" ON "public"."organizations" FOR SELECT TO "authenticated" USING (("id" = "public"."current_org_id"()));



ALTER TABLE "public"."organization_invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_materials" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organization_materials_insert_own" ON "public"."organization_materials" FOR INSERT TO "authenticated" WITH CHECK ((("organization_id" = "public"."current_org_id"()) AND ("public"."has_role"("auth"."uid"(), "organization_id", 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), "organization_id", 'buyer'::"public"."app_role")) AND (("category_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."categories" "c"
  WHERE (("c"."id" = "organization_materials"."category_id") AND ("c"."organization_id" = "c"."organization_id"))))) AND (EXISTS ( SELECT 1
   FROM "public"."materials" "m"
  WHERE (("m"."id" = "organization_materials"."material_id") AND (("m"."master_owner_organization_id" = "organization_materials"."organization_id") OR (("m"."visibility" = 'global'::"public"."material_visibility") AND ("m"."validation_status" = 'validated'::"public"."material_validation_status")) OR "public"."is_super_admin"()))))));



CREATE POLICY "organization_materials_select_own" ON "public"."organization_materials" FOR SELECT TO "authenticated" USING ((("organization_id" = "public"."current_org_id"()) OR "public"."is_super_admin"()));



CREATE POLICY "organization_materials_update_own" ON "public"."organization_materials" FOR UPDATE TO "authenticated" USING ((("organization_id" = "public"."current_org_id"()) AND ("public"."has_role"("auth"."uid"(), "organization_id", 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), "organization_id", 'buyer'::"public"."app_role")))) WITH CHECK ((("organization_id" = "public"."current_org_id"()) AND (("category_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."categories" "c"
  WHERE (("c"."id" = "organization_materials"."category_id") AND ("c"."organization_id" = "c"."organization_id"))))) AND (EXISTS ( SELECT 1
   FROM "public"."materials" "m"
  WHERE (("m"."id" = "organization_materials"."material_id") AND (("m"."master_owner_organization_id" = "organization_materials"."organization_id") OR (("m"."visibility" = 'global'::"public"."material_visibility") AND ("m"."validation_status" = 'validated'::"public"."material_validation_status")) OR "public"."is_super_admin"()))))));



ALTER TABLE "public"."organization_segments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organization_segments_org_all" ON "public"."organization_segments" USING (("organization_id" = "public"."current_org_id"()));



CREATE POLICY "organization_segments_read_all" ON "public"."organization_segments" FOR SELECT USING (true);



ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organizations_select" ON "public"."organizations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "organizations_update" ON "public"."organizations" FOR UPDATE TO "authenticated" USING ((("id" = "public"."get_auth_user_organization_id"()) OR "public"."is_super_admin"()));



ALTER TABLE "public"."product_offers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_offers_select_org" ON "public"."product_offers" FOR SELECT TO "authenticated" USING (("organization_id" = "public"."current_org_id"()));



CREATE POLICY "product_offers_write_org" ON "public"."product_offers" TO "authenticated" USING ((("organization_id" = "public"."current_org_id"()) AND ("public"."has_role"("auth"."uid"(), "organization_id", 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), "organization_id", 'buyer'::"public"."app_role")))) WITH CHECK ((("organization_id" = "public"."current_org_id"()) AND ("public"."has_role"("auth"."uid"(), "organization_id", 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), "organization_id", 'buyer'::"public"."app_role"))));



ALTER TABLE "public"."product_suppliers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_suppliers_org_all" ON "public"."product_suppliers" USING (("organization_id" = "public"."current_org_id"())) WITH CHECK (("organization_id" = "public"."current_org_id"()));



ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "products_org_select" ON "public"."products" FOR SELECT TO "authenticated" USING (("organization_id" = "public"."current_org_id"()));



CREATE POLICY "products_org_write" ON "public"."products" TO "authenticated" USING ((("organization_id" = "public"."current_org_id"()) AND ("public"."has_role"("auth"."uid"(), "organization_id", 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), "organization_id", 'buyer'::"public"."app_role")))) WITH CHECK ((("organization_id" = "public"."current_org_id"()) AND ("public"."has_role"("auth"."uid"(), "organization_id", 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), "organization_id", 'buyer'::"public"."app_role"))));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_select_self_or_org" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR ("organization_id" = "public"."current_org_id"())));



CREATE POLICY "profiles_update_self" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "qi_org_select" ON "public"."quotation_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."quotation_requests" "r"
  WHERE (("r"."id" = "quotation_items"."request_id") AND ("r"."organization_id" = "public"."current_org_id"())))));



CREATE POLICY "qi_org_write" ON "public"."quotation_items" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."quotation_requests" "r"
  WHERE (("r"."id" = "quotation_items"."request_id") AND ("r"."organization_id" = "public"."current_org_id"()) AND ("public"."has_role"("auth"."uid"(), "r"."organization_id", 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), "r"."organization_id", 'buyer'::"public"."app_role")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."quotation_requests" "r"
  WHERE (("r"."id" = "quotation_items"."request_id") AND ("r"."organization_id" = "public"."current_org_id"()) AND ("public"."has_role"("auth"."uid"(), "r"."organization_id", 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), "r"."organization_id", 'buyer'::"public"."app_role"))))));



CREATE POLICY "qr_org_select" ON "public"."quotation_requests" FOR SELECT TO "authenticated" USING (("organization_id" = "public"."current_org_id"()));



CREATE POLICY "qr_org_write" ON "public"."quotation_requests" TO "authenticated" USING ((("organization_id" = "public"."current_org_id"()) AND ("public"."has_role"("auth"."uid"(), "organization_id", 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), "organization_id", 'buyer'::"public"."app_role")))) WITH CHECK ((("organization_id" = "public"."current_org_id"()) AND ("public"."has_role"("auth"."uid"(), "organization_id", 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), "organization_id", 'buyer'::"public"."app_role"))));



ALTER TABLE "public"."quotation_decisions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quotation_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quotation_number_counters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quotation_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rfqs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "roles_select_self_or_admin" ON "public"."user_roles" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), "organization_id", 'admin'::"public"."app_role")));



ALTER TABLE "public"."segments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "segments_delete_policy" ON "public"."segments" FOR DELETE USING (((("organization_id" = "public"."get_auth_user_organization_id"()) AND "public"."has_role"("auth"."uid"(), "organization_id", 'admin'::"public"."app_role")) OR "public"."is_super_admin"()));



CREATE POLICY "segments_insert_policy" ON "public"."segments" FOR INSERT WITH CHECK (((("organization_id" = "public"."get_auth_user_organization_id"()) AND "public"."has_role"("auth"."uid"(), "organization_id", 'admin'::"public"."app_role")) OR "public"."is_super_admin"()));



CREATE POLICY "segments_select_policy" ON "public"."segments" FOR SELECT USING ((("organization_id" = "public"."get_auth_user_organization_id"()) OR ("organization_id" IS NULL) OR "public"."is_super_admin"()));



CREATE POLICY "segments_update_policy" ON "public"."segments" FOR UPDATE USING (((("organization_id" = "public"."get_auth_user_organization_id"()) AND "public"."has_role"("auth"."uid"(), "organization_id", 'admin'::"public"."app_role")) OR "public"."is_super_admin"())) WITH CHECK (((("organization_id" = "public"."get_auth_user_organization_id"()) AND "public"."has_role"("auth"."uid"(), "organization_id", 'admin'::"public"."app_role")) OR "public"."is_super_admin"()));



CREATE POLICY "sq_org_or_supplier_select" ON "public"."supplier_quotations" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."quotation_requests" "r"
  WHERE (("r"."id" = "supplier_quotations"."request_id") AND ("r"."organization_id" = "public"."current_org_id"())))) OR (EXISTS ( SELECT 1
   FROM "public"."suppliers" "s"
  WHERE (("s"."id" = "supplier_quotations"."supplier_id") AND ("s"."user_id" = "auth"."uid"()))))));



CREATE POLICY "sq_org_write" ON "public"."supplier_quotations" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."quotation_requests" "r"
  WHERE (("r"."id" = "supplier_quotations"."request_id") AND ("r"."organization_id" = "public"."current_org_id"()) AND ("public"."has_role"("auth"."uid"(), "r"."organization_id", 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), "r"."organization_id", 'buyer'::"public"."app_role")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."quotation_requests" "r"
  WHERE (("r"."id" = "supplier_quotations"."request_id") AND ("r"."organization_id" = "public"."current_org_id"()) AND ("public"."has_role"("auth"."uid"(), "r"."organization_id", 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), "r"."organization_id", 'buyer'::"public"."app_role"))))));



CREATE POLICY "sq_supplier_update" ON "public"."supplier_quotations" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."suppliers" "s"
  WHERE (("s"."id" = "supplier_quotations"."supplier_id") AND ("s"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."suppliers" "s"
  WHERE (("s"."id" = "supplier_quotations"."supplier_id") AND ("s"."user_id" = "auth"."uid"())))));



CREATE POLICY "sqi_org_write" ON "public"."supplier_quotation_items" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."supplier_quotations" "sq"
     JOIN "public"."quotation_requests" "r" ON (("r"."id" = "sq"."request_id")))
  WHERE (("sq"."id" = "supplier_quotation_items"."supplier_quotation_id") AND ("r"."organization_id" = "public"."current_org_id"()) AND ("public"."has_role"("auth"."uid"(), "r"."organization_id", 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), "r"."organization_id", 'buyer'::"public"."app_role")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."supplier_quotations" "sq"
     JOIN "public"."quotation_requests" "r" ON (("r"."id" = "sq"."request_id")))
  WHERE (("sq"."id" = "supplier_quotation_items"."supplier_quotation_id") AND ("r"."organization_id" = "public"."current_org_id"()) AND ("public"."has_role"("auth"."uid"(), "r"."organization_id", 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), "r"."organization_id", 'buyer'::"public"."app_role"))))));



CREATE POLICY "sqi_select" ON "public"."supplier_quotation_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."supplier_quotations" "sq"
     JOIN "public"."quotation_requests" "r" ON (("r"."id" = "sq"."request_id")))
  WHERE (("sq"."id" = "supplier_quotation_items"."supplier_quotation_id") AND (("r"."organization_id" = "public"."current_org_id"()) OR (EXISTS ( SELECT 1
           FROM "public"."suppliers" "s"
          WHERE (("s"."id" = "sq"."supplier_id") AND ("s"."user_id" = "auth"."uid"())))))))));



CREATE POLICY "sqi_supplier_write" ON "public"."supplier_quotation_items" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."supplier_quotations" "sq"
     JOIN "public"."suppliers" "s" ON (("s"."id" = "sq"."supplier_id")))
  WHERE (("sq"."id" = "supplier_quotation_items"."supplier_quotation_id") AND ("s"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."supplier_quotations" "sq"
     JOIN "public"."suppliers" "s" ON (("s"."id" = "sq"."supplier_id")))
  WHERE (("sq"."id" = "supplier_quotation_items"."supplier_quotation_id") AND ("s"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."supplier_quotation_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supplier_quotations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supplier_segments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."suppliers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "suppliers_org_select" ON "public"."suppliers" FOR SELECT TO "authenticated" USING ((("organization_id" = "public"."current_org_id"()) OR ("user_id" = "auth"."uid"())));



CREATE POLICY "suppliers_org_write" ON "public"."suppliers" TO "authenticated" USING ((("organization_id" = "public"."current_org_id"()) AND ("public"."has_role"("auth"."uid"(), "organization_id", 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), "organization_id", 'supplier_manager'::"public"."app_role")))) WITH CHECK ((("organization_id" = "public"."current_org_id"()) AND ("public"."has_role"("auth"."uid"(), "organization_id", 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), "organization_id", 'supplier_manager'::"public"."app_role"))));



CREATE POLICY "suppliers_self_update" ON "public"."suppliers" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "tenant_isolation_policy_bids" ON "public"."supplier_quotations" TO "authenticated" USING ((("supplier_id" IN ( SELECT "suppliers"."id"
   FROM "public"."suppliers"
  WHERE ("suppliers"."organization_id" = "public"."get_auth_user_organization_id"()))) OR ("request_id" IN ( SELECT "quotation_requests"."id"
   FROM "public"."quotation_requests"
  WHERE ("quotation_requests"."organization_id" = "public"."get_auth_user_organization_id"()))) OR "public"."is_super_admin"()));



CREATE POLICY "tenant_isolation_policy_categories" ON "public"."categories" TO "authenticated" USING ((("organization_id" = "public"."get_auth_user_organization_id"()) OR "public"."is_super_admin"()));



CREATE POLICY "tenant_isolation_policy_products" ON "public"."products" TO "authenticated" USING ((("organization_id" = "public"."get_auth_user_organization_id"()) OR "public"."is_super_admin"()));



CREATE POLICY "tenant_isolation_policy_quotations" ON "public"."quotation_requests" TO "authenticated" USING ((("organization_id" = "public"."get_auth_user_organization_id"()) OR "public"."is_super_admin"()));



CREATE POLICY "tenant_isolation_policy_suppliers" ON "public"."suppliers" TO "authenticated" USING ((("organization_id" = "public"."get_auth_user_organization_id"()) OR "public"."is_super_admin"()));



ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_read_policy" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("id" = "auth"."uid"()) OR ("organization_id" = "public"."get_auth_user_organization_id"()) OR "public"."is_super_admin"()));



CREATE POLICY "users_update_policy" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((("id" = "auth"."uid"()) OR "public"."is_super_admin"())) WITH CHECK ((("id" = "auth"."uid"()) OR "public"."is_super_admin"()));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."block_is_superadmin_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."block_is_superadmin_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."block_is_superadmin_update"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_invite"("p_invite_id" "uuid", "p_phone" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_invite"("p_invite_id" "uuid", "p_phone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_invite"("p_invite_id" "uuid", "p_phone" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_invite"("p_invite_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_invite"("p_invite_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_invite"("p_invite_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."complete_onboarding"("p_token" "text", "p_auth_id" "uuid", "p_email" "text", "p_full_name" "text", "p_role" "text", "p_org_name" "text", "p_org_trade_name" "text", "p_org_document" "text", "p_org_city" "text", "p_org_state" "text", "p_org_website" "text", "p_segments" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."complete_onboarding"("p_token" "text", "p_auth_id" "uuid", "p_email" "text", "p_full_name" "text", "p_role" "text", "p_org_name" "text", "p_org_trade_name" "text", "p_org_document" "text", "p_org_city" "text", "p_org_state" "text", "p_org_website" "text", "p_segments" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_onboarding"("p_token" "text", "p_auth_id" "uuid", "p_email" "text", "p_full_name" "text", "p_role" "text", "p_org_name" "text", "p_org_trade_name" "text", "p_org_document" "text", "p_org_city" "text", "p_org_state" "text", "p_org_website" "text", "p_segments" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_orc_revision"("p_quotation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_orc_revision"("p_quotation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_orc_revision"("p_quotation_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_quotation_request"("p_notes" "text", "p_due_date" "date", "p_priority_level" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_quotation_request"("p_notes" "text", "p_due_date" "date", "p_priority_level" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_quotation_request"("p_notes" "text", "p_due_date" "date", "p_priority_level" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_rfq_from_conversation"("p_conversation_id" "uuid", "p_buyer_company_id" "uuid", "p_supplier_company_id" "uuid", "p_title" "text", "p_description" "text", "p_category" "text", "p_quantity" numeric, "p_unit" "text", "p_deadline" timestamp with time zone, "p_profile_id" "uuid", "p_supplier_sku" "text", "p_manufacturer_sku" "text", "p_brand" "text", "p_notes" "text", "p_direct_contract_reason" "text", "p_purchase_origin" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_rfq_from_conversation"("p_conversation_id" "uuid", "p_buyer_company_id" "uuid", "p_supplier_company_id" "uuid", "p_title" "text", "p_description" "text", "p_category" "text", "p_quantity" numeric, "p_unit" "text", "p_deadline" timestamp with time zone, "p_profile_id" "uuid", "p_supplier_sku" "text", "p_manufacturer_sku" "text", "p_brand" "text", "p_notes" "text", "p_direct_contract_reason" "text", "p_purchase_origin" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_rfq_from_conversation"("p_conversation_id" "uuid", "p_buyer_company_id" "uuid", "p_supplier_company_id" "uuid", "p_title" "text", "p_description" "text", "p_category" "text", "p_quantity" numeric, "p_unit" "text", "p_deadline" timestamp with time zone, "p_profile_id" "uuid", "p_supplier_sku" "text", "p_manufacturer_sku" "text", "p_brand" "text", "p_notes" "text", "p_direct_contract_reason" "text", "p_purchase_origin" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."current_org_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_org_id"() TO "service_role";
GRANT ALL ON FUNCTION "public"."current_org_id"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_auth_user_organization_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_auth_user_organization_id"() TO "service_role";
GRANT ALL ON FUNCTION "public"."get_auth_user_organization_id"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_company_matches"("p_company_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_company_matches"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_company_matches"("p_company_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_invite_details"("p_invite_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_invite_details"("p_invite_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_invite_details"("p_invite_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_user_company_ids"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_company_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_company_ids"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_any_role"("_user_id" "uuid", "_org_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_any_role"("_user_id" "uuid", "_org_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."has_any_role"("_user_id" "uuid", "_org_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."has_org_access"("org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_org_access"("org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_org_access"("org_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_org_id" "uuid", "_role" "public"."app_role") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_org_id" "uuid", "_role" "public"."app_role") TO "service_role";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_org_id" "uuid", "_role" "public"."app_role") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."insert_audit_log"("p_action_type" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_metadata" "jsonb", "p_organization_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."insert_audit_log"("p_action_type" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_metadata" "jsonb", "p_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_audit_log"("p_action_type" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_metadata" "jsonb", "p_organization_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_super_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "service_role";
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."manage_operator"("p_target_user_id" "uuid", "p_action" "text", "p_new_role" "text", "p_new_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."manage_operator"("p_target_user_id" "uuid", "p_action" "text", "p_new_role" "text", "p_new_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."manage_operator"("p_target_user_id" "uuid", "p_action" "text", "p_new_role" "text", "p_new_status" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."next_document_number"("p_org_id" "uuid", "p_business_unit_id" "uuid", "p_entity_type" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."next_document_number"("p_org_id" "uuid", "p_business_unit_id" "uuid", "p_entity_type" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."next_orc_number"("p_org_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."next_orc_number"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."next_orc_number"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."next_orc_number"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_category_name"("_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_category_name"("_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_category_name"("_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_text_key"("_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_text_key"("_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_text_key"("_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_on_connection_accepted"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_on_connection_accepted"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_on_connection_accepted"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_on_connection_request"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_on_connection_request"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_on_connection_request"() TO "service_role";



GRANT ALL ON FUNCTION "public"."protect_material_admin_fields"() TO "anon";
GRANT ALL ON FUNCTION "public"."protect_material_admin_fields"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."protect_material_admin_fields"() TO "service_role";



GRANT ALL ON FUNCTION "public"."protect_quotation_item_snapshot"() TO "anon";
GRANT ALL ON FUNCTION "public"."protect_quotation_item_snapshot"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."protect_quotation_item_snapshot"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_category_normalized_name"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_category_normalized_name"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_category_normalized_name"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_manufacturer_normalized"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_manufacturer_normalized"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_manufacturer_normalized"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_material_normalized"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_material_normalized"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_material_normalized"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."start_hubia_conversation"("p_source_company_id" "uuid", "p_target_company_id" "uuid", "p_system_message" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."start_hubia_conversation"("p_source_company_id" "uuid", "p_target_company_id" "uuid", "p_system_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."start_hubia_conversation"("p_source_company_id" "uuid", "p_target_company_id" "uuid", "p_system_message" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_all_hub_scores"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_all_hub_scores"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_connection_requests_modtime"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_connection_requests_modtime"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_organization_hub_score"("org_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_organization_hub_score"("org_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_updated_at_column"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_company_invite"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_company_invite"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_company_invite"("p_token" "text") TO "service_role";



GRANT ALL ON TABLE "public"."access_logs" TO "anon";
GRANT ALL ON TABLE "public"."access_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."access_logs" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."business_units" TO "anon";
GRANT ALL ON TABLE "public"."business_units" TO "authenticated";
GRANT ALL ON TABLE "public"."business_units" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."certifications" TO "anon";
GRANT ALL ON TABLE "public"."certifications" TO "authenticated";
GRANT ALL ON TABLE "public"."certifications" TO "service_role";



GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";



GRANT ALL ON TABLE "public"."company_segments" TO "anon";
GRANT ALL ON TABLE "public"."company_segments" TO "authenticated";
GRANT ALL ON TABLE "public"."company_segments" TO "service_role";



GRANT ALL ON TABLE "public"."connection_requests" TO "anon";
GRANT ALL ON TABLE "public"."connection_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."connection_requests" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_files" TO "anon";
GRANT ALL ON TABLE "public"."conversation_files" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_files" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."delegations" TO "anon";
GRANT ALL ON TABLE "public"."delegations" TO "authenticated";
GRANT ALL ON TABLE "public"."delegations" TO "service_role";



GRANT ALL ON TABLE "public"."empresa_catalogo" TO "anon";
GRANT ALL ON TABLE "public"."empresa_catalogo" TO "authenticated";
GRANT ALL ON TABLE "public"."empresa_catalogo" TO "service_role";



GRANT ALL ON TABLE "public"."empresa_certificacoes" TO "anon";
GRANT ALL ON TABLE "public"."empresa_certificacoes" TO "authenticated";
GRANT ALL ON TABLE "public"."empresa_certificacoes" TO "service_role";



GRANT ALL ON TABLE "public"."empresa_cnaes" TO "anon";
GRANT ALL ON TABLE "public"."empresa_cnaes" TO "authenticated";
GRANT ALL ON TABLE "public"."empresa_cnaes" TO "service_role";



GRANT ALL ON TABLE "public"."empresa_estados_atendidos" TO "anon";
GRANT ALL ON TABLE "public"."empresa_estados_atendidos" TO "authenticated";
GRANT ALL ON TABLE "public"."empresa_estados_atendidos" TO "service_role";



GRANT ALL ON TABLE "public"."empresa_parceiros" TO "anon";
GRANT ALL ON TABLE "public"."empresa_parceiros" TO "authenticated";
GRANT ALL ON TABLE "public"."empresa_parceiros" TO "service_role";



GRANT ALL ON TABLE "public"."global_invites" TO "anon";
GRANT ALL ON TABLE "public"."global_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."global_invites" TO "service_role";



GRANT ALL ON TABLE "public"."hubia_signals" TO "anon";
GRANT ALL ON TABLE "public"."hubia_signals" TO "authenticated";
GRANT ALL ON TABLE "public"."hubia_signals" TO "service_role";



GRANT ALL ON TABLE "public"."internal_request_items" TO "anon";
GRANT ALL ON TABLE "public"."internal_request_items" TO "authenticated";
GRANT ALL ON TABLE "public"."internal_request_items" TO "service_role";



GRANT ALL ON TABLE "public"."internal_request_messages" TO "anon";
GRANT ALL ON TABLE "public"."internal_request_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."internal_request_messages" TO "service_role";



GRANT ALL ON TABLE "public"."internal_requests" TO "anon";
GRANT ALL ON TABLE "public"."internal_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."internal_requests" TO "service_role";



GRANT ALL ON TABLE "public"."invitations" TO "anon";
GRANT ALL ON TABLE "public"."invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."invitations" TO "service_role";



GRANT ALL ON TABLE "public"."invites" TO "anon";
GRANT ALL ON TABLE "public"."invites" TO "authenticated";
GRANT ALL ON TABLE "public"."invites" TO "service_role";



GRANT ALL ON TABLE "public"."logs" TO "anon";
GRANT ALL ON TABLE "public"."logs" TO "authenticated";
GRANT ALL ON TABLE "public"."logs" TO "service_role";



GRANT ALL ON TABLE "public"."manufacturers" TO "anon";
GRANT ALL ON TABLE "public"."manufacturers" TO "authenticated";
GRANT ALL ON TABLE "public"."manufacturers" TO "service_role";



GRANT ALL ON TABLE "public"."materials" TO "anon";
GRANT ALL ON TABLE "public"."materials" TO "authenticated";
GRANT ALL ON TABLE "public"."materials" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."number_counters" TO "anon";
GRANT ALL ON TABLE "public"."number_counters" TO "authenticated";
GRANT ALL ON TABLE "public"."number_counters" TO "service_role";



GRANT ALL ON TABLE "public"."operation_logs" TO "anon";
GRANT ALL ON TABLE "public"."operation_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."operation_logs" TO "service_role";



GRANT ALL ON TABLE "public"."operator_categories" TO "anon";
GRANT ALL ON TABLE "public"."operator_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."operator_categories" TO "service_role";



GRANT ALL ON TABLE "public"."operator_invitations" TO "anon";
GRANT ALL ON TABLE "public"."operator_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."operator_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."operator_segments" TO "anon";
GRANT ALL ON TABLE "public"."operator_segments" TO "authenticated";
GRANT ALL ON TABLE "public"."operator_segments" TO "service_role";



GRANT ALL ON TABLE "public"."operator_sessions" TO "anon";
GRANT ALL ON TABLE "public"."operator_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."operator_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."operators" TO "anon";
GRANT ALL ON TABLE "public"."operators" TO "authenticated";
GRANT ALL ON TABLE "public"."operators" TO "service_role";



GRANT ALL ON TABLE "public"."organization_invites" TO "anon";
GRANT ALL ON TABLE "public"."organization_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_invites" TO "service_role";



GRANT ALL ON TABLE "public"."organization_materials" TO "anon";
GRANT ALL ON TABLE "public"."organization_materials" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_materials" TO "service_role";



GRANT ALL ON TABLE "public"."organization_segments" TO "anon";
GRANT ALL ON TABLE "public"."organization_segments" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_segments" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."product_offers" TO "anon";
GRANT ALL ON TABLE "public"."product_offers" TO "authenticated";
GRANT ALL ON TABLE "public"."product_offers" TO "service_role";



GRANT ALL ON TABLE "public"."product_suppliers" TO "anon";
GRANT ALL ON TABLE "public"."product_suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."product_suppliers" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."quotation_decisions" TO "anon";
GRANT ALL ON TABLE "public"."quotation_decisions" TO "authenticated";
GRANT ALL ON TABLE "public"."quotation_decisions" TO "service_role";



GRANT ALL ON TABLE "public"."quotation_items" TO "anon";
GRANT ALL ON TABLE "public"."quotation_items" TO "authenticated";
GRANT ALL ON TABLE "public"."quotation_items" TO "service_role";



GRANT ALL ON TABLE "public"."quotation_number_counters" TO "anon";
GRANT ALL ON TABLE "public"."quotation_number_counters" TO "authenticated";
GRANT ALL ON TABLE "public"."quotation_number_counters" TO "service_role";



GRANT ALL ON TABLE "public"."quotation_requests" TO "anon";
GRANT ALL ON TABLE "public"."quotation_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."quotation_requests" TO "service_role";



GRANT ALL ON TABLE "public"."rfqs" TO "anon";
GRANT ALL ON TABLE "public"."rfqs" TO "authenticated";
GRANT ALL ON TABLE "public"."rfqs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."rfqs_rfq_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."rfqs_rfq_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."rfqs_rfq_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."segments" TO "anon";
GRANT ALL ON TABLE "public"."segments" TO "authenticated";
GRANT ALL ON TABLE "public"."segments" TO "service_role";



GRANT ALL ON TABLE "public"."supplier_categories" TO "anon";
GRANT ALL ON TABLE "public"."supplier_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier_categories" TO "service_role";



GRANT ALL ON TABLE "public"."supplier_quotation_items" TO "anon";
GRANT ALL ON TABLE "public"."supplier_quotation_items" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier_quotation_items" TO "service_role";



GRANT ALL ON TABLE "public"."supplier_quotations" TO "anon";
GRANT ALL ON TABLE "public"."supplier_quotations" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier_quotations" TO "service_role";



GRANT ALL ON TABLE "public"."supplier_segments" TO "anon";
GRANT ALL ON TABLE "public"."supplier_segments" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier_segments" TO "service_role";



GRANT ALL ON TABLE "public"."suppliers" TO "anon";
GRANT ALL ON TABLE "public"."suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."suppliers" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







