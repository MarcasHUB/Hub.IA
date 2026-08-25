-- 1. admin_get_organization_details
CREATE OR REPLACE FUNCTION public.admin_get_organization_details(p_target_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT private.is_current_platform_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT jsonb_build_object(
    'identificacao', jsonb_build_object(
      'id', o.id,
      'name', o.name,
      'razao_social', o.razao_social,
      'nome_fantasia', o.nome_fantasia,
      'cnpj', o.cnpj,
      'status', o.status,
      'logo_url', o.logo_url,
      'profile_completion', o.profile_completion
    ),
    'fiscal', jsonb_build_object(
      'inscricao_estadual', o.inscricao_estadual,
      'inscricao_municipal', o.inscricao_municipal,
      'situacao_cadastral', o.situacao_cadastral,
      'data_abertura', o.data_abertura,
      'natureza_juridica', o.natureza_juridica,
      'cnae_principal', o.cnae_principal,
      'atividade_principal', o.atividade_principal,
      'cnaes_secundarios', (
         SELECT coalesce(jsonb_agg(jsonb_build_object('cnae', ec.cnae_code, 'description', ec.description) ORDER BY ec.cnae_code), '[]'::jsonb)
         FROM public.empresa_cnaes ec
         WHERE ec.organization_id = o.id AND (ec.is_primary IS FALSE OR ec.is_primary IS NULL)
      )
    ),
    'contato', jsonb_build_object(
      'email_corporativo', o.email_corporativo,
      'business_email', o.business_email,
      'phone', o.phone,
      'telefone', o.telefone,
      'whatsapp', o.whatsapp,
      'website', o.website,
      'linkedin_url', o.linkedin_url
    ),
    'endereco', jsonb_build_object(
      'address_zip_code', o.address_zip_code,
      'address_street', o.address_street,
      'address_number', o.address_number,
      'address_complement', o.address_complement,
      'address_neighborhood', o.address_neighborhood,
      'address_reference', o.address_reference,
      'city', o.city,
      'state', o.state,
      'country', o.country
    ),
    'perfil', jsonb_build_object(
      'tipo_empresa', o.tipo_empresa,
      'perfil_comercial', o.perfil_comercial,
      'business_model', o.business_model,
      'company_size', o.company_size,
      'geographic_coverage_type', o.geographic_coverage_type,
      'tipo_cobertura', o.tipo_cobertura,
      'raio_atendimento_km', o.raio_atendimento_km,
      'recebe_oportunidades', o.recebe_oportunidades,
      'nivel_interesse', o.nivel_interesse
    ),
    'canonicos', jsonb_build_object(
      'segmentos', (
         SELECT coalesce(jsonb_agg(s.nome ORDER BY s.nome), '[]'::jsonb)
         FROM public.organization_segments os
         JOIN public.segments s ON s.id = os.segment_id
         WHERE os.organization_id = o.id
      ),
      'certificacoes', (
         SELECT coalesce(jsonb_agg(c.name ORDER BY c.name), '[]'::jsonb)
         FROM public.empresa_certificacoes ec
         JOIN public.certifications c ON c.id = ec.certification_id
         WHERE ec.organization_id = o.id
      ),
      'estados_atendidos', (
         SELECT coalesce(jsonb_agg(ea.state_code ORDER BY ea.state_code), '[]'::jsonb)
         FROM public.empresa_estados_atendidos ea
         WHERE ea.organization_id = o.id
      )
    ),
    'sistema', jsonb_build_object(
      'slug', o.slug,
      'created_at', o.created_at,
      'updated_at', o.updated_at,
      'ultima_sincronizacao_receita', o.ultima_sincronizacao_receita,
      'nivel_confianca_cadastro', o.nivel_confianca_cadastro
    )
  ) INTO v_result
  FROM public.organizations o
  WHERE o.id = p_target_organization_id;

  RETURN coalesce(v_result, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_organization_details(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_get_organization_details(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_get_organization_details(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_organization_details(uuid) TO service_role;

-- 2. support_tickets and support_messages
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name_snapshot text,
  subject text NOT NULL,
  category text NOT NULL,
  module text NOT NULL,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'open',
  affected_entity_type text,
  affected_entity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  CONSTRAINT support_tickets_priority_check CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  CONSTRAINT support_tickets_status_check CHECK (status IN ('open', 'in_progress', 'waiting_company', 'resolved', 'closed')),
  CONSTRAINT support_tickets_category_check CHECK (category IN ('access', 'company_registration', 'invites', 'network_partners', 'materials', 'quotations', 'system_error', 'other')),
  CONSTRAINT support_tickets_subject_check CHECK (length(trim(subject)) > 0),
  CONSTRAINT support_tickets_entity_check CHECK (
    (affected_entity_type IS NULL AND affected_entity_id IS NULL) OR
    (affected_entity_type IS NOT NULL AND affected_entity_id IS NOT NULL AND affected_entity_type IN ('quotation_request', 'supplier_quotation'))
  )
);

CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_name_snapshot text,
  sender_organization_id uuid REFERENCES public.organizations(id),
  sender_type text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  CONSTRAINT support_messages_sender_type_check CHECK (sender_type IN ('tenant', 'support', 'system')),
  CONSTRAINT support_messages_content_check CHECK (length(trim(content)) > 0)
);

CREATE INDEX idx_support_tickets_organization_id ON public.support_tickets(organization_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_updated_at ON public.support_tickets(updated_at);
CREATE INDEX idx_support_messages_ticket_id ON public.support_messages(ticket_id);
CREATE INDEX idx_support_messages_created_at ON public.support_messages(created_at);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
CREATE POLICY "Tenant SELECT tickets" ON public.support_tickets FOR SELECT
USING (organization_id = (SELECT organization_id FROM private.current_identity()));

CREATE POLICY "Platform Admin SELECT tickets" ON public.support_tickets FOR SELECT
USING (private.is_current_platform_admin());

CREATE POLICY "Tenant SELECT messages" ON public.support_messages FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.support_tickets t
  WHERE t.id = ticket_id AND t.organization_id = (SELECT organization_id FROM private.current_identity())
));

CREATE POLICY "Platform Admin SELECT messages" ON public.support_messages FOR SELECT
USING (private.is_current_platform_admin());

-- Writes are ONLY done via RPC, so no INSERT/UPDATE policies for tenants or admins on these tables.

-- 4. RPCs for writing
CREATE OR REPLACE FUNCTION public.support_create_ticket(
  p_subject text,
  p_category text,
  p_module text,
  p_priority text,
  p_content text,
  p_affected_entity_type text DEFAULT NULL,
  p_affected_entity_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_org_id uuid;
  v_ticket_id uuid;
  v_user_name text;
BEGIN
  v_org_id := (SELECT organization_id FROM private.current_identity());
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Organização não encontrada para o tenant';
  END IF;
  
  -- Validate Ownership
  IF p_affected_entity_type = 'quotation_request' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.quotation_requests WHERE id = p_affected_entity_id AND organization_id = v_org_id
    ) THEN
      RAISE EXCEPTION 'SUPPORT_AFFECTED_ENTITY_NOT_OWNED';
    END IF;
  ELSIF p_affected_entity_type = 'supplier_quotation' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.supplier_quotations sq
      JOIN public.suppliers s ON sq.supplier_id = s.id
      WHERE sq.id = p_affected_entity_id AND s.organization_id = v_org_id
    ) THEN
      RAISE EXCEPTION 'SUPPORT_AFFECTED_ENTITY_NOT_OWNED';
    END IF;
  END IF;

  v_user_name := (SELECT coalesce(nome || ' ' || sobrenome, 'Usuário') FROM public.operators WHERE auth_user_id = auth.uid() LIMIT 1);
  IF v_user_name IS NULL THEN
     v_user_name := 'Admin Global';
  END IF;

  INSERT INTO public.support_tickets (
    organization_id, created_by, created_by_name_snapshot, subject, category, module, priority,
    affected_entity_type, affected_entity_id
  ) VALUES (
    v_org_id, auth.uid(), v_user_name, p_subject, p_category, p_module, p_priority,
    p_affected_entity_type, p_affected_entity_id
  ) RETURNING id INTO v_ticket_id;

  INSERT INTO public.support_messages (
    ticket_id, sender_user_id, sender_name_snapshot, sender_organization_id, sender_type, content
  ) VALUES (
    v_ticket_id, auth.uid(), v_user_name, v_org_id, 'tenant', p_content
  );

  RETURN v_ticket_id;
END;
$$;

REVOKE ALL ON FUNCTION public.support_create_ticket(text, text, text, text, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.support_create_ticket(text, text, text, text, text, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.support_create_ticket(text, text, text, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.support_create_ticket(text, text, text, text, text, text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.support_send_message(
  p_ticket_id uuid,
  p_content text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_org_id uuid;
  v_sender_type text;
  v_msg_id uuid;
  v_is_admin boolean;
  v_ticket record;
  v_user_name text;
BEGIN
  v_is_admin := private.is_current_platform_admin();
  
  SELECT * INTO v_ticket FROM public.support_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SUPPORT_TICKET_NOT_FOUND';
  END IF;
  
  IF v_ticket.status = 'closed' THEN
    RAISE EXCEPTION 'SUPPORT_TICKET_CLOSED';
  END IF;

  IF v_is_admin THEN
    v_sender_type := 'support';
    v_org_id := NULL;
    v_user_name := 'Suporte Hub.IA';
  ELSE
    v_org_id := (SELECT organization_id FROM private.current_identity());
    IF v_org_id IS NULL THEN
      RAISE EXCEPTION 'Tenant não identificado';
    END IF;
    IF v_ticket.organization_id != v_org_id THEN
      RAISE EXCEPTION 'Acesso negado';
    END IF;
    v_sender_type := 'tenant';
    v_user_name := (SELECT coalesce(nome || ' ' || sobrenome, 'Usuário') FROM public.operators WHERE auth_user_id = auth.uid() LIMIT 1);
  END IF;

  INSERT INTO public.support_messages (
    ticket_id, sender_user_id, sender_name_snapshot, sender_organization_id, sender_type, content
  ) VALUES (
    p_ticket_id, auth.uid(), v_user_name, v_org_id, v_sender_type, p_content
  ) RETURNING id INTO v_msg_id;
  
  -- Reopen if resolved and tenant replies
  IF v_sender_type = 'tenant' AND v_ticket.status = 'resolved' THEN
    UPDATE public.support_tickets SET status = 'open', updated_at = now() WHERE id = p_ticket_id;
  ELSE
    UPDATE public.support_tickets SET updated_at = now() WHERE id = p_ticket_id;
  END IF;

  RETURN v_msg_id;
END;
$$;

REVOKE ALL ON FUNCTION public.support_send_message(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.support_send_message(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.support_send_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.support_send_message(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.support_update_ticket(
  p_ticket_id uuid,
  p_status text DEFAULT NULL,
  p_priority text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_ticket record;
BEGIN
  IF NOT private.is_current_platform_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  
  SELECT * INTO v_ticket FROM public.support_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SUPPORT_TICKET_NOT_FOUND';
  END IF;

  IF p_status IS NOT NULL THEN
    IF p_status NOT IN ('open', 'in_progress', 'waiting_company', 'resolved', 'closed') THEN
      RAISE EXCEPTION 'Status inválido';
    END IF;
    v_ticket.status := p_status;
    IF p_status = 'closed' THEN
       v_ticket.closed_at := now();
    ELSE
       v_ticket.closed_at := NULL;
    END IF;
  END IF;

  IF p_priority IS NOT NULL THEN
    IF p_priority NOT IN ('low', 'normal', 'high', 'urgent') THEN
       RAISE EXCEPTION 'Prioridade inválida';
    END IF;
    v_ticket.priority := p_priority;
  END IF;
  
  UPDATE public.support_tickets
  SET status = v_ticket.status,
      priority = v_ticket.priority,
      closed_at = v_ticket.closed_at,
      updated_at = now()
  WHERE id = p_ticket_id;
END;
$$;

REVOKE ALL ON FUNCTION public.support_update_ticket(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.support_update_ticket(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.support_update_ticket(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.support_update_ticket(uuid, text, text) TO service_role;

-- 5. Quotation Context RPC
CREATE OR REPLACE FUNCTION public.support_get_reported_quotation_context(p_ticket_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_ticket record;
  v_result jsonb;
BEGIN
  IF NOT private.is_current_platform_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT * INTO v_ticket FROM public.support_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket não encontrado';
  END IF;

  IF v_ticket.status NOT IN ('open', 'in_progress', 'waiting_company') THEN
    RAISE EXCEPTION 'Ticket fechado ou resolvido';
  END IF;

  IF v_ticket.affected_entity_type IS NULL OR v_ticket.affected_entity_id IS NULL THEN
    RAISE EXCEPTION 'Contexto não fornecido';
  END IF;

  IF v_ticket.affected_entity_type = 'quotation_request' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.quotation_requests
      WHERE id = v_ticket.affected_entity_id AND organization_id = v_ticket.organization_id
    ) THEN
      RAISE EXCEPTION 'Acesso negado (ownership inválida)';
    END IF;
    
    SELECT jsonb_build_object(
      'id', q.id,
      'title', q.title,
      'status', q.status,
      'due_date', q.due_date,
      'priority_level', q.priority_level,
      'notes', q.notes,
      'created_at', q.created_at,
      'updated_at', q.updated_at
    ) INTO v_result
    FROM public.quotation_requests q
    WHERE q.id = v_ticket.affected_entity_id;
    
  ELSIF v_ticket.affected_entity_type = 'supplier_quotation' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.supplier_quotations sq
      JOIN public.suppliers s ON s.id = sq.supplier_id
      WHERE sq.id = v_ticket.affected_entity_id AND s.organization_id = v_ticket.organization_id
    ) THEN
      RAISE EXCEPTION 'Acesso negado (ownership inválida)';
    END IF;
    
    SELECT jsonb_build_object(
      'id', sq.id,
      'request_id', sq.request_id,
      'supplier_id', sq.supplier_id,
      'status', sq.status,
      'submitted_at', sq.submitted_at,
      'total_amount', sq.total_amount,
      'notes', sq.notes,
      'created_at', sq.created_at,
      'updated_at', sq.updated_at
    ) INTO v_result
    FROM public.supplier_quotations sq
    WHERE sq.id = v_ticket.affected_entity_id;
  ELSE
    RAISE EXCEPTION 'Tipo de entidade afetada não suportada';
  END IF;

  INSERT INTO public.audit_logs (
    action_type, user_id, organization_id, entity_type, entity_id, metadata
  ) VALUES (
    'SUPPORT_CONTEXT_ACCESS', auth.uid(), v_ticket.organization_id, v_ticket.affected_entity_type, v_ticket.affected_entity_id,
    jsonb_build_object('ticket_id', p_ticket_id, 'reason', 'support_ticket')
  );

  RETURN coalesce(v_result, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.support_get_reported_quotation_context(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.support_get_reported_quotation_context(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.support_get_reported_quotation_context(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.support_get_reported_quotation_context(uuid) TO service_role;
