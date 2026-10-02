-- Solicitantes podem responder diretamente a um Gestor ou Administrador ativo da mesma empresa.
do $$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid)
    into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'create_operator_invitation_transactional'
  limit 1;

  if v_def is null then
    raise exception 'create_operator_invitation_transactional not found';
  end if;

  v_def := replace(
    v_def,
    'IF p_perfil = ''solicitante'' AND v_gestor.perfil <> ''gestor'' THEN',
    'IF p_perfil = ''solicitante'' AND v_gestor.perfil NOT IN (''administrador'', ''gestor'') THEN'
  );
  execute v_def;

  select pg_get_functiondef(p.oid)
    into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'update_pending_operator_invitation'
  limit 1;

  if v_def is null then
    raise exception 'update_pending_operator_invitation not found';
  end if;

  v_def := replace(
    v_def,
    'IF p_perfil = ''solicitante''
       AND v_manager.perfil <> ''gestor'' THEN',
    'IF p_perfil = ''solicitante''
       AND v_manager.perfil NOT IN (''administrador'', ''gestor'') THEN'
  );
  execute v_def;
end
$$;
