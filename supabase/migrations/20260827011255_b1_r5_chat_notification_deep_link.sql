-- HOTFIX B1-R.5.7.2
-- ChatDrawer is the canonical conversation UI. The action URL remains available
-- for browser reloads and external links, but now targets the canonical transient
-- deep-link parameter instead of the deprecated central /messages experience.

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
  IF NEW.sender_organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_convo
  FROM public.conversations
  WHERE id = NEW.conversation_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF v_convo.organization_a_id = NEW.sender_organization_id THEN
    v_org_id := v_convo.organization_b_id;
  ELSIF v_convo.organization_b_id = NEW.sender_organization_id THEN
    v_org_id := v_convo.organization_a_id;
  ELSE
    RETURN NEW;
  END IF;

  SELECT coalesce(nullif(trim(o.nome_fantasia), ''), 'Empresa parceira')
  INTO v_sender_name
  FROM public.organizations o
  WHERE o.id = NEW.sender_organization_id;

  FOR rec IN
    SELECT op.id
    FROM public.operators AS op
    JOIN public.profiles AS p
      ON p.user_id = op.id
     AND p.organization_id = op.organization_id
    WHERE op.organization_id = v_org_id
      AND op.status = 'ativo'
      AND op.deleted_at IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.user_roles AS ur
        WHERE ur.user_id = op.id
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
      '/dashboard?chatConversation=' || NEW.conversation_id,
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

REVOKE ALL ON FUNCTION public.notify_on_chat_message() FROM PUBLIC, anon, authenticated;
