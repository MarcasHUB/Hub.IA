const fs = require('fs');
const path = require('path');
const walk = dir => {
  fs.readdirSync(dir).forEach(f => {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.tsx')) {
      const c = fs.readFileSync(p, 'utf8');
      const nc = c.replace(/\\`/g, '`').replace(/\\\$/g, '$');
      if (c !== nc) {
        fs.writeFileSync(p, nc);
        console.log('Fixed', p);
      }
    }
  });
};
walk('./src');
