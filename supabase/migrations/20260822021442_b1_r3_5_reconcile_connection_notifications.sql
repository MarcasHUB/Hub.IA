-- B1-R.3.5N: reconcile connection-request notifications with the canonical
-- organizations/operators/user_roles identity model.
--
-- The source organization continues to be derived by request_connection()
-- through private.current_identity(). This trigger treats the destination
-- organization only as the target already persisted in connection_requests.

BEGIN;

CREATE OR REPLACE FUNCTION public.notify_on_connection_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_requester_name text;
  v_target_name text;
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(
    nullif(trim(o.nome_fantasia), ''),
    nullif(trim(o.razao_social), ''),
    nullif(trim(o.name), ''),
    'Uma empresa'
  )
  INTO v_requester_name
  FROM public.organizations AS o
  WHERE o.id = NEW.requester_company_id;

  IF NEW.requester_approval_status = 'pending' THEN
    SELECT coalesce(
      nullif(trim(o.nome_fantasia), ''),
      nullif(trim(o.razao_social), ''),
      nullif(trim(o.name), ''),
      'uma empresa'
    )
    INTO v_target_name
    FROM public.organizations AS o
    WHERE o.id = NEW.target_company_id;

    INSERT INTO public.notifications (
      user_id,
      title,
      body,
      type,
      reference_type,
      reference_id
    )
    SELECT
      op.id,
      'Aprovação interna necessária',
      'Uma solicitação de parceria com ' || coalesce(v_target_name, 'uma empresa') ||
        ' aguarda sua aprovação.',
      'connection_request',
      'connection_request',
      NEW.id
    FROM public.operators AS op
    JOIN public.profiles AS p
      ON p.user_id = op.id
     AND p.organization_id = op.organization_id
    WHERE op.organization_id = NEW.requester_company_id
      AND op.perfil = 'administrador'
      AND op.status = 'ativo'
      AND op.deleted_at IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.user_roles AS ur
        WHERE ur.user_id = op.id
          AND ur.organization_id = op.organization_id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_roles AS foreign_role
        WHERE foreign_role.user_id = op.id
          AND foreign_role.organization_id <> op.organization_id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.notifications AS existing_notification
        WHERE existing_notification.user_id = op.id
          AND existing_notification.type = 'connection_request'
          AND existing_notification.reference_id = NEW.id
      );

    RETURN NEW;
  END IF;

  IF NEW.requester_approval_status NOT IN ('approved', 'not_required') THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organizations AS target
    WHERE target.id = NEW.target_company_id
      AND target.status IN ('ativo', 'active')
      AND NOT coalesce(target.is_platform_internal, false)
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    user_id,
    title,
    body,
    type,
    reference_type,
    reference_id
  )
  SELECT
    op.id,
    'Nova solicitação de conexão',
    coalesce(v_requester_name, 'Uma empresa') || ' deseja se conectar com você.',
    'connection_request',
    'connection_request',
    NEW.id
  FROM public.operators AS op
  JOIN public.profiles AS p
    ON p.user_id = op.id
   AND p.organization_id = op.organization_id
  WHERE op.organization_id = NEW.target_company_id
    AND op.perfil IN ('administrador', 'gestor')
    AND op.status = 'ativo'
    AND op.deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.user_roles AS ur
      WHERE ur.user_id = op.id
        AND ur.organization_id = op.organization_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_roles AS foreign_role
      WHERE foreign_role.user_id = op.id
        AND foreign_role.organization_id <> op.organization_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.notifications AS existing_notification
      WHERE existing_notification.user_id = op.id
        AND existing_notification.type = 'connection_request'
        AND existing_notification.reference_id = NEW.id
    );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_on_connection_request()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS on_connection_request_created
  ON public.connection_requests;

CREATE TRIGGER on_connection_request_created
AFTER INSERT ON public.connection_requests
FOR EACH ROW
WHEN (NEW.status = 'pending')
EXECUTE FUNCTION public.notify_on_connection_request();

DROP TRIGGER IF EXISTS on_connection_request_exposed
  ON public.connection_requests;

CREATE TRIGGER on_connection_request_exposed
AFTER UPDATE OF status, requester_approval_status ON public.connection_requests
FOR EACH ROW
WHEN (
  NEW.status = 'pending'
  AND NEW.requester_approval_status IN ('approved', 'not_required')
  AND (
    OLD.status IS DISTINCT FROM NEW.status
    OR OLD.requester_approval_status IS DISTINCT FROM NEW.requester_approval_status
  )
)
EXECUTE FUNCTION public.notify_on_connection_request();

COMMIT;
