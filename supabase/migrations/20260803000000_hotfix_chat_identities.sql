-- 1. CHAT B2B CONVERSATIONS
-- Adicionando colunas corretas para organizations, mantendo as antigas para retrocompatibilidade
ALTER TABLE "public"."conversations"
ADD COLUMN IF NOT EXISTS "organization_a_id" "uuid" REFERENCES "public"."organizations"("id"),
ADD COLUMN IF NOT EXISTS "organization_b_id" "uuid" REFERENCES "public"."organizations"("id");

-- Índices
CREATE INDEX IF NOT EXISTS "idx_conversations_org_a" ON "public"."conversations"("organization_a_id");
CREATE INDEX IF NOT EXISTS "idx_conversations_org_b" ON "public"."conversations"("organization_b_id");

-- 2. CHAT B2B MESSAGES
ALTER TABLE "public"."messages"
ADD COLUMN IF NOT EXISTS "sender_organization_id" "uuid" REFERENCES "public"."organizations"("id");

CREATE INDEX IF NOT EXISTS "idx_messages_sender_org" ON "public"."messages"("sender_organization_id");
CREATE INDEX IF NOT EXISTS "idx_messages_conversation" ON "public"."messages"("conversation_id");

-- 3. RLS PARA CONVERSATIONS E MESSAGES
-- Removemos as antigas policies caso existam
DROP POLICY IF EXISTS "Usuários podem criar conversas para suas empresas" ON "public"."conversations";
DROP POLICY IF EXISTS "Usuários podem ver conversas de suas empresas" ON "public"."conversations";
DROP POLICY IF EXISTS "Usuários podem ver mensagens das suas conversas" ON "public"."messages";
DROP POLICY IF EXISTS "Usuários podem enviar mensagens para suas conversas" ON "public"."messages";

-- Novas Policies: Conversations
CREATE POLICY "conversations_org_select" ON "public"."conversations"
FOR SELECT TO "authenticated"
USING (
  "public"."has_org_access"("organization_a_id") OR 
  "public"."has_org_access"("organization_b_id")
);

CREATE POLICY "conversations_org_insert" ON "public"."conversations"
FOR INSERT TO "authenticated"
WITH CHECK (
  "public"."has_org_access"("organization_a_id") OR 
  "public"."has_org_access"("organization_b_id")
);

CREATE POLICY "conversations_org_update" ON "public"."conversations"
FOR UPDATE TO "authenticated"
USING (
  "public"."has_org_access"("organization_a_id") OR 
  "public"."has_org_access"("organization_b_id")
);

-- Novas Policies: Messages
CREATE POLICY "messages_org_select" ON "public"."messages"
FOR SELECT TO "authenticated"
USING (
  EXISTS (
    SELECT 1 FROM "public"."conversations" c
    WHERE c.id = "messages".conversation_id
    AND (
      "public"."has_org_access"(c.organization_a_id) OR 
      "public"."has_org_access"(c.organization_b_id)
    )
  )
);

CREATE POLICY "messages_org_insert" ON "public"."messages"
FOR INSERT TO "authenticated"
WITH CHECK (
  "public"."has_org_access"("sender_organization_id") AND
  EXISTS (
    SELECT 1 FROM "public"."conversations" c
    WHERE c.id = "messages".conversation_id
    AND (
      c.organization_a_id = "sender_organization_id" OR 
      c.organization_b_id = "sender_organization_id"
    )
  )
);

-- 4. CONVITES - RLS FIX
-- A policy atual de inserts restringe usando current_org_id(). Para não quebrar, vamos
-- garantir que 'invitations' permita insert se o organization_id for acessível.
DROP POLICY IF EXISTS "invitations_org_all" ON "public"."invitations";
CREATE POLICY "invitations_org_all" ON "public"."invitations"
FOR ALL TO "authenticated"
USING ("public"."has_org_access"("organization_id"))
WITH CHECK ("public"."has_org_access"("organization_id"));

-- 5. MEUS DADOS (PROFILES)
ALTER TABLE "public"."profiles"
ADD COLUMN IF NOT EXISTS "display_name" "text",
ADD COLUMN IF NOT EXISTS "avatar_url" "text";
