const fs = require('fs');

const data = JSON.parse(fs.readFileSync('audit_results.json', 'utf8'));

const raizenIds = [
  'bb2edb49-8742-460f-8bff-96a84b4265b5',
  '206f40ea-1841-4f34-b373-3ced14e2bda3',
  '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1'
];

console.log('--- RAÍZEN COMPARAÇÃO ---');
raizenIds.forEach(id => {
  const org = data.organizations.find(o => o.id === id);
  const profiles = data.profiles.filter(p => p.organization_id === id);
  const operators = data.operators.filter(o => o.organization_id === id);
  const products = data.products.filter(p => p.organization_id === id);
  const org_materials = data.organization_materials.filter(m => m.organization_id === id);
  console.log(`ID: ${id}`);
  console.log(` - Existe na DB: ${!!org}`);
  console.log(` - Razão Social: ${org?.razao_social || org?.name || 'N/A'}`);
  console.log(` - Profiles: ${profiles.length} (${profiles.map(p => p.email).join(', ')})`);
  console.log(` - Operators: ${operators.length} (${operators.map(o => o.email).join(', ')})`);
  console.log(` - Products: ${products.length}`);
  console.log(` - Org_Materials: ${org_materials.length}`);
  console.log('');
});

console.log('--- SUPPLYHUB LTDA ---');
const supply = data.organizations.find(o => o.id === 'a0000000-0000-0000-0000-000000000001');
if (supply) {
  const supply_mats = data.organization_materials.filter(m => m.organization_id === supply.id);
  console.log(`SupplyHub Materials: ${supply_mats.length}`);
} else {
  console.log('SupplyHub Ltda (a0000000...) not found in DB!');
}

console.log('--- ALL ORGANIZATIONS ---');
data.organizations.forEach(o => {
  console.log(`${o.id} | ${o.name || o.razao_social} | ${o.cnpj}`);
});

console.log('--- ALL COMPANIES ---');
data.companies.forEach(o => {
  console.log(`${o.id} | ${o.name || o.razao_social} | ${o.cnpj}`);
});

