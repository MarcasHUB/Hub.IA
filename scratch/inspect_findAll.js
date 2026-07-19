import { SupabaseProductRepository } from '../src/modules/products/infrastructure/repositories/SupabaseProductRepository.js';
import fs from 'fs';
import path from 'path';

// Set up env variables so client.ts works
const envPath = path.resolve('.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
  if (match) {
    process.env[match[1].trim()] = match[2].trim();
    // Also set import.meta.env mock if needed, but in node we use process.env or dotenv
  }
});

// Since client.ts uses import.meta.env, let's check if it compiles or runs in node.
// Wait, client.ts imports from import.meta.env which is only available in Vite/ESM.
// In Node ESM, import.meta.env is undefined.
// Let's mock import.meta.env using a global variable or custom loader, or we can just mock it in globalThis!
globalThis.import = {
  meta: {
    env: {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
      VITE_USE_MOCK_DATA: process.env.VITE_USE_MOCK_DATA
    }
  }
};

async function run() {
  const repo = new SupabaseProductRepository();
  try {
    const products = await repo.findAll('00000000-0000-0000-0000-000000000000');
    console.log('Result of repo.findAll:', products);
  } catch (err) {
    console.error('Error calling repo.findAll:', err);
  }
}

run();
