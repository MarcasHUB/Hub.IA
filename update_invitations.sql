ALTER TABLE "public"."invitations" ADD COLUMN IF NOT EXISTS "token_hash" TEXT;
ALTER TABLE "public"."invitations" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "public"."invitations" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "public"."invitations" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "public"."invitations" ADD COLUMN IF NOT EXISTS "contact_name" TEXT;
ALTER TABLE "public"."invitations" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "public"."invitations" ADD COLUMN IF NOT EXISTS "message" TEXT;
