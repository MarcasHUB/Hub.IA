-- HOTFIX B1-R.5.7.1
-- Root cause: notify_on_chat_message() referenced NEW.organization_id which does not
-- exist on public.messages. The correct column is NEW.sender_organization_id.
-- This migration replaces the function without touching any schema, RLS, or other triggers.

CREATE OR REPLACE FUNCTION public.notify_on_chat_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id      uuid;
  v_convo       record;
  v_sender_name text;
  rec           record;
BEGIN
  -- Null-safety: skip system / legacy messages that carry no sender organisation.
  IF NEW.sender_organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Locate the conversation.
  SELECT * INTO v_convo FROM public.conversations WHERE id = NEW.conversation_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Determine the recipient organisation (the side that did NOT send the message).
  IF v_convo.organization_a_id = NEW.sender_organization_id THEN
    v_org_id := v_convo.organization_b_id;
  ELSIF v_convo.organization_b_id = NEW.sender_organization_id THEN
    v_org_id := v_convo.organization_a_id;
  ELSE
    -- sender_organization_id is not a participant of this conversation.
    RETURN NEW;
  END IF;

  -- Resolve sender display name using sender_organization_id.
  SELECT coalesce(nullif(trim(o.nome_fantasia), ''), 'Empresa parceira')
  INTO v_sender_name
  FROM public.organizations o
  WHERE o.id = NEW.sender_organization_id;

  -- Notify every active operator on the recipient side.
  FOR rec IN
    SELECT op.id
    FROM public.operators AS op
    JOIN public.profiles  AS p ON p.user_id = op.id
                               AND p.organization_id = op.organization_id
    WHERE op.organization_id = v_org_id
      AND op.status        = 'ativo'
      AND op.deleted_at    IS NULL
      AND EXISTS (
        SELECT 1 FROM public.user_roles AS ur
        WHERE ur.user_id        = op.id
          AND ur.organization_id = op.organization_id
      )
  LOOP
    PERFORM public.emit_notification(
      rec.id,
      v_org_id,
      'CHAT_MESSAGE_RECEIVED',
      'Nova mensagem',
      v_sender_name || ' enviou uma mensagem para voce.',
      'message',
      NEW.id,
      '/messages?conversation=' || NEW.conversation_id,
      jsonb_build_object(
        'conversation_id',        NEW.conversation_id,
        'message_id',             NEW.id,
        'sender_organization_id', NEW.sender_organization_id
      ),
      'normal',
      'message:' || NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Keep EXECUTE revoked from public/anon/authenticated (trigger-only function).
REVOKE ALL ON FUNCTION public.notify_on_chat_message() FROM PUBLIC, anon, authenticated;