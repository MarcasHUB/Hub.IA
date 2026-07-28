import fs from 'fs';
import path from 'path';

const pages = [
  'src/modules/employees/presentation/pages/OperatorsPage.tsx',
  'src/modules/employees/presentation/pages/DelegationsPage.tsx',
  'src/modules/employees/presentation/pages/AccessLogsPage.tsx'
];

for (const p of pages) {
  const fullPath = path.resolve(p);
  if (!fs.existsSync(fullPath)) continue;
  
  let content = fs.readFileSync(fullPath, 'utf8');

  // Replace default export signature
  content = content.replace(/export default function ([A-Za-z]+)\(\) \{/g, 'export default function $1({ organizationId }: { organizationId?: string }) {');
  
  // Replace localStorage org ID inside the component main body
  content = content.replace(/const orgId = localStorage.getItem\('supplyhub_organization_id'\) \|\| '00000000-0000-0000-0000-000000000000';/g, "const orgId = organizationId || localStorage.getItem('supplyhub_organization_id') || '00000000-0000-0000-0000-000000000000';");

  // Specifically for InviteModal in OperatorsPage (which I already accidentally modified via the AI tool but let's just make sure it's correct)
  content = content.replace(/function InviteModal\(\{[^}]+\} ?: ?\{[^}]+\}\) \{[\s\S]*?(?=const orgId =)/g, (match) => {
      if (!match.includes('organizationId')) {
          return match.replace(/\} ?: ?\{/, ', organizationId }: { organizationId?: string, ');
      }
      return match;
  });

  fs.writeFileSync(fullPath, content);
}
console.log('Fixed pages.');
