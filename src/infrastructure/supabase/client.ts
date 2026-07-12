import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY devem ser configurados no .env para o Supabase funcionar corretamente.');
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseKey || ''
);

// Flag para saber se estamos em modo mock (sem Supabase real configurado)
export const isMockMode = !supabaseUrl || supabaseUrl === '';