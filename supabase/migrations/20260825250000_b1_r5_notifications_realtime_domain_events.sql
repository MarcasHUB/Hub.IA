-- MIGRATION: b1_r5_notifications_realtime_domain_events
-- Rollback plan: drop triggers, drop emit_notification, remove columns from notifications, add check constraint back.

-- 1. HARDENING DE BACKUP TABLE
ALTER TABLE public.invitations_backup_before_cleanup_f2_2 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invitations_backup_before_cleanup_f2_2 FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.invitations_backup_before_cleanup_f2_2 TO service_role;

-- 2. AJUSTES EM public.notifications
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS action_url text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS dedupe_key text;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_key_idx ON public.notifications (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

-- 3. HARDENING RLS E GRANTS
DROP POLICY IF EXISTS "Users can insert their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;

CREATE POLICY "Users can update their own read_at" ON public.notifications
FOR UPDATE USING (user_id = auth.uid());

REVOKE ALL ON public.notifications FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE(read_at) ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

-- 4. REALTIME PUBLICATION
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END
$$;

-- 5. CANONICAL EMIT FUNCTION
CREATE OR REPLACE FUNCTION public.emit_notification(
  p_recipient_user_id uuid,
  p_organization_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_reference_type text,
  p_reference_id uuid,
  p_action_url text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_priority text DEFAULT 'normal',
  p_dedupe_key text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_recipient_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (
    user_id,
    organization_id,
    type,
    title,
    body,
    reference_type,
    reference_id,
    action_url,
    metadata,
    priority,
    dedupe_key
  ) VALUES (
    p_recipient_user_id,
    p_organization_id,
    p_type,
    p_title,
    p_body,
    p_reference_type,
    p_reference_id,
    p_action_url,
    p_metadata,
    p_priority,
    p_dedupe_key
  )
  ON CONFLICT (user_id, dedupe_key) 
  WHERE dedupe_key IS NOT NULL
  DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.emit_notification FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.emit_notification TO service_role;

-- 6. REFAZENDO TRIGGERS DE CONNECTION REQUEST (PARTNERSHIP)
CREATE OR REPLACE FUNCTION public.notify_on_connection_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_requester_name text;
  v_target_name text;
  rec record;
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(nullif(trim(o.nome_fantasia), ''), nullif(trim(o.razao_social), ''), nullif(trim(o.name), ''), 'Uma empresa')
  INTO v_requester_name
  FROM public.organizations AS o WHERE o.id = NEW.requester_company_id;

  IF NEW.requester_approval_status = 'pending' THEN
    SELECT coalesce(nullif(trim(o.nome_fantasia), ''), nullif(trim(o.razao_social), ''), nullif(trim(o.name), ''), 'uma empresa')
    INTO v_target_name
    FROM public.organizations AS o WHERE o.id = NEW.target_company_id;

    FOR rec IN 
      SELECT op.id FROM public.operators AS op
      JOIN public.profiles AS p ON p.user_id = op.id AND p.organization_id = op.organization_id
      WHERE op.organization_id = NEW.requester_company_id
        AND op.perfil = 'administrador' AND op.status = 'ativo' AND op.deleted_at IS NULL
        AND EXISTS (SELECT 1 FROM public.user_roles AS ur WHERE ur.user_id = op.id AND ur.organization_id = op.organization_id)
        AND NOT EXISTS (SELECT 1 FROM public.user_roles AS foreign_role WHERE foreign_role.user_id = op.id AND foreign_role.organization_id <> op.organization_id)
    LOOP
      PERFORM public.emit_notification(
        rec.id, NEW.requester_company_id, 'PARTNERSHIP_INTERNAL_APPROVAL_REQUIRED',
        'Aprovação interna necessária',
        'Uma solicitação de parceria com ' || coalesce(v_target_name, 'uma empresa') || ' aguarda sua aprovação.',
        'connection_request', NEW.id, '/suppliers/network', '{}'::jsonb, 'high',
        'connection_request:' || NEW.id || ':internal_approval'
      );
    END LOOP;
    RETURN NEW;
  END IF;

  IF NEW.requester_approval_status NOT IN ('approved', 'not_required') THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.organizations AS target WHERE target.id = NEW.target_company_id AND target.status IN ('ativo', 'active') AND NOT coalesce(target.is_platform_internal, false)) THEN
    RETURN NEW;
  END IF;

  FOR rec IN
    SELECT op.id FROM public.operators AS op
    JOIN public.profiles AS p ON p.user_id = op.id AND p.organization_id = op.organization_id
    WHERE op.organization_id = NEW.target_company_id
      AND op.perfil IN ('administrador', 'gestor') AND op.status = 'ativo' AND op.deleted_at IS NULL
      AND EXISTS (SELECT 1 FROM public.user_roles AS ur WHERE ur.user_id = op.id AND ur.organization_id = op.organization_id)
      AND NOT EXISTS (SELECT 1 FROM public.user_roles AS foreign_role WHERE foreign_role.user_id = op.id AND foreign_role.organization_id <> op.organization_id)
  LOOP
    PERFORM public.emit_notification(
      rec.id, NEW.target_company_id, 'PARTNERSHIP_INVITE_RECEIVED',
      'Nova solicitação de conexão',
      coalesce(v_requester_name, 'Uma empresa') || ' deseja se conectar com sua empresa.',
      'connection_request', NEW.id, '/suppliers/network', '{}'::jsonb, 'high',
      'connection_request:' || NEW.id || ':received'
    );
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_on_connection_request FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_on_connection_accepted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_target_company_name text;
  rec record;
BEGIN
  IF NEW.status = 'accepted' AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status <> 'accepted')) THEN
    SELECT coalesce(nullif(trim(o.nome_fantasia), ''), nullif(trim(o.razao_social), ''), nullif(trim(o.name), ''), 'Uma empresa')
    INTO v_target_company_name 
    FROM public.organizations o WHERE o.id = NEW.target_company_id;
    
    FOR rec IN
      SELECT op.id FROM public.operators AS op
      JOIN public.profiles AS p ON p.user_id = op.id AND p.organization_id = op.organization_id
      WHERE op.organization_id = NEW.requester_company_id
        AND op.status = 'ativo' AND op.deleted_at IS NULL AND op.perfil IN ('administrador', 'gestor')
        AND EXISTS (SELECT 1 FROM public.user_roles AS ur WHERE ur.user_id = op.id AND ur.organization_id = op.organization_id)
        AND NOT EXISTS (SELECT 1 FROM public.user_roles AS foreign_role WHERE foreign_role.user_id = op.id AND foreign_role.organization_id <> op.organization_id)
    LOOP
      PERFORM public.emit_notification(
        rec.id, NEW.requester_company_id, 'PARTNERSHIP_INVITE_ACCEPTED',
        'Conexão aceita',
        coalesce(v_target_company_name, 'Uma empresa') || ' aceitou sua solicitação de parceria!',
        'connection_request', NEW.id, '/suppliers/network', '{}'::jsonb, 'normal',
        'connection_request:' || NEW.id || ':accepted'
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_on_connection_accepted FROM PUBLIC, anon, authenticated;

-- 7. CHAT MESSAGE
CREATE OR REPLACE FUNCTION public.notify_on_chat_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id uuid;
  v_convo record;
  v_sender_name text;
  rec record;
BEGIN
  SELECT * INTO v_convo FROM public.conversations WHERE id = NEW.conversation_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF v_convo.organization_a_id = NEW.organization_id THEN
    v_org_id := v_convo.organization_b_id;
  ELSIF v_convo.organization_b_id = NEW.organization_id THEN
    v_org_id := v_convo.organization_a_id;
  ELSE
    RETURN NEW;
  END IF;

  SELECT coalesce(nullif(trim(o.nome_fantasia), ''), 'Empresa parceira')
  INTO v_sender_name FROM public.organizations o WHERE o.id = NEW.organization_id;

  FOR rec IN
    SELECT op.id FROM public.operators AS op
    JOIN public.profiles AS p ON p.user_id = op.id AND p.organization_id = op.organization_id
    WHERE op.organization_id = v_org_id
      AND op.status = 'ativo' AND op.deleted_at IS NULL
      AND EXISTS (SELECT 1 FROM public.user_roles AS ur WHERE ur.user_id = op.id AND ur.organization_id = op.organization_id)
  LOOP
    PERFORM public.emit_notification(
      rec.id, v_org_id, 'CHAT_MESSAGE_RECEIVED',
      'Nova mensagem',
      v_sender_name || ' enviou uma mensagem para você.',
      'message', NEW.id, '/messages?conversation=' || NEW.conversation_id, 
      jsonb_build_object('conversation_id', NEW.conversation_id, 'message_id', NEW.id, 'sender_organization_id', NEW.organization_id), 
      'normal',
      'message:' || NEW.id
    );
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_on_chat_message FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_chat_message_created ON public.messages;
CREATE TRIGGER on_chat_message_created
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_on_chat_message();

-- 8. QUOTATION RESPONSE E DECLINE
CREATE OR REPLACE FUNCTION public.notify_on_quotation_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_req record;
  v_supplier_name text;
BEGIN
  IF NEW.status = 'submitted' AND OLD.status = 'pending' THEN
    SELECT * INTO v_req FROM public.quotation_requests WHERE id = NEW.request_id;
    SELECT coalesce(nullif(trim(legal_name), ''), 'Um fornecedor') INTO v_supplier_name FROM public.suppliers WHERE id = NEW.supplier_id;

    IF FOUND AND v_req.created_by IS NOT NULL THEN
      PERFORM public.emit_notification(
        v_req.created_by, v_req.organization_id, 'QUOTATION_RESPONSE_RECEIVED',
        'Nova proposta recebida',
        v_supplier_name || ' respondeu à cotação: ' || coalesce(v_req.title, ''),
        'supplier_quotation', NEW.id, '/quotations/' || v_req.id || '/compare',
        jsonb_build_object('request_id', v_req.id, 'supplier_id', NEW.supplier_id), 'high',
        'supplier_quotation:' || NEW.id || ':submitted'
      );
    END IF;
  ELSIF NEW.status = 'declined' AND OLD.status = 'pending' THEN
    SELECT * INTO v_req FROM public.quotation_requests WHERE id = NEW.request_id;
    SELECT coalesce(nullif(trim(legal_name), ''), 'Um fornecedor') INTO v_supplier_name FROM public.suppliers WHERE id = NEW.supplier_id;
    
    IF FOUND AND v_req.created_by IS NOT NULL THEN
      PERFORM public.emit_notification(
        v_req.created_by, v_req.organization_id, 'QUOTATION_DECLINED',
        'Cotação recusada',
        v_supplier_name || ' declinou a cotação: ' || coalesce(v_req.title, ''),
        'supplier_quotation', NEW.id, '/quotations/' || v_req.id || '/compare',
        jsonb_build_object('request_id', v_req.id, 'supplier_id', NEW.supplier_id), 'normal',
        'supplier_quotation:' || NEW.id || ':declined'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_on_quotation_response FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_quotation_response_update ON public.supplier_quotations;
CREATE TRIGGER on_quotation_response_update
AFTER UPDATE ON public.supplier_quotations
FOR EACH ROW EXECUTE FUNCTION public.notify_on_quotation_response();

-- 9. SUPORTE HUB.IA (REPLY & STATUS)
CREATE OR REPLACE FUNCTION public.notify_on_support_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ticket record;
BEGIN
  IF NEW.sender_type = 'support' THEN
    SELECT * INTO v_ticket FROM public.support_tickets WHERE id = NEW.ticket_id;
    IF FOUND AND v_ticket.created_by IS NOT NULL THEN
      PERFORM public.emit_notification(
        v_ticket.created_by, v_ticket.organization_id, 'SUPPORT_REPLY_RECEIVED',
        'Nova resposta do suporte',
        'O suporte Hub.IA respondeu ao seu chamado: ' || coalesce(v_ticket.subject, ''),
        'support_ticket', v_ticket.id, '/empresa/suporte?ticket=' || v_ticket.id,
        jsonb_build_object('ticket_id', v_ticket.id, 'message_id', NEW.id), 'normal',
        'support_message:' || NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_on_support_reply FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_support_reply_created ON public.support_messages;
CREATE TRIGGER on_support_reply_created
AFTER INSERT ON public.support_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_on_support_reply();

CREATE OR REPLACE FUNCTION public.notify_on_support_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.created_by IS NOT NULL THEN
      PERFORM public.emit_notification(
        NEW.created_by, NEW.organization_id, 'SUPPORT_STATUS_CHANGED',
        'Status do chamado atualizado',
        'O chamado "' || coalesce(NEW.subject, '') || '" mudou para: ' || NEW.status,
        'support_ticket', NEW.id, '/empresa/suporte?ticket=' || NEW.id,
        jsonb_build_object('ticket_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status), 'normal',
        'support_ticket:' || NEW.id || ':status:' || NEW.status
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_on_support_status FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_support_status_update ON public.support_tickets;
CREATE TRIGGER on_support_status_update
AFTER UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.notify_on_support_status();
