import { Building2, Globe2, Handshake, Lightbulb, Package, Radio } from 'lucide-react';
import { Link } from 'react-router-dom';

const sections = [
  { title: 'Descobrir empresas', description: 'Encontre organizações públicas pela rede canônica.', href: '/suppliers/network', icon: Globe2 },
  { title: 'Minha Rede', description: 'Acesse conexões aceitas e solicitações reais.', href: '/suppliers', icon: Handshake },
  { title: 'Atualizações', description: 'Publicações empresariais autorizadas aparecerão aqui quando persistidas.', icon: Radio },
  { title: 'Oportunidades', description: 'Oportunidades comerciais aparecerão somente quando houver domínio persistido.', icon: Lightbulb },
  { title: 'Materiais & Capacidades', description: 'Explore materiais globais e capacidades públicas das empresas.', href: '/products', icon: Package },
];

export default function HubConnectPage() {
  return <div className="space-y-6"><div className="rounded-2xl bg-slate-950 p-8 text-white"><h1 className="flex items-center gap-3 text-3xl font-extrabold"><Building2 className="h-8 w-8 text-indigo-400" /> HubConnect+</h1><p className="mt-2 max-w-2xl text-sm text-slate-300">Rede profissional B2B baseada nas mesmas organizações, conexões e catálogos do Hub.IA.</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{sections.map(section => { const Icon = section.icon; const content = <div className="h-full rounded-2xl border bg-white p-6 shadow-sm transition hover:border-indigo-300 hover:shadow-md"><Icon className="h-7 w-7 text-indigo-600" /><h2 className="mt-4 font-bold text-slate-900">{section.title}</h2><p className="mt-2 text-sm leading-relaxed text-slate-500">{section.description}</p></div>; return section.href ? <Link key={section.title} to={section.href}>{content}</Link> : <div key={section.title}>{content}</div>; })}</div></div>;
}
