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

  const handleFinishQuotation = () => {
    setCartOpen(false);
    navigate('/quotations/new');
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-100 overflow-hidden">

      {/* ═══════════════════════════════════════════════════════════════════════
          NAVBAR ÚNICA NO TOPO
      ═══════════════════════════════════════════════════════════════════════ */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 z-30 shadow-sm">
        {/* Esquerda: Logo e Rede */}
        <div className="flex items-center gap-4 shrink-0">
          {/* Logo Hub.IA */}
          <Link to="/dashboard" className="flex items-baseline gap-1.5 shrink-0">
            <span className="text-xl font-extrabold text-indigo-700 leading-none">Hub.IA</span>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none hidden md:block">
              Suprimentos
            </span>
          </Link>
          <div className="h-5 w-px bg-slate-200 shrink-0" />
          {/* Botão REDE DE EMPRESAS */}
          <Link
            to="/suppliers/network"
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border transition-colors shrink-0',
              location.pathname.startsWith('/suppliers/network')
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'border-slate-300 text-slate-600 hover:border-indigo-400 hover:text-indigo-700 hover:bg-indigo-50'
            )}
          >
            <Globe className="h-3 w-3" />
            <span className="leading-tight text-center">REDE<br />EMPRESAS</span>
          </Link>
        </div>

        {/* Centro: Navegação */}
        <nav className="hidden lg:flex items-center justify-center flex-1 shrink-0 px-4">
          <div className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive =
                location.pathname === item.href ||
                (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm transition-colors whitespace-nowrap',
                    isActive
                      ? 'font-bold text-slate-900'
                      : 'font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  )}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Direita: Empresa, Operador, Ações */}
        <div className="flex items-center gap-4 shrink-0">
          
          {/* Bloco Empresa */}
          <div className="flex items-center gap-2">
            <CompanyLogo logo={companyLogo} />
            <span className="text-xs font-bold text-slate-900 hidden md:block">{companyName}</span>
          </div>

          <div className="h-5 w-px bg-slate-200 shrink-0 hidden md:block" />

          {/* Bloco Operador e Configurações */}
          <div className="hidden md:flex items-center gap-2">
            <div className="flex flex-col text-right leading-none">
              <span className="text-xs font-bold text-slate-900 text-right">{operatorName}</span>
              <span className="text-[9px] text-slate-400 mt-0.5 font-medium">{operatorEmail}</span>
            </div>
            <Link
              to="/organizations"
              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
              title="Configurações da Empresa e Operadores"
            >
              <Settings className="h-4 w-4" />
            </Link>
          </div>

          <div className="h-5 w-px bg-slate-200 shrink-0" />

          {/* Ações (Chats, Carrinho, Notificações) */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => openChat('')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors font-semibold text-xs shrink-0 ${
                isChatOpen
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
              }`}
              title="Abrir Chat B2B"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Chats</span>
            </button>

            <button
              onClick={() => setCartOpen(true)}
              className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
              title="Cotação Atual"
            >
              <ShoppingCart className="h-[18px] w-[18px]" />
              {items.length > 0 && (
                <span className="absolute top-0 right-0 h-3.5 w-3.5 rounded-full bg-indigo-600 text-white text-[8px] font-bold flex items-center justify-center">
                  {items.length}
                </span>
              )}
            </button>

            <NotificationBell />
          </div>

          <div className="h-5 w-px bg-slate-200 shrink-0" />

          {/* Botão Sair */}
          <button 
            onClick={() => {
              localStorage.clear();
              window.location.href = '/login';
            }}
            className="text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 px-3 py-1.5 rounded-md transition-colors"
          >
            Sair
          </button>
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