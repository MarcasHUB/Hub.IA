import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ChevronRight, Download, Monitor, MoreVertical, Share, Smartphone } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export default function AppAccessChoicePage() {
  const navigate = useNavigate();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)');
    const runningStandalone = displayMode.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setInstalled(runningStandalone);

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setMessage('Aplicativo instalado com sucesso.');
    };

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const installApp = async () => {
    setMessage('');

    if (installed) {
      navigate('/login');
      return;
    }

    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setMessage('Instalação iniciada. O SupplyHub aparecerá entre seus aplicativos.');
      } else {
        setMessage('Instalação cancelada. Você pode tentar novamente quando quiser.');
      }
      setInstallPrompt(null);
      return;
    }

    const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isiOS) {
      setMessage('No iPhone/iPad: toque em Compartilhar e depois em “Adicionar à Tela de Início”.');
    } else {
      setMessage('No navegador, abra o menu e escolha “Instalar app” ou “Adicionar à tela inicial”.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 font-sans text-slate-100">
      <div className="max-w-md w-full bg-slate-800 rounded-3xl p-8 shadow-2xl border border-slate-700 text-center animate-in fade-in zoom-in duration-300">
        <div className="mx-auto w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-6 border border-indigo-500/30">
          {installed ? <CheckCircle2 className="h-8 w-8 text-emerald-400" /> : <Smartphone className="h-8 w-8 text-indigo-400" />}
        </div>

        <h1 className="text-2xl font-extrabold text-white mb-2 tracking-tight">
          {installed ? 'SupplyHub instalado' : 'Acesse o SupplyHub no celular'}
        </h1>
        <p className="text-sm text-slate-400 mb-8">
          Instale o aplicativo no telefone ou continue pelo navegador. O login e as permissões são os mesmos da sua conta SupplyHub.
        </p>

        <div className="space-y-4">
          <button
            onClick={installApp}
            className="w-full bg-indigo-600 hover:bg-indigo-700 transition-colors rounded-2xl p-4 flex items-center justify-between group shadow-lg shadow-indigo-900/20"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 bg-white/10 rounded-xl flex items-center justify-center">
                {installed ? <Smartphone className="h-5 w-5 text-white" /> : <Download className="h-5 w-5 text-white" />}
              </div>
              <div className="text-left">
                <h3 className="font-bold text-white text-sm">{installed ? 'Abrir Aplicativo' : 'Instalar Aplicativo'}</h3>
                <p className="text-xs text-indigo-200 mt-0.5">
                  {installed ? 'Abrir sua conta SupplyHub' : 'Ícone na tela inicial e experiência em janela própria'}
                </p>
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
                <p className="text-xs text-slate-400 mt-0.5">Entrar sem instalar</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {message && (
          <div className="mt-5 rounded-2xl border border-indigo-400/20 bg-indigo-500/10 p-3 text-left text-xs leading-relaxed text-indigo-100">
            {message}
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-slate-700/50 text-left">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-3">Se o botão de instalação não aparecer</p>
          <div className="space-y-2 text-xs text-slate-400">
            <p className="flex items-center gap-2"><MoreVertical className="h-3.5 w-3.5 shrink-0" /> Android/Chrome: menu do navegador → Instalar app.</p>
            <p className="flex items-center gap-2"><Share className="h-3.5 w-3.5 shrink-0" /> iPhone/Safari: Compartilhar → Adicionar à Tela de Início.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
