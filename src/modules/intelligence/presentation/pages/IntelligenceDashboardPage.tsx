import { BrainCircuit, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/shared/components/ui/Card';

export default function IntelligenceDashboardPage() {
  return <div className="space-y-6"><div><h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900"><BrainCircuit className="h-6 w-6 text-indigo-600" /> Inteligência Hub.IA</h1><p className="mt-1 text-sm text-slate-500">Análises versionadas sobre dados comerciais persistidos.</p></div><Card className="border-indigo-200"><CardContent className="flex items-start gap-4 p-6"><ShieldCheck className="mt-0.5 h-7 w-7 text-indigo-600" /><div><h2 className="font-bold text-slate-900">Nenhuma análise real disponível</h2><p className="mt-1 text-sm leading-relaxed text-slate-600">Recomendações, scores e rankings só aparecem quando houver um snapshot produzido por um serviço autorizado. A Hub.IA não cria fornecedores, preços ou decisões para preencher esta tela.</p></div></CardContent></Card></div>;
}
