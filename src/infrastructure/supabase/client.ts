import { createClient } from '@supabase/supabase-js';

// Em desenvolvimento sem credenciais Supabase configuradas, usamos um placeholder
// válido para que o createClient não lance "supabaseUrl is required".
// Nenhuma requisição real será feita — os dados vêm dos mocks nos contextos.
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Flag para saber se estamos em modo mock (sem Supabase real configurado)
export const isMockMode =
  !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL === '';