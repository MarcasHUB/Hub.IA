-- Migration: operators_rls
-- Descrição: Adiciona políticas de INSERT e UPDATE na tabela operators para permitir auto-provisionamento

-- Permitir que usuários autenticados insiram seu próprio registro (auto-provisionamento)
CREATE POLICY "operators_insert_self" 
ON public.operators 
FOR INSERT 
TO authenticated 
WITH CHECK (id = auth.uid());

-- Permitir que operadores atualizem seu próprio registro ou que administradores atualizem operadores da sua organização
CREATE POLICY "operators_update_self_or_admin" 
ON public.operators 
FOR UPDATE 
TO authenticated 
USING (
  id = auth.uid() OR
  organization_id IN (
    SELECT organization_id FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
  )
);
