-- B1-R.5.7.2 migration contract test. Read-only and safe to run in production.

do $$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.notify_on_chat_message()'::regprocedure)
  into v_definition;

  if position('/dashboard?chatConversation=' in v_definition) = 0 then
    raise exception 'CHAT_CANONICAL_DEEP_LINK_MISSING';
  end if;

  if position('/messages?conversation=' in v_definition) > 0 then
    raise exception 'LEGACY_DUPLICATE_CHAT_DEEP_LINK_PRESENT';
  end if;

  if position('conversation_id' in v_definition) = 0
     or position('message_id' in v_definition) = 0
     or position('sender_organization_id' in v_definition) = 0 then
    raise exception 'CHAT_NOTIFICATION_METADATA_CONTRACT_INCOMPLETE';
  end if;
end;
$$;
