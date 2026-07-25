import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Building2, UserCircle, Briefcase, CheckCircle2, ChevronRight, ChevronLeft, PackageSearch } from 'lucide-react';
import { formatCNPJ } from '@/shared/utils/formatters';

import { OrganizationService } from '@/modules/organizations/application/services/OrganizationService';
import { UserService } from '@/modules/auth/application/services/UserService';
import { MembershipService } from '@/modules/organizations/application/services/MembershipService';
import { ConnectionService } from '@/modules/suppliers/application/services/ConnectionService';
import { Logo } from '@/shared/components/ui/Logo';

export default function OnboardingWizardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [inviteId, setInviteId] = useState('');

  // Formulário: Empresa
  const [cnpj, setCnpj] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [site, setSite] = useState('');

  // Formulário: Perfil
  const [perfis, setPerfis] = useState<string[]>([]); // Comprador, Vendedor
  const [tipoEmpresa, setTipoEmpresa] = useState<string[]>([]);
  const [raio, setRaio] = useState('');
  // Passo 2: Segmento (Atuação Empresarial)
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [globalSegments, setGlobalSegments] = useState<any[]>([]);

  useEffect(() => {
    const fetchSegments = async () => {
      const { supabase } = await import('@/infrastructure/supabase/client');
      const { data, error } = await supabase.from('segments').select('*').is('organization_id', null).order('nome');
      if (data && !error) {
        setGlobalSegments(data);
      }
    };
    fetchSegments();
  }, []);

  // Formulário: Usuário
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPass, setUserPass] = useState('');
  const [userRole, setUserRole] = useState('Administrador');

  // Buscar dados do convite se houver token
  useEffect(() => {
    if (!token) return;
    const fetchInvite = async () => {
      const { supabase } = await import('@/infrastructure/supabase/client');
      // Chama a RPC 'validate_company_invite' que tem SECURITY DEFINER para bypassar o RLS
      const { data, error } = await supabase.rpc('validate_company_invite', { p_token: token });
      
      if (data && data.length > 0) {
        const inv = data[0];
        setCnpj(inv.document || '');
        setRazaoSocial(inv.company || inv.name || '');
        setCidade(inv.city || '');
        setEstado(inv.state || '');
        setUserEmail(inv.email || '');
        setInviteId(inv.id);
      }
    };
    fetchInvite();
  }, [token]);

  const toggleTipo = (t: string) => {
    setTipoEmpresa(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };
  
  const toggleSegment = (s: string) => {
    setSelectedSegments(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };



  const handleFinish = async () => {
    setIsLoading(true);
    try {
      const orgService = new OrganizationService();
      const userService = new UserService();
      const memService = new MembershipService();
      const conService = new ConnectionService();

      // Cálculo de Completude
      let completion = 50;
      if (site) completion += 10;
      if (tipoEmpresa.length > 0) completion += 10;
      const org = await orgService.createOrganization({
        name: razaoSocial || nomeFantasia,
        tradeName: nomeFantasia,
        taxId: cnpj,
        city: cidade,
        state: estado,
        profiles: perfis,
      });

      // Atualiza com os campos custom que o service base não mapeia nativamente
      const { supabase } = await import('@/infrastructure/supabase/client');
      await supabase.from('organizations').update({
        website: site,
        service_radius: raio || 'national'
      }).eq('id', org.id);

      // Salva os segmentos na nova tabela de relacionamento N:N
      // Como o orgService atualmente gera IDs mockados ('org_...'), protegemos a chamada ao Supabase
      if (selectedSegments.length > 0 && org.id.includes('-')) {
        const segmentsData = selectedSegments.map(segId => ({
          organization_id: org.id,
          segment_id: segId
        }));
        await supabase.from('company_segments').insert(segmentsData);
      }

      // 2. Cria o Usuário
      const user = await userService.createUser({
        name: userName,
        email: userEmail,
        passwordHash: userPass
      });

      // 3. Cria a Associação (Membership)
      await memService.addMembership(user.id, org.id, userRole, 'Sócio / Proprietário');

      // 4. Marca convite como concluído e cria a conexão
      if (inviteId) {
        await supabase.from('invitations').update({ status: 'concluido' }).eq('id', inviteId);
        
        // Pega quem convidou para conectar
        const { data: inv } = await supabase.from('invitations').select('organization_id').eq('id', inviteId).single();
        if (inv?.organization_id) {
          await conService.createConnection(inv.organization_id, org.id);
        }
      }

      setStep(4);
    } catch (e) {
      console.error(e);
      alert('Erro ao concluir cadastro.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-indigo-500 selection:text-white">
      <div className="w-full max-w-3xl">
        <div className="flex justify-center mb-8">
          <Logo />
        </div>

        <div className="bg-white shadow-xl shadow-slate-200/50 rounded-2xl overflow-hidden border border-slate-100">
          
          {/* Progress Bar */}
          <div className="bg-slate-900 px-6 py-4 flex justify-between items-center relative">
            <div className="absolute bottom-0 left-0 h-1 bg-indigo-500 transition-all duration-500" style={{ width: `${(step / 4) * 100}%` }} />
            
            <div className={`flex flex-col items-center ${step >= 1 ? 'text-indigo-400' : 'text-slate-500'}`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold mb-1 ${step >= 1 ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-500'}`}>1</div>
              <span className="text-[10px] uppercase font-bold tracking-wider">Empresa</span>
            </div>
            <div className={`h-0.5 flex-1 mx-4 ${step >= 2 ? 'bg-indigo-500/50' : 'bg-slate-800'}`} />
            
            <div className={`flex flex-col items-center ${step >= 2 ? 'text-indigo-400' : 'text-slate-500'}`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold mb-1 ${step >= 2 ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-500'}`}>2</div>
              <span className="text-[10px] uppercase font-bold tracking-wider">Perfil</span>
            </div>
            <div className={`h-0.5 flex-1 mx-4 ${step >= 3 ? 'bg-indigo-500/50' : 'bg-slate-800'}`} />

            <div className={`flex flex-col items-center ${step >= 3 ? 'text-indigo-400' : 'text-slate-500'}`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold mb-1 ${step >= 3 ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-500'}`}>3</div>
              <span className="text-[10px] uppercase font-bold tracking-wider">Conta</span>
            </div>
            <div className={`h-0.5 flex-1 mx-4 ${step >= 4 ? 'bg-indigo-500/50' : 'bg-slate-800'}`} />

            <div className={`flex flex-col items-center ${step >= 4 ? 'text-emerald-400' : 'text-slate-500'}`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold mb-1 ${step >= 4 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>4</div>
              <span className="text-[10px] uppercase font-bold tracking-wider">Sucesso</span>
            </div>
          </div>

          <div className="p-8">
            {/* ETAPA 1 */}
            {step === 1 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Confirme sua empresa</h2>
                    <p className="text-sm text-slate-500">Dados da organização na rede B2B.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">CNPJ</label>
                    <Input value={formatCNPJ(cnpj)} disabled className="bg-slate-50 text-slate-500 border-slate-200" placeholder="00.000.000/0001-00" />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-bold text-slate-700">Razão Social</label>
                    <Input value={razaoSocial} disabled className="bg-slate-50 text-slate-500 border-slate-200" />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-bold text-slate-700">Nome Fantasia *</label>
                    <Input value={nomeFantasia} onChange={e => setNomeFantasia(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Cidade</label>
                    <Input value={cidade} onChange={e => setCidade(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Estado (UF)</label>
                    <Input value={estado} onChange={e => setEstado(e.target.value)} maxLength={2} />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={() => setStep(2)} disabled={!nomeFantasia} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 shadow-md">
                    Próximo <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* ETAPA 2 */}
            {step === 2 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <Briefcase className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Sobre sua empresa</h2>
                    <p className="text-sm text-slate-500">Defina os papéis que você exercerá na rede.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-bold text-slate-700">Como sua empresa atua?</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {['Apenas Compradora', 'Apenas Vendedora', 'Compradora e Vendedora'].map(p => (
                      <button 
                        key={p} 
                        onClick={() => setPerfis([p])}
                        className={`p-3 text-sm font-semibold rounded-xl border text-left transition-all ${perfis.includes(p) ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 mt-6">
                  <label className="text-xs font-bold text-slate-700">Tipo de Empresa (Marque quantas quiser)</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {['Fabricante', 'Distribuidor', 'Revendedor', 'Importador', 'Prestador de Serviço', 'Exportador'].map(p => (
                      <button 
                        key={p} 
                        onClick={() => toggleTipo(p)}
                        className={`p-2.5 text-xs font-semibold rounded-xl border text-center transition-all ${tipoEmpresa.includes(p) ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 mt-6 border-t border-slate-100 pt-6">
                  <label className="text-xs font-bold text-slate-700">Segmento de Atuação (Marque quantos quiser)</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {globalSegments.map(seg => (
                      <button 
                        key={seg.id} 
                        onClick={() => toggleSegment(seg.id)}
                        className={`p-2.5 text-xs font-semibold rounded-xl border text-center transition-all ${selectedSegments.includes(seg.id) ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
                      >
                        {seg.nome}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 mt-6 border-t border-slate-100 pt-6">
                  <label className="text-xs font-bold text-slate-700">Raio de Operação</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {['100km', '250km', '500km', 'Nacional'].map(r => (
                      <button 
                        key={r} 
                        onClick={() => setRaio(r)}
                        className={`p-2.5 text-xs font-semibold rounded-xl border text-center transition-all ${raio === r ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
                      >
                        {r === 'Nacional' ? 'Território Nacional' : `Até ${r}`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 border-t border-slate-100 pt-6">
                  <div className="space-y-2 col-span-2 sm:col-span-1">
                    <label className="text-xs font-bold text-slate-700">Site (Opcional)</label>
                    <Input value={site} onChange={e => setSite(e.target.value)} placeholder="www.suaempresa.com.br" />
                  </div>
                </div>

                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={() => setStep(1)} className="font-bold">
                    <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
                  </Button>
                  <Button onClick={() => setStep(3)} disabled={perfis.length === 0} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 shadow-md">
                    Próximo <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* ETAPA 3 */}
            {step === 3 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <UserCircle className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Conta e Acesso</h2>
                    <p className="text-sm text-slate-500">Crie seu usuário administrador.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-bold text-slate-700">Nome Completo</label>
                    <Input value={userName} onChange={e => setUserName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">E-mail Corporativo</label>
                    <Input type="email" value={userEmail} onChange={e => setUserEmail(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Senha de Acesso</label>
                    <Input type="password" value={userPass} onChange={e => setUserPass(e.target.value)} />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-bold text-slate-700">Função</label>
                    <select value={userRole} onChange={e => setUserRole(e.target.value)} className="w-full h-10 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option>Administrador</option>
                      <option>Comercial</option>
                      <option>Engenharia</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={() => setStep(2)} className="font-bold">
                    <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
                  </Button>
                  <Button onClick={handleFinish} disabled={!userName || !userEmail || !userPass || isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 shadow-md">
                    {isLoading ? 'Finalizando...' : 'Concluir Cadastro'} <CheckCircle2 className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* ETAPA 4 - SUCESSO */}
            {step === 4 && (
              <div className="flex flex-col items-center justify-center text-center py-12 animate-in zoom-in-95 duration-500">
                <div className="h-20 w-20 rounded-full bg-emerald-100 flex items-center justify-center mb-6 ring-8 ring-emerald-50">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                </div>
                
                <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Seu cadastro foi concluído.</h1>
                <p className="text-slate-500 max-w-sm mb-8">
                  Sua empresa e conta de usuário já fazem parte da maior rede B2B da Hub.IA.
                </p>

                <div className="bg-indigo-50 p-6 rounded-2xl w-full max-w-sm mb-8">
                  <h3 className="text-sm font-bold text-indigo-900 mb-1">Agora vamos cadastrar seus produtos</h3>
                  <p className="text-xs text-indigo-700/80 mb-4">Mantenha seu catálogo atualizado para ser encontrado nas cotações.</p>
                  
                  <Button onClick={() => navigate('/products')} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12 shadow-lg shadow-indigo-900/20">
                    Começar Catálogo <PackageSearch className="h-5 w-5 ml-2" />
                  </Button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}


