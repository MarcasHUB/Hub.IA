-- Migration for Phase 4C.3.6A.1
-- Fixes stack depth limit exceeded when updating profiles by making is_super_admin bypassing RLS

CREATE OR REPLACE FUNCTION public.is_super_admin()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 STABLE
 SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND is_super_admin = true
  );
$$;

-- Fix AppLayout rendering missing role issue
-- Usually this involves user_roles or operators.

-- Adding missing category_id to materials if needed.
-- Wait, I should check if category_id exists first before adding it.
