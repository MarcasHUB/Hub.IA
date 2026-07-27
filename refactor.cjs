const fs = require('fs');
const path = 'e:\\SupplyHUB\\src\\modules\\organizations\\presentation\\pages\\MinhaEmpresaPage.tsx';
let content = fs.readFileSync(path, 'utf8').replace(/\r/g, '');

// 1. Remove Perfil Comercial tab from EMPRESA_SECTIONS
content = content.replace(
  `{ id: 'dados', label: 'Dados Gerais', icon: Building2, href: '/empresa' },\n      { id: 'comercial', label: 'Perfil Comercial', icon: Hash, href: '/empresa/comercial' },`,
  `{ id: 'dados', label: 'Dados da Empresa', icon: Building2, href: '/empresa' },`
);

// 2. Add activeSubTab and new form fields
content = content.replace(
  `  const [form, setForm] = useState({`,
  `  const [activeSubTab, setActiveSubTab] = useState<'gerais'|'comerciais'>('gerais');
  const [form, setForm] = useState({
    business_model: '',
    latitude: '',
    longitude: '',
    tipo_empresa: '',
    area_cobertura_raio: '',
    area_cobertura_estados: '',
    certificacoes: '',
    cnae_principal: '',
    cnaes_secundarios: [] as string[],`
);

// Add missing states
content = content.replace(
  `const [saveError, setSaveError] = useState('');`,
  `const [saveError, setSaveError] = useState('');
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [availableSegments, setAvailableSegments] = useState<{id: string, nome: string}[]>([]);
  const [sugestoesHubIA, setSugestoesHubIA] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSegment, setNewSegment] = useState({ nome: '', descricao: '' });`
);

// 3. Update loading logic in useEffect
const oldSetForm = `        setForm({
          razao_social: data.name || data.razao_social || '',
          nome_fantasia: data.trade_name || data.nome_fantasia || '',
          cnpj: applyMask('cnpj', data.document || data.cnpj || ''),
          email_corporativo: data.commercial_email || data.email_corporativo || '',
          telefone: applyMask('telefone', data.phone || data.telefone || ''),
          whatsapp: applyMask('whatsapp', data.whatsapp || ''),
          site: data.website || '',
          logo_url: data.logo_url || '',
          gestor_principal: localStorage.getItem('supplyhub_gestor_principal') || '',
          cep: applyMask('cep', data.address_zip_code || ''),
          endereco: data.address_street || '',
          numero: data.address_number || '',
          complemento: data.address_complement || '',
          bairro: data.address_neighborhood || '',
          cidade: data.address_city || data.city || '',
          uf: data.address_state || data.state || '',
        });`;

const newSetForm = `        setForm({
          razao_social: data.name || data.razao_social || '',
          nome_fantasia: data.trade_name || data.nome_fantasia || '',
          cnpj: applyMask('cnpj', data.document || data.cnpj || ''),
          email_corporativo: data.commercial_email || data.email_corporativo || '',
          telefone: applyMask('telefone', data.phone || data.telefone || ''),
          whatsapp: applyMask('whatsapp', data.whatsapp || ''),
          site: data.website || '',
          logo_url: data.logo_url || '',
          gestor_principal: localStorage.getItem('supplyhub_gestor_principal') || '',
          cep: applyMask('cep', data.address_zip_code || ''),
          endereco: data.address_street || '',
          numero: data.address_number || '',
          complemento: data.address_complement || '',
          bairro: data.address_neighborhood || '',
          cidade: data.address_city || data.city || '',
          uf: data.address_state || data.state || '',
          latitude: data.latitude?.toString() || '',
          longitude: data.longitude?.toString() || '',
          tipo_empresa: data.company_type || '',
          area_cobertura_raio: data.coverage_radius?.toString() || '',
          area_cobertura_estados: data.coverage_states?.join(', ') || '',
          certificacoes: data.certifications || '',
          cnae_principal: data.cnae_main || '',
          cnaes_secundarios: data.cnae_secondary || [],
          business_model: data.business_model || '',
        });
        if (data.segment) {
          if (Array.isArray(data.segment)) {
            setSelectedSegments(data.segment);
          } else if (typeof data.segment === 'string') {
            setSelectedSegments(data.segment.split(',').map((s: string) => s.trim()).filter(Boolean));
          }
        }
        const { data: segs } = await supabase.from('segments').select('id, nome').order('nome');
        if (segs) {
          setAvailableSegments(segs);
        }`;
content = content.replace(oldSetForm, newSetForm);

// 4. Update fetchCNPJ
const oldFetchCNPJ = `          setForm(f => ({
            ...f,
            razao_social: data.razao_social || f.razao_social,
            nome_fantasia: data.nome_fantasia || data.razao_social || f.nome_fantasia,
            telefone: data.ddd_telefone_1 || f.telefone,
            email_corporativo: data.email || f.email_corporativo,
            cep: data.cep || f.cep,
            endereco: data.logradouro || f.endereco,
            numero: data.numero || f.numero,
            complemento: data.complemento || f.complemento,
            bairro: data.bairro || f.bairro,
            cidade: data.municipio || f.cidade,
            uf: data.uf || f.uf,
          }));
          if (data.nome_fantasia || data.razao_social) {
             localStorage.setItem('supplyhub_company_name', data.nome_fantasia || data.razao_social);
             window.dispatchEvent(new Event('storage'));
          }`;

const newFetchCNPJ = `          const cnaePrincipal = data.cnae_fiscal ? \`\${data.cnae_fiscal} - \${data.cnae_fiscal_descricao}\` : '';
          const cnaesSecundarios = data.cnaes_secundarios ? data.cnaes_secundarios.map((c: any) => \`\${c.codigo} - \${c.descricao}\`) : [];
          
          setForm(f => ({
            ...f,
            razao_social: data.razao_social || f.razao_social,
            nome_fantasia: data.nome_fantasia || data.razao_social || f.nome_fantasia,
            telefone: data.ddd_telefone_1 || f.telefone,
            email_corporativo: data.email || f.email_corporativo,
            cep: data.cep || f.cep,
            endereco: data.logradouro || f.endereco,
            numero: data.numero || f.numero,
            complemento: data.complemento || f.complemento,
            bairro: data.bairro || f.bairro,
            cidade: data.municipio || f.cidade,
            uf: data.uf || f.uf,
            cnae_principal: cnaePrincipal,
            cnaes_secundarios: cnaesSecundarios
          }));
          if (data.nome_fantasia || data.razao_social) {
             localStorage.setItem('supplyhub_company_name', data.nome_fantasia || data.razao_social);
             window.dispatchEvent(new Event('storage'));
          }

          // Generate Hub.IA segment suggestions based on CNAE
          if (cnaePrincipal.toLowerCase().includes('elétric')) {
            setSugestoesHubIA(['Indústria Elétrica', 'Materiais Elétricos', 'Automação Industrial']);
          } else if (cnaePrincipal.toLowerCase().includes('tecnologia') || cnaePrincipal.toLowerCase().includes('software')) {
            setSugestoesHubIA(['Tecnologia da Informação', 'Software B2B', 'Serviços em Nuvem']);
          } else {
            setSugestoesHubIA(['Indústria Geral', 'Serviços Corporativos']);
          }

          // Geocoding request
          if (data.cep && data.logradouro) {
             const addressStr = \`\${data.logradouro}, \${data.numero || ''}, \${data.municipio} - \${data.uf}, \${data.cep}\`;
             const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
             if (apiKey) {
                try {
                  const geoRes = await fetch(\`https://maps.googleapis.com/maps/api/geocode/json?address=\${encodeURIComponent(addressStr)}&key=\${apiKey}\`);
                  const geoData = await geoRes.json();
                  if (geoData.results && geoData.results.length > 0) {
                     const { lat, lng } = geoData.results[0].geometry.location;
                     setForm(f => ({ ...f, latitude: lat.toString(), longitude: lng.toString() }));
                  }
                } catch(e) { console.error('Erro no geocoding:', e); }
             }
          }`;
content = content.replace(oldFetchCNPJ, newFetchCNPJ);

// 5. Update handleSave
const oldSave = `    const { error } = await supabase.from('organizations').update({
      name: form.razao_social,
      razao_social: form.razao_social,
      nome_fantasia: form.nome_fantasia,
      cnpj: form.cnpj,
      email_corporativo: form.email_corporativo,
      phone: form.telefone,
      telefone: form.telefone,
      whatsapp: form.whatsapp,
      website: form.site,
      logo_url: form.logo_url,
      address_zip_code: form.cep,
      address_street: form.endereco,
      address_number: form.numero,
      address_complement: form.complemento,
      address_neighborhood: form.bairro,
      city: form.cidade,
      state: form.uf,
      profile_completion: comp
    }).eq('id', orgId);`;

const newSave = `    const { error } = await supabase.from('organizations').update({
      name: form.razao_social,
      razao_social: form.razao_social,
      nome_fantasia: form.nome_fantasia,
      cnpj: form.cnpj,
      email_corporativo: form.email_corporativo,
      phone: form.telefone,
      telefone: form.telefone,
      whatsapp: form.whatsapp,
      website: form.site,
      logo_url: form.logo_url,
      address_zip_code: form.cep,
      address_street: form.endereco,
      address_number: form.numero,
      address_complement: form.complemento,
      address_neighborhood: form.bairro,
      city: form.cidade,
      state: form.uf,
      profile_completion: comp,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
      company_type: form.tipo_empresa,
      coverage_radius: form.area_cobertura_raio ? parseInt(form.area_cobertura_raio) : null,
      coverage_states: form.area_cobertura_estados ? form.area_cobertura_estados.split(',').map(s=>s.trim()) : null,
      certifications: form.certificacoes,
      cnae_main: form.cnae_principal,
      cnae_secondary: form.cnaes_secundarios,
      business_model: form.business_model,
      segment: selectedSegments.length > 0 ? selectedSegments : null,
    }).eq('id', orgId);`;
content = content.replace(oldSave, newSave);

// 6. Delete PerfilComercialTab completely (from "// ─── PerfilComercialTab" down to right before "MinhaEmpresaPage")
content = content.replace(/\/\/ ─── PerfilComercialTab ───[\s\S]*?\/\/ ─── MinhaEmpresaPage ───/, '// ─── MinhaEmpresaPage ───');

// 7. Update activeTab and JSX in MinhaEmpresaPage
content = content.replace(
  `if (location.pathname.includes('/comercial')) return 'comercial';`,
  ``
);
content = content.replace(
  `{activeTab === 'comercial' && <PerfilComercialTab />}`,
  ``
);

// 8. Introduce activeSubTab tabs in JSX
// Find where the Tabs UI should be injected. Right before the first Card in DadosEmpresaTab.
const targetJSX = `<Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardContent className="p-6 space-y-6">`;
const injectedJSX = `
      {/* Sub Tabs */}
      <div className="flex space-x-1 bg-slate-200/50 p-1 rounded-xl">
        <button
          onClick={() => setActiveSubTab('gerais')}
          className={\`flex-1 py-2 text-sm font-bold rounded-lg transition-all \${activeSubTab === 'gerais' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}\`}
        >
          Dados Gerais
        </button>
        <button
          onClick={() => setActiveSubTab('comerciais')}
          className={\`flex-1 py-2 text-sm font-bold rounded-lg transition-all \${activeSubTab === 'comerciais' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}\`}
        >
          Informações Comerciais
        </button>
      </div>

      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardContent className="p-6 space-y-6">
          {activeSubTab === 'gerais' && (
            <>
`;
content = content.replace(targetJSX, injectedJSX);

// Now we need to close the `gerais` fragment and add `comerciais` before the save button.
const targetSaveBtn = `<div className="flex justify-end pt-2 items-center">`;
const injectedSaveBtn = `
            </>
          )}

          {activeSubTab === 'comerciais' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> Tipo de Empresa
                  </label>
                  <Input value={form.tipo_empresa} onChange={e => handleChange('tipo_empresa', e.target.value)} placeholder="Matriz, Filial..." className="h-10 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> Perfil Comercial
                  </label>
                  <div className="relative">
                    <select
                      value={form.business_model}
                      onChange={e => handleChange('business_model', e.target.value)}
                      className="w-full h-10 px-3 pr-10 text-sm border border-slate-200 rounded-lg appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Selecione um perfil...</option>
                      <option value="Indústria / Fabricante">Indústria / Fabricante</option>
                      <option value="Distribuidor / Revenda">Distribuidor / Revenda</option>
                      <option value="Consumidor Final">Consumidor Final</option>
                      <option value="Prestador de Serviços">Prestador de Serviços</option>
                      <option value="Fabricante e Revenda">Fabricante e Revenda</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Área de Cobertura (Raio em km)" icon={Globe} value={form.area_cobertura_raio} onChange={v => handleChange('area_cobertura_raio', v)} type="number" placeholder="Ex: 100" />
                <Field label="Área de Cobertura (Estados)" icon={Globe} value={form.area_cobertura_estados} onChange={v => handleChange('area_cobertura_estados', v)} placeholder="Ex: SP, RJ, MG" />
              </div>

              <Field label="Certificações" icon={Shield} value={form.certificacoes} onChange={v => handleChange('certificacoes', v)} placeholder="Ex: ISO 9001, ISO 14001" />
              
              <hr className="border-slate-100" />
              
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-800">CNAEs e Inteligência de Segmentação</h3>
                <Field label="CNAE Principal" icon={Hash} value={form.cnae_principal} onChange={v => handleChange('cnae_principal', v)} placeholder="Preenchido via CNPJ" />
                
                {form.cnaes_secundarios.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">CNAEs Secundários</label>
                    <div className="flex flex-wrap gap-2">
                      {form.cnaes_secundarios.map((c, i) => (
                        <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded-md">{c}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3 mt-4">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Segmentos de Atuação
                </label>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-2">
                    {selectedSegments.map(seg => (
                      <span key={seg} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-100 flex items-center gap-1">
                        {seg}
                        <button onClick={() => setSelectedSegments(prev => prev.filter(s => s !== seg))} className="hover:text-indigo-900">&times;</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className="h-9 px-3 pr-8 text-sm border border-slate-200 rounded-lg appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[200px]"
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val && !selectedSegments.includes(val)) {
                          setSelectedSegments(prev => [...prev, val]);
                        }
                        e.target.value = '';
                      }}
                    >
                      <option value="">Adicionar segmento...</option>
                      {availableSegments.map(s => (
                        <option key={s.id} value={s.nome}>{s.nome}</option>
                      ))}
                    </select>
                    <button 
                      onClick={() => setIsModalOpen(true)}
                      className="px-3 h-9 border border-dashed border-slate-300 text-slate-500 text-xs font-bold rounded-lg hover:border-indigo-500 hover:text-slate-700 transition-colors"
                    >
                      + Novo
                    </button>
                  </div>
                </div>
              </div>

              {sugestoesHubIA.length > 0 && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-indigo-600" />
                    <span className="text-xs font-bold text-indigo-900 uppercase">Sugestões Hub.IA</span>
                  </div>
                  <p className="text-xs text-indigo-700 mb-3">Baseado no seu CNAE, sugerimos estes segmentos:</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {sugestoesHubIA.map(seg => (
                      <span key={seg} className="text-xs font-bold bg-white border border-indigo-200 text-indigo-800 px-2 py-1 rounded-md">
                        {seg}
                      </span>
                    ))}
                  </div>
                  <Button 
                    onClick={() => setSelectedSegments(prev => Array.from(new Set([...prev, ...sugestoesHubIA])))}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 px-4 text-xs font-bold"
                  >
                    Aceitar Sugestões
                  </Button>
                </div>
              )}

            </div>
          )}

          <div className="flex justify-end pt-2 items-center">`;
content = content.replace(targetSaveBtn, injectedSaveBtn);

// 9. Add modal JSX at the bottom of DadosEmpresaTab before its closing div
const targetEndDados = `      {/* Card de aviso Hub.IA */}`;
const injectedEndDados = `
      {/* Modal Novo Segmento */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">Novo Segmento</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-full">
                <XCircle className="h-4 w-4 text-slate-400" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Nome *</label>
                <Input
                  value={newSegment.nome}
                  onChange={e => setNewSegment({ ...newSegment, nome: e.target.value })}
                  placeholder="Ex: Agroindústria, Mineração, Logística..."
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Descrição</label>
                <textarea
                  value={newSegment.descricao}
                  onChange={e => setNewSegment({ ...newSegment, descricao: e.target.value })}
                  placeholder="Descreva o segmento de atuação."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end px-6 pb-6">
              <Button variant="outline" onClick={() => setIsModalOpen(false)} className="h-9 text-xs">Cancelar</Button>
              <Button
                onClick={async () => {
                  if (!newSegment.nome.trim()) return;
                  await supabase.from('segments').insert({
                    organization_id: 'GLOBAL',
                    nome: newSegment.nome.trim(),
                    descricao: newSegment.descricao.trim(),
                    status: 'ativo'
                  });
                  setSelectedSegments(prev => Array.from(new Set([...prev, newSegment.nome.trim()])));
                  setIsModalOpen(false);
                  setNewSegment({ nome: '', descricao: '' });
                }}
                disabled={!newSegment.nome.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 text-xs font-bold flex items-center gap-2"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Salvar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Card de aviso Hub.IA */}`;
content = content.replace(targetEndDados, injectedEndDados);

fs.writeFileSync(path, content, 'utf8');
console.log('Done!');
