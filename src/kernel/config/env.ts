export const env = {
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    useMockData: import.meta.env.VITE_USE_MOCK_DATA === 'true'
};