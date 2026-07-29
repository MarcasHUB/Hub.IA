ALTER TABLE public.operators DROP CONSTRAINT IF EXISTS operators_perfil_check;
ALTER TABLE public.operators ADD CONSTRAINT operators_perfil_check CHECK (perfil::text = ANY (ARRAY['administrador'::character varying, 'gestor'::character varying, 'comprador'::character varying, 'consulta'::character varying, 'solicitante'::character varying, 'auditor'::character varying]::text[]));

ALTER TABLE public.operator_invitations DROP CONSTRAINT IF EXISTS operator_invitations_perfil_check;
ALTER TABLE public.operator_invitations ADD CONSTRAINT operator_invitations_perfil_check CHECK (perfil::text = ANY (ARRAY['administrador'::character varying, 'gestor'::character varying, 'comprador'::character varying, 'consulta'::character varying, 'solicitante'::character varying, 'auditor'::character varying]::text[]));
