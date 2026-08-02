import * as fs from 'fs';
import * as path from 'path';

function replaceInFile(filePath: string) {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) return;
    
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Fix user_roles single() -> maybeSingle()
    content = content.replace(/from\('user_roles'\)\.select\('organization_id'\)\.eq\('user_id', user\.id\)\.single\(\)/g, "from('user_roles').select('organization_id').eq('user_id', user.id).maybeSingle()");
    
    // Fix organizations select('trade_name, name, logo_url') -> select('*')
    content = content.replace(/\.from\('organizations'\)\s*\.select\('trade_name, name, logo_url'\)/g, ".from('organizations').select('*')");
    content = content.replace(/\.from\('organizations'\)\s*\.select\('company_role'\)/g, ".from('organizations').select('company_role, perfil_comercial, business_model, tipo_empresa')");
    
    fs.writeFileSync(fullPath, content);
}

const files = [
    'src/modules/categories/infrastructure/repositories/SupabaseCategoryRepository.ts',
    'src/modules/products/infrastructure/repositories/SupabaseProductRepository.ts',
    'src/modules/products/infrastructure/repositories/SupabaseProductSupplierRepository.ts',
    'src/modules/suppliers/infrastructure/repositories/SupabaseOrganizationConnectionRepository.ts',
    'src/modules/suppliers/infrastructure/repositories/SupabaseSupplierRepository.ts',
    'src/kernel/layouts/AppLayout.tsx',
    'src/modules/products/presentation/pages/ProductsListPage.tsx'
];

for (const file of files) {
    replaceInFile(file);
}
console.log('Fixes applied.');
