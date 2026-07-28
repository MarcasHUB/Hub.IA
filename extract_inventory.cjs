const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const modulesDir = path.join(srcDir, 'modules');
const organizationsDir = path.join(modulesDir, 'organizations');
const suppliersDir = path.join(modulesDir, 'suppliers');
const routerDir = path.join(srcDir, 'kernel', 'router');
const migrationsDir = path.join(srcDir, 'infrastructure', 'supabase', 'migrations');

const report = {
  routes: [],
  components: [],
  hooks: [],
  services: [],
  db: {
    tables: {},
    rls: []
  },
  dependencies: []
};

// 1. Structure
function walkSync(dir, filelist = []) {
  if (!fs.existsSync(dir)) return filelist;
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    if (fs.statSync(dirFile).isDirectory()) {
      filelist = walkSync(dirFile, filelist);
    } else {
      filelist.push(dirFile);
    }
  });
  return filelist;
}

const orgFiles = walkSync(organizationsDir);
const supFiles = walkSync(suppliersDir);
const routeFiles = walkSync(routerDir);
const migFiles = walkSync(migrationsDir);

const allFiles = [...orgFiles, ...supFiles, ...routeFiles];

// 2. Extract Routes from router/index.tsx
const routerContent = fs.readFileSync(path.join(routerDir, 'index.tsx'), 'utf-8');
const routeRegex = /path:\s*'([^']+)',\s*element:\s*<SuspenseWrapper><([A-Za-z]+)\s*\/>/g;
let match;
while ((match = routeRegex.exec(routerContent)) !== null) {
  report.routes.push({ path: match[1], component: match[2] });
}

// 3. Extract Components, Hooks, Services
allFiles.forEach(file => {
  if (!file.endsWith('.ts') && !file.endsWith('.tsx')) return;
  const content = fs.readFileSync(file, 'utf-8');
  const filename = path.basename(file);
  
  // Components
  if (filename.endsWith('.tsx')) {
    const compRegex = /export (?:default )?function ([A-Za-z]+)\(([^)]*)\)/g;
    let cm;
    while ((cm = compRegex.exec(content)) !== null) {
      report.components.push({
        name: cm[1],
        file: file.replace(__dirname, ''),
        props: cm[2]
      });
    }
  }

  // Hooks (useX)
  const hookRegex = /function (use[A-Za-z]+)\(/g;
  let hm;
  while ((hm = hookRegex.exec(content)) !== null) {
    report.hooks.push({ name: hm[1], file: file.replace(__dirname, '') });
  }

  // Services/Repositories
  const classRegex = /class ([A-Za-z]+(?:Service|Repository))/g;
  let srv;
  while ((srv = classRegex.exec(content)) !== null) {
    report.services.push({ name: srv[1], file: file.replace(__dirname, '') });
  }
});

// 4. Extract DB Schema from Migrations
migFiles.sort().forEach(file => {
  const content = fs.readFileSync(file, 'utf-8');
  
  // Very basic table extraction
  const tableRegex = /CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?([a-z_]+)\s*\(([\s\S]*?)\);/gi;
  let tm;
  while ((tm = tableRegex.exec(content)) !== null) {
    const tableName = tm[1].toLowerCase();
    if (tableName === 'organizations' || tableName.startsWith('empresa_') || tableName === 'organization_segments') {
       report.db.tables[tableName] = tm[2].split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('--'));
    }
  }

  // Basic RLS extraction
  const policyRegex = /CREATE POLICY "([^"]+)" ON (?:public\.)?([a-z_]+)([\s\S]*?)USING \(([\s\S]*?)\)/gi;
  let pm;
  while ((pm = policyRegex.exec(content)) !== null) {
    const tableName = pm[2].toLowerCase();
    if (tableName === 'organizations' || tableName.startsWith('empresa_') || tableName === 'organization_segments') {
      report.db.rls.push({
        policy: pm[1],
        table: tableName,
        type: pm[3].trim(),
        using: pm[4].trim().split(';')[0]
      });
    }
  }
});

fs.writeFileSync('inventory_raw.json', JSON.stringify(report, null, 2));
console.log('Inventory raw data extracted to inventory_raw.json');
