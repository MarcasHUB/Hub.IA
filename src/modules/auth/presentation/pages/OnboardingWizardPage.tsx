import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Building2, UserCircle, Briefcase, CheckCircle2, ChevronRight, ChevronLeft, PackageSearch } from 'lucide-react';
import { OrganizationService } from '@/modules/organizations/application/services/OrganizationService';
import { UserService } from '@/modules/auth/application/services/UserService';
import { MembershipService } from '@/modules/organizations/application/services/MembershipService';
import { InvitationService } from '@/modules/suppliers/application/services/InvitationService';
import { ConnectionService } from '@/modules/suppliers/application/services/ConnectionService';
import { Logo } from '@/shared/components/ui/Logo';

export default function OnboardingWizardPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Formulário: Empresa
  const [cnpj, setCnpj] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');

  // Formulário: Perfil
  const [perfis, setPerfis] = useState<string[]>([]);
  const [segmento, setSegmento] = useState('');

  // Formulário: Usuário
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPass, setUserPass] = useState('');
  const [userRole, setUserRole] = useState('Administrador');

  const handleCnpjBlur = async () => {
    const cleanCnpj = cnpj.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) return;
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      if (res.ok) {
        const data = await res.json();
        setRazaoSocial(data.razao_social || '');
        setNomeFantasia(data.nome_fantasia || '');
        setCidade(data.municipio || '');
        setEstado(data.uf || '');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const togglePerfil = (p: string) => {
    setPerfis(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const handleFinish = async () => {
    setIsLoading(true);
    try {
      // Usa os Services reais da camada de aplicação
      const orgService = new OrganizationService();
      const userService = new UserService();
      const memService = new MembershipService();
      
      const conService = new ConnectionService();

      // 1. Cria a Organização
      const org = await orgService.createOrganization({
        name: razaoSocial || nomeFantasia,
        tradeName: nomeFantasia,
        taxId: cnpj,
        city: cidade,
        state: estado,
        profiles: perfis,
        segments: [segmento]
      });

      // 2. Cria o Usuário
      const user = await userService.createUser({
        name: userName,
        email: userEmail,
        passwordHash: userPass
      });

      // 3. Cria a Associação (Membership)
      await memService.addMembership(user.id, org.id, userRole, 'Sócio / Proprietário');

      // (Na prática, pegaria o Token da URL e atualizaria o convite)
      // invService.completeInvitation('inv_ID');
      
      // 4. Cria a conexão com quem convidou (buyerId fictício)
      await conService.createConnection('buyer_123', org.id);

      setStep(4);
    } catch (e) {
      console.error(e);
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
                    <Input value={cnpj} onChange={e => setCnpj(e.target.value)} onBlur={handleCnpjBlur} placeholder="00.000.000/0001-00" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Nome Fantasia</label>
                    <Input value={nomeFantasia} onChange={e => setNomeFantasia(e.target.value)} />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-bold text-slate-700">Razão Social</label>
                    <Input value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)} />
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
                  <Button onClick={() => setStep(2)} disabled={!cnpj || !razaoSocial} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 shadow-md">
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
                  <label className="text-xs font-bold text-slate-700">Selecione seus papéis de atuação</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {['Fabricante', 'Distribuidor', 'Revendedor', 'Importador', 'Prestador de Serviço', 'Comprador'].map(p => (
                      <button 
                        key={p} 
                        onClick={() => togglePerfil(p)}
                        className={`p-3 text-sm font-semibold rounded-xl border text-left transition-all ${perfis.includes(p) ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 mt-4">
                  <label className="text-xs font-bold text-slate-700">Segmento Principal</label>
                  <Input value={segmento} onChange={e => setSegmento(e.target.value)} placeholder="Ex: Metalurgia, Tecnologia, etc" />
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
