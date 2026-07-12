import { createClient } from '@supabase/supabase-js';

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Sanitize URL to remove /rest/v1 if the user accidentally included it in their .env
const supabaseUrl = rawSupabaseUrl ? rawSupabaseUrl.replace(/\/rest\/v1\/?$/, '') : undefined;

if (!supabaseUrl || !supabaseKey) {
  console.warn('VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY devem ser configurados no .env para o Supabase funcionar corretamente.');
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseKey || ''
);

// Flag para saber se estamos em modo mock (sem Supabase real configurado)
export const isMockMode = !supabaseUrl || supabaseUrl === '';