const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
  const [k, ...v] = line.split('=');
  if(k) acc[k.trim()] = v.join('=').trim().replace(/"/g, '').replace(/\r/g, '');
  return acc;
}, {});
const url = env.VITE_SUPABASE_URL + '/rest/v1/';
const key = env.VITE_SUPABASE_ANON_KEY;
fetch(url, { headers: { 'apikey': key } })
  .then(res => res.json())
  .then(data => {
    const defs = data.definitions;
    if(!defs) return console.log('No definitions found');
    ['organizations', 'suppliers', 'companies', 'user_roles', 'profiles', 'products'].forEach(t => {
       if(defs[t]) {
          console.log('\n--- TABLE: ' + t + ' ---');
          const props = defs[t].properties;
          for(const p in props) {
             console.log(p + ' (' + props[p].type + (props[p].format ? ':' + props[p].format : '') + ')');
          }
       }
    });
  }).catch(console.error);
