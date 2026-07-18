import { useNavigate } from 'react-router-dom';
import { Smartphone, Monitor, ChevronRight } from 'lucide-react';

export default function AppAccessChoicePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 font-sans text-slate-100">
      <div className="max-w-md w-full bg-slate-800 rounded-3xl p-8 shadow-2xl border border-slate-700 text-center animate-in fade-in zoom-in duration-300">
        <div className="mx-auto w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-6 border border-indigo-500/30">
          <Smartphone className="h-8 w-8 text-indigo-400" />
        </div>
        
        <h1 className="text-2xl font-extrabold text-white mb-2 tracking-tight">
          Escolha como acessar
        </h1>
        <p className="text-sm text-slate-400 mb-8">
          A plataforma SupplyHub.IA oferece uma experiência otimizada tanto para desktop quanto para dispositivos móveis.
        </p>

        <div className="space-y-4">
          <button 
            onClick={() => alert("Simulação: Iniciando instalação do PWA...")}
            className="w-full bg-indigo-600 hover:bg-indigo-700 transition-colors rounded-2xl p-4 flex items-center justify-between group shadow-lg shadow-indigo-900/20"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 bg-white/10 rounded-xl flex items-center justify-center">
                <Smartphone className="h-5 w-5 text-white" />
              </div>
              <div className="text-left">
                <h3 className="font-bold text-white text-sm">Instalar Aplicativo</h3>
                <p className="text-xs text-indigo-200 mt-0.5">Experiência nativa e offline</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-indigo-300 group-hover:translate-x-1 transition-transform" />
          </button>

          <button 
            onClick={() => navigate('/login')}
            className="w-full bg-slate-700 hover:bg-slate-600 transition-colors rounded-2xl p-4 flex items-center justify-between group border border-slate-600"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 bg-slate-800 rounded-xl flex items-center justify-center">
                <Monitor className="h-5 w-5 text-slate-300" />
              </div>
              <div className="text-left">
                <h3 className="font-bold text-white text-sm">Continuar no Navegador</h3>
                <p className="text-xs text-slate-400 mt-0.5">Acesso web completo</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-700/50">
          <p className="text-[10px] text-slate-500 font-medium">
            Você pode alterar sua escolha depois nas configurações da conta.
          </p>
        </div>
      </div>
    </div>
  );
}
