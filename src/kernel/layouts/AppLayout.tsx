import { useState, useEffect } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { cn } from '@/shared/utils/cn';
import { Globe, Settings, ShoppingCart, X, Trash2, MessageSquare } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { useQuotationCart } from '@/modules/quotations/presentation/context/QuotationCartContext';
import { NotificationBell } from '@/modules/notifications/presentation/components/NotificationBell';
import { useChatDrawer } from '@/modules/messages/presentation/context/ChatDrawerContext';
import { ChatDrawer } from '@/modules/messages/presentation/components/ChatDrawer';

// ─── Itens de navegação central ──────────────────────────────────────────────
const NAV_ITEMS = [
  { name: 'Dashboard',      href: '/dashboard' },
  { name: 'Meus Parceiros', href: '/suppliers' },
  { name: 'Produtos',       href: '/products' },
  { name: 'Cotações',       href: '/quotations' },
  { name: 'Minha Empresa',  href: '/empresa' },
];

// ─── CompanyLogo (logo da empresa ou iniciais) ────────────────────────────────
function CompanyLogo({ logo }: { logo: string | null }) {
  return (
    <div className="h-8 w-8 rounded-full border border-indigo-200 overflow-hidden bg-slate-900 flex items-center justify-center shrink-0 shadow-sm">
      {logo ? (
        <img src={logo} alt="Logo" className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
          <span className="text-[10px] font-black text-white leading-none">SH</span>
        </div>
      )}
    </div>
  );
}

// ─── AppLayout ────────────────────────────────────────────────────────────────
export function AppLayout() {
  const location = useLocation();
  const navigate  = useNavigate();
  const { items, isCartOpen, setCartOpen, removeItem, updateQuantity } = useQuotationCart();
  const { isChatOpen, openChat } = useChatDrawer();

  const [companyLogo, setCompanyLogo] = useState<string | null>(
    localStorage.getItem('supplyhub_company_logo')
  );
  const [companyName, setCompanyName] = useState<string>(
    localStorage.getItem('supplyhub_company_name') || 'SupplyHub B2B'
  );
  const [operatorEmail, setOperatorEmail] = useState<string>(() => {
    const saved = localStorage.getItem('supplyhub_logged_operator');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.email || 'viniciuscordebello@gmail.com';
    }
    return 'viniciuscordebello@gmail.com';
  });
  const [operatorName, setOperatorName] = useState<string>(() => {
    const saved = localStorage.getItem('supplyhub_logged_operator');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.nome || 'Cordebello';
    }
    return 'Cordebello';
  });

  useEffect(() => {
    // Forçar limpeza de org-1 legado do localStorage
    if (localStorage.getItem('supplyhub_organization_id') === 'org-1') {
      localStorage.setItem('supplyhub_organization_id', '00000000-0000-0000-0000-000000000000');
    }

    const handleUpdate = () => {
      setCompanyLogo(localStorage.getItem('supplyhub_company_logo'));
      setCompanyName(localStorage.getItem('supplyhub_company_name') || 'SupplyHub B2B');
      const saved = localStorage.getItem('supplyhub_logged_operator');
      if (saved) {
        const parsed = JSON.parse(saved);
        setOperatorEmail(parsed.email || 'viniciuscordebello@gmail.com');
        setOperatorName(parsed.nome || 'Cordebello');
      }
    };
    window.addEventListener('company_profile_updated', handleUpdate);
    return () => window.removeEventListener('company_profile_updated', handleUpdate);
  }, []);

  // Verificação periódica de Sessão Única
  useEffect(() => {
    const interval = setInterval(() => {
      const savedOperator = localStorage.getItem('supplyhub_logged_operator');
      if (!savedOperator) return;

      const sessionToken = localStorage.getItem('supplyhub_session_token');

      const rawSessions = localStorage.getItem('supplyhub_sessions_v2') || '[]';
      const sessions = JSON.parse(rawSessions);

      // Procurar nossa sessão
      const currentSession = sessions.find((s: any) => s.token_hash === sessionToken);
      
      if (currentSession && currentSession.status === 'encerrada') {
        // Desconectar o operador
        localStorage.removeItem('supplyhub_logged_operator');
        localStorage.removeItem('supplyhub_session_token');
        
        // Limpar cookies/sessão Supabase
        import('@/infrastructure/supabase/client').then(({ supabase }) => {
          supabase.auth.signOut();
        });

        navigate('/login?reason=session_terminated');
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [navigate]);

  const handleFinishQuotation = () => {
    setCartOpen(false);
    navigate('/quotations/new');
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-100 overflow-hidden">

      {/* ═══════════════════════════════════════════════════════════════════════
          NAVBAR ÚNICA NO TOPO
      ═══════════════════════════════════════════════════════════════════════ */}
      <header className="bg-white border-b border-slate-200 h-16 flex justify-center shrink-0 z-30 sticky top-0 shadow-sm">
        
        {/* Container centralizador para evitar que espalhe em telas largas */}
        <div className="w-full max-w-[1440px] px-6 flex items-center justify-between">
          
          {/* BLOCO DA ESQUERDA: Logo */}
          <Link to="/" className="flex items-center hover:opacity-80 transition-opacity shrink-0">
            <span className="text-[22px] font-extrabold text-indigo-700 tracking-tight leading-none">Hub.IA</span>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest leading-none ml-2 mt-1">
              Suprimentos
            </span>
          </Link>

          {/* BLOCO CENTRAL: Navegação e Rede */}
          <nav className="hidden lg:flex items-center justify-center flex-1 shrink-0 px-8">
            <div className="flex items-center gap-6">
              
              {/* Rede de Empresas Integrada como Item de Menu */}
              <Link
                to="/suppliers/network"
                className={cn(
                  'flex items-center gap-1 text-[12px] font-bold uppercase tracking-wide transition-colors',
                  location.pathname.startsWith('/suppliers/network')
                    ? 'text-indigo-700'
                    : 'text-slate-500 hover:text-slate-900'
                )}
              >
                <Globe className="h-[22px] w-[22px]" strokeWidth={2.5} />
                <span>REDE DE EMPRESAS</span>
              </Link>

              <div className="h-4 w-px bg-slate-300 shrink-0" />

              {NAV_ITEMS.map((item) => {
                const isActive =
                  location.pathname === item.href ||
                  (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      'text-sm transition-colors whitespace-nowrap',
                      isActive
                        ? 'font-bold text-indigo-700'
                        : 'font-medium text-slate-500 hover:text-slate-900'
                    )}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* BLOCO DA DIREITA: Empresa, Operador, Ações */}
          <div className="flex items-center gap-5 shrink-0">
            
            <div className="h-5 w-px bg-slate-200 shrink-0 hidden md:block" />

            {/* Card da Empresa Minimalista */}
            <Link to="/organizations" className="hidden md:flex items-center gap-2 hover:opacity-80 transition-opacity" title="Configurações da Empresa">
              <CompanyLogo logo={companyLogo} />
              <span className="text-sm font-bold text-slate-800">{companyName}</span>
            </Link>

            <div className="h-5 w-px bg-slate-200 shrink-0 hidden md:block" />

            {/* Operador Minimalista (Sem separador entre ele e a empresa) */}
            <div className="hidden md:flex items-center gap-3">
              <div className="flex flex-col text-right leading-tight">
                <span className="text-sm font-bold text-slate-800">{operatorName}</span>
                <span className="text-[10px] font-medium text-slate-400">{operatorEmail}</span>
              </div>
              <Link
                to="/settings"
                className="text-slate-400 hover:text-indigo-600 transition-colors"
                title="Configurações do Usuário"
              >
                <Settings className="h-4 w-4" />
              </Link>
            </div>

            <div className="h-5 w-px bg-slate-200 shrink-0" />

            {/* Ações (Chats, Carrinho, Notificações) */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => openChat('')}
                className={cn(
                  "flex items-center gap-1.5 text-sm font-medium transition-colors",
                  isChatOpen ? "text-indigo-700" : "text-slate-500 hover:text-indigo-600"
                )}
                title="Abrir Chat B2B"
              >
                <MessageSquare className="h-4 w-4" />
                <span>Chats</span>
              </button>

              <button
                onClick={() => setCartOpen(true)}
                className="relative text-slate-500 hover:text-indigo-600 transition-colors"
                title="Cotação Atual"
              >
                <ShoppingCart className="h-5 w-5" />
                {items.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center shadow-sm">
                    {items.length}
                  </span>
                )}
              </button>

              <div className="text-slate-500 hover:text-indigo-600 transition-colors">
                <NotificationBell />
              </div>
            </div>

            <div className="h-5 w-px bg-slate-200 shrink-0 mx-1" />

            {/* Botão Sair */}
            <button 
              onClick={() => {
                localStorage.clear();
                window.location.href = '/login';
              }}
              className="text-sm font-semibold text-red-500 hover:text-red-700 transition-colors"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════════
          CONTEÚDO DA PÁGINA
      ═══════════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-7xl mx-auto min-h-full">
          <Outlet />
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════════════════════
          DRAWER DO CARRINHO DE COTAÇÃO
      ═══════════════════════════════════════════════════════════════════════ */}
      {isCartOpen && (
        <>
          <div
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40"
            onClick={() => setCartOpen(false)}
          />
          <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right-full duration-300">
            <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-indigo-600" />
                Cotação Atual
              </h2>
              <button
                onClick={() => setCartOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-full"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {items.length === 0 ? (
                <div className="flex flex-col items-center text-center text-slate-400 mt-16 gap-5">
                  <div className="h-20 w-20 rounded-full bg-indigo-50 border-2 border-indigo-100 flex items-center justify-center">
                    <ShoppingCart className="h-9 w-9 text-indigo-300" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-700 text-sm">Sua cesta de cotação está vazia</p>
                    <p className="text-xs text-slate-400 mt-1">Adicione produtos para gerar uma cotação.</p>
                  </div>
                  <Button
                    onClick={() => { setCartOpen(false); navigate('/products'); }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold h-10 px-5 rounded-xl flex items-center gap-2 shadow-sm"
                  >
                    🛍 Deseja iniciar uma cotação?
                  </Button>
                  <p className="text-[10px] text-slate-300">Você será redirecionado ao catálogo de produtos</p>
                </div>
              ) : (
                items.map(item => (
                  <div
                    key={item.productId}
                    className="flex gap-4 border border-slate-200 p-4 rounded-lg bg-slate-50 relative"
                  >
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-900 text-sm leading-tight pr-6">
                        {item.name}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        {item.manufacturer} · {item.category}
                      </p>
                      <div className="flex items-center gap-3 mt-3">
                        <div className="flex items-center border border-slate-300 rounded-md bg-white">
                          <button
                            onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                            className="px-2 py-1 text-slate-500 hover:text-slate-900"
                          >-</button>
                          <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                            className="px-2 py-1 text-slate-500 hover:text-slate-900"
                          >+</button>
                        </div>
                        <span className="text-xs font-medium text-slate-500">{item.uom}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeItem(item.productId)}
                      className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {items.length > 0 && (
              <div className="p-6 border-t border-slate-200 bg-slate-50">
                <Button
                  onClick={handleFinishQuotation}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                >
                  Revisar Cotação ({items.length} itens)
                </Button>
              </div>
            )}
          </div>
        </>
      )}
      {/* Chat lateral retrátil */}
      <ChatDrawer />
    </div>
  );
}

// Mantido para compatibilidade de imports existentes
export function Sidebar() { return null; }