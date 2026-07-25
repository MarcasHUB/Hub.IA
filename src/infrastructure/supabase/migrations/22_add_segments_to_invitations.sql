ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS segments TEXT[] DEFAULT '{}';
NOTIFY pgrst, 'reload schema';
