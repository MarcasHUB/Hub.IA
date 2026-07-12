import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Search, BarChart3, FileText, ArrowRight, ShieldCheck, ShoppingCart, X } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();
  const [isRequestAccessOpen, setIsRequestAccessOpen] = useState(false);
  const [requestEmail, setRequestEmail] = useState('');
  const [isRequested, setIsRequested] = useState(false);

  const handleRequestAccess = (e: React.FormEvent) => {
    e.preventDefault();
    if (requestEmail) {
      setIsRequested(true);
      setTimeout(() => {
        setIsRequestAccessOpen(false);
        setIsRequested(false);
        setRequestEmail('');
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0d14] font-sans text-slate-100 flex flex-col justify-between overflow-x-hidden selection:bg-indigo-500 selection:text-white">
      
      {/* Header */}
      <header className="w-full bg-[#0b0f19]/80 backdrop-blur-md border-b border-slate-900/60 sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          
          {/* Logo Hub.IA */}
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-white tracking-tight">Hub.IA</span>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">
              Suprimentos
            </span>
          </div>

          {/* Links e Ações */}
          <div className="flex items-center gap-6">
            <button 
              onClick={() => navigate('/login')}
              className="text-slate-300 hover:text-white transition-colors text-xs font-semibold uppercase tracking-wider"
            >
              Diagnóstico
            </button>
            <button 
              onClick={() => navigate('/login')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl px-5 py-2 transition-all shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20"
            >
              Entrar
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col justify-center py-12 md:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-8">
            
            {/* Texto Hero */}
            <div className="w-full lg:w-1/2 space-y-6 text-left">
              <div className="inline-flex items-center rounded-full border border-slate-800 bg-[#0e1322] px-3.5 py-1 text-[11px] font-semibold text-indigo-400 tracking-wide uppercase">
                <span className="flex h-1.5 w-1.5 rounded-full bg-cyan-400 mr-2 animate-pulse"></span>
                Marketplace Corporativo Inteligente
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-extrabold tracking-tight text-white leading-[1.1]">
                A nova era em <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-sky-300">Suprimentos B2B</span>
              </h1>
              
              <p className="text-slate-400 text-sm sm:text-base max-w-lg leading-relaxed">
                Conectamos indústrias aos melhores fornecedores in um catálogo unificado. Compare preços, monte sua requisição e compre com eficiência usando IA.
              </p>
              
              <div>
                <Button 
                  size="lg" 
                  className="bg-white hover:bg-slate-100 text-slate-900 font-bold h-12 px-6 rounded-xl shadow-lg transition-transform hover:-translate-y-0.5 inline-flex items-center gap-2"
                  onClick={() => setIsRequestAccessOpen(true)}
                >
                  Conhecer a Rede Hub.IA <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Imagem / Mockup com Cards Flutuantes */}
            <div className="w-full lg:w-1/2 flex items-center justify-center relative">
              {/* Efeitos de Glow no fundo */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[350px] w-[350px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>
              
              <div className="relative rounded-2xl border border-slate-800/80 bg-[#0b0f19] p-2.5 shadow-2xl shadow-black/80 max-w-[540px] w-full overflow-hidden">
                <img 
                  src="https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=800" 
                  alt="Industrial Machinery Preview" 
                  className="rounded-xl border border-slate-900/60 w-full h-[280px] sm:h-[340px] object-cover opacity-85"
                />
                
                {/* Cards Flutuantes (Glassmorphism) no Rodapé da Imagem */}
                <div className="absolute bottom-6 left-6 right-6 flex gap-4 flex-col sm:flex-row pointer-events-none">
                  <div className="flex-1 bg-slate-950/70 backdrop-blur-md rounded-xl p-3 border border-slate-800/60 flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20">
                      <ShieldCheck className="h-4.5 w-4.5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Fornecedores</p>
                      <p className="text-[11px] font-extrabold text-white mt-1 leading-none">Homologados</p>
                    </div>
                  </div>

                  <div className="flex-1 bg-slate-950/70 backdrop-blur-md rounded-xl p-3 border border-slate-800/60 flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0 border border-indigo-500/20">
                      <BarChart3 className="h-4.5 w-4.5 text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Inteligência</p>
                      <p className="text-[11px] font-extrabold text-white mt-1 leading-none">Competitiva</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Info Bar Rodapé */}
      <footer className="w-full bg-[#07090e] border-t border-slate-900/60 py-6 shrink-0">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4">
            
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-indigo-650/15 border border-indigo-500/10 flex items-center justify-center shrink-0">
                <Search className="h-4.5 w-4.5 text-indigo-400" />
              </div>
              <div className="leading-tight">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Pesquisa Unificada</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Localize produtos técnicos em segundos.</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-indigo-650/15 border border-indigo-500/10 flex items-center justify-center shrink-0">
                <ShoppingCart className="h-4.5 w-4.5 text-indigo-400" />
              </div>
              <div className="leading-tight">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Múltiplos Fornecedores</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Compare preços simultaneamente.</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-indigo-650/15 border border-indigo-500/10 flex items-center justify-center shrink-0">
                <FileText className="h-4.5 w-4.5 text-indigo-400" />
              </div>
              <div className="leading-tight">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Geração de RC</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Exporte requisições em 1 clique.</p>
              </div>
            </div>

          </div>
        </div>
      </footer>

      {/* Modal de Solicitação de Acesso */}
      {isRequestAccessOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
          <div className="bg-[#0b0f19] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-800">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60 bg-[#0a0d14]">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-indigo-400" /> Rede Hub.IA
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Solicite acesso à plataforma fechada B2B.</p>
              </div>
              <button onClick={() => setIsRequestAccessOpen(false)} className="p-1.5 hover:bg-slate-800 rounded-full text-slate-400">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRequestAccess} className="p-6 space-y-4">
              {isRequested ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="h-12 w-12 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                    <ShieldCheck className="h-6 w-6 text-emerald-400" />
                  </div>
                  <h4 className="text-sm font-bold text-white">Solicitação Enviada!</h4>
                  <p className="text-xs text-slate-400 mt-2">O Administrador (Hub.IA) avaliará seu pedido e enviará um e-mail de convite com o link para o Onboarding.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">E-mail Corporativo</label>
                    <Input 
                      type="email" 
                      placeholder="seu.nome@empresa.com.br" 
                      value={requestEmail} 
                      onChange={e => setRequestEmail(e.target.value)} 
                      required
                      className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-600 focus:border-indigo-500"
                    />
                  </div>
                  <div className="pt-2">
                    <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10 shadow-lg shadow-indigo-900/20">
                      Solicitar Acesso
                    </Button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
