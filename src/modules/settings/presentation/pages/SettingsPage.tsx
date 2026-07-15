import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import {
  Settings, Users, Shield, UserPlus, Edit2, Trash2, Check, X,
  Mail, Phone, UserCheck, AlertTriangle,
  Save, Bell, Lock, Eye
} from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type UserRole = 'Operador' | 'Gestor' | 'Administrador';

interface Operator {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: 'Ativo' | 'Pendente' | 'Inativo';
  createdAt: string;
  lastLogin: string;
}

type ApprovalPolicy = {
  id: string;
  name: string;
  threshold: string;
  requiresApprover: UserRole;
  enabled: boolean;
};

// ─── Mock Data ─────────────────────────────────────────────────────────────────
const INITIAL_OPERATORS: Operator[] = [
  {
    id: 'op-1',
    name: 'Vinicius Cordebello',
    email: 'vinicius@supplyhub.com.br',
    phone: '(11) 91234-5678',
    role: 'Administrador',
    status: 'Ativo',
    createdAt: '01/01/2026',
    lastLogin: 'Hoje, 09:15',
  }
];

const INITIAL_POLICIES: ApprovalPolicy[] = [
  { id: 'pol-1', name: 'Compras até R$ 5.000', threshold: 'R$ 5.000', requiresApprover: 'Operador', enabled: true },
  { id: 'pol-2', name: 'Compras de R$ 5.001 a R$ 25.000', threshold: 'R$ 25.000', requiresApprover: 'Gestor', enabled: true },
  { id: 'pol-3', name: 'Compras acima de R$ 25.000', threshold: 'Acima de R$ 25.000', requiresApprover: 'Administrador', enabled: true },
];

// ─── Componente BadgeRole ─────────────────────────────────────────────────────
function RoleBadge({ role }: { role: UserRole }) {
  if (role === 'Administrador') {
    return <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200"><Shield className="h-3 w-3" /> Administrador</span>;
  }
  if (role === 'Gestor') {
    return <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 border border-violet-200"><UserCheck className="h-3 w-3" /> Gestor</span>;
  }
  return <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200"><Users className="h-3 w-3" /> Operador</span>;
}

function StatusBadge({ status }: { status: Operator['status'] }) {
  if (status === 'Ativo') return <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200"><span className="h-1.5 w-1.5 rounded-full bg-green-500" />Ativo</span>;
  if (status === 'Pendente') return <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />Pendente</span>;
  return <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200"><span className="h-1.5 w-1.5 rounded-full bg-slate-400" />Inativo</span>;
}

// ─── Modal de Convite ──────────────────────────────────────────────────────────
function InviteModal({ onClose, onInvite }: { onClose: () => void; onInvite: (op: Operator) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('Operador');

  const handleSubmit = () => {
    if (!name.trim() || !email.trim()) return;
    onInvite({
      id: `op-${Date.now()}`,
      name,
      email,
      phone,
      role,
      status: 'Pendente',
      createdAt: new Date().toLocaleDateString('pt-BR'),
      lastLogin: '—',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-7 max-w-md w-full animate-in zoom-in-95 duration-200 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold text-slate-900">Convidar Novo Operador</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full"><X className="h-4 w-4 text-slate-400" /></button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Nome Completo *</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Maria Oliveira" className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">E-mail Corporativo *</label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Ex: maria@empresa.com.br" className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Telefone</label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 9xxxx-xxxx" className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Perfil de Acesso *</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value as UserRole)}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Operador">Operador — Cria e acompanha cotações</option>
              <option value="Gestor">Gestor — Aprova compras até R$ 25.000</option>
              <option value="Administrador">Administrador — Acesso total ao sistema</option>
            </select>
          </div>

          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
            <p className="text-[10px] font-bold text-indigo-700">
              <Bell className="inline h-3 w-3 mr-1" />
              Um e-mail de convite será enviado ao usuário com instruções de acesso.
            </p>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose} className="h-9 text-xs">Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || !email.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 text-xs font-bold flex items-center gap-2"
          >
            <Mail className="h-3.5 w-3.5" /> Enviar Convite
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal de Edição de Operador ───────────────────────────────────────────────
function EditOperatorModal({ operator, onClose, onSave }: { operator: Operator; onClose: () => void; onSave: (op: Operator) => void }) {
  const [form, setForm] = useState<Operator>({ ...operator });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-7 max-w-md w-full animate-in zoom-in-95 duration-200 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold text-slate-900">Editar Operador</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full"><X className="h-4 w-4 text-slate-400" /></button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Nome</label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">E-mail</label>
            <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Telefone</label>
            <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Perfil de Acesso</label>
            <select
              value={form.role}
              onChange={e => setForm({ ...form, role: e.target.value as UserRole })}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Operador">Operador</option>
              <option value="Gestor">Gestor</option>
              <option value="Administrador">Administrador</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</label>
            <select
              value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value as Operator['status'] })}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Ativo">Ativo</option>
              <option value="Pendente">Pendente</option>
              <option value="Inativo">Inativo</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose} className="h-9 text-xs">Cancelar</Button>
          <Button onClick={() => { onSave(form); onClose(); }} className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 text-xs font-bold flex items-center gap-2">
            <Save className="h-3.5 w-3.5" /> Salvar Alterações
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── SettingsPage Principal ────────────────────────────────────────────────────
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'meu_perfil' | 'operadores' | 'aprovacoes'>('meu_perfil');
  const [operators, setOperators] = useState<Operator[]>(() => {
    const saved = localStorage.getItem('supplyhub_operators');
    return saved ? JSON.parse(saved) : INITIAL_OPERATORS;
  });
  const [policies, setPolicies] = useState<ApprovalPolicy[]>(INITIAL_POLICIES);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingOperator, setEditingOperator] = useState<Operator | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showSaveToast, setShowSaveToast] = useState(false);
 
  // Simula papel de administrador
  const currentUser = operators.find(op => op.id === 'op-1') || operators[0] || INITIAL_OPERATORS[0];
  const isAdmin = currentUser.role === 'Administrador';
 
  // Perfil editável
  const [profileName, setProfileName] = useState(currentUser.name);
  const [profileEmail, setProfileEmail] = useState(currentUser.email);
  const [profilePhone, setProfilePhone] = useState(currentUser.phone);
  const [profileCpf, setProfileCpf] = useState(() => {
    const savedLogged = localStorage.getItem('supplyhub_logged_operator');
    if (savedLogged) {
      const parsed = JSON.parse(savedLogged);
      return parsed.cpf || '368.047.418-03';
    }
    return '368.047.418-03';
  });
 
  const handleAddOperator = (op: Operator) => {
    const updated = [...operators, op];
    setOperators(updated);
    localStorage.setItem('supplyhub_operators', JSON.stringify(updated));
  };
 
  const handleSaveOperator = (op: Operator) => {
    const updated = operators.map(o => o.id === op.id ? op : o);
    setOperators(updated);
    localStorage.setItem('supplyhub_operators', JSON.stringify(updated));
  };
 
  const handleDeleteOperator = (id: string) => {
    const updated = operators.filter(o => o.id !== id);
    setOperators(updated);
    localStorage.setItem('supplyhub_operators', JSON.stringify(updated));
    setDeletingId(null);
  };
 
  const handleTogglePolicy = (id: string) => {
    setPolicies(prev => prev.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p));
  };
 
  const handleSaveProfile = () => {
    const updatedOps = operators.map(op => op.id === 'op-1' ? {
      ...op,
      name: profileName,
      email: profileEmail,
      phone: profilePhone
    } : op);
    setOperators(updatedOps);
    localStorage.setItem('supplyhub_operators', JSON.stringify(updatedOps));
    
    // Salva perfil logado
    const logged = {
      name: profileName,
      email: profileEmail,
      phone: profilePhone,
      cpf: profileCpf,
      role: 'Administrador'
    };
    localStorage.setItem('supplyhub_logged_operator', JSON.stringify(logged));
    window.dispatchEvent(new Event('company_profile_updated'));
 
    setShowSaveToast(true);
    setTimeout(() => setShowSaveToast(false), 3000);
  };

  const TABS = [
    { id: 'meu_perfil', label: 'Meu Perfil', icon: Eye },
    ...(isAdmin ? [
      { id: 'operadores', label: 'Operadores & Convites', icon: Users, href: '/empresa/operadores' },
      { id: 'aprovacoes', label: 'Políticas de Aprovação', icon: Shield },
    ] : []),
  ];

  return (
    <div className="space-y-6 relative">

      {/* Toast de Salvo */}
      {showSaveToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-green-600 text-white text-sm font-bold shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300">
          <Check className="h-4 w-4" /> Perfil salvo com sucesso!
        </div>
      )}

      {/* Modal de Convite */}
      {showInviteModal && <InviteModal onClose={() => setShowInviteModal(false)} onInvite={handleAddOperator} />}

      {/* Modal de Edição */}
      {editingOperator && (
        <EditOperatorModal
          operator={editingOperator}
          onClose={() => setEditingOperator(null)}
          onSave={handleSaveOperator}
        />
      )}

      {/* Modal de Confirmação de Exclusão */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-7 max-w-sm w-full mx-4 animate-in zoom-in-95">
            <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900 text-center">Excluir Operador?</h3>
            <p className="text-xs text-slate-500 text-center mt-2">Esta ação remove o operador do sistema e revoga seus acessos. Não pode ser desfeita.</p>
            <div className="flex gap-3 mt-5 justify-center">
              <Button variant="outline" onClick={() => setDeletingId(null)} className="h-9 text-xs">Cancelar</Button>
              <Button onClick={() => handleDeleteOperator(deletingId)} className="bg-red-600 hover:bg-red-700 text-white h-9 text-xs font-bold">Excluir</Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Settings className="h-6 w-6 text-indigo-600" /> Configurações
          </h2>
          <p className="text-slate-500 text-sm mt-1">Gerencie seu perfil, operadores e políticas de aprovação.</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-xl">
            <Shield className="h-4 w-4 text-indigo-600" />
            <span className="text-xs font-bold text-indigo-700">Acesso Administrador</span>
          </div>
        )}
      </div>

      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-6">
          {TABS.map(tab => {
            const isLink = 'href' in tab;
            const Component = isLink ? Link : 'button';
            const extraProps = isLink ? { to: (tab as any).href } : { onClick: () => setActiveTab(tab.id as any) };
            return (
              <Component
                key={tab.id}
                {...(extraProps as any)}
                className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </Component>
            );
          })}
        </nav>
      </div>

      {/* ── Aba Meu Perfil ─────────────────────────────────────────────────── */}
      {activeTab === 'meu_perfil' && (
        <div className="max-w-lg space-y-6 bg-white border border-slate-200 rounded-2xl p-7 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center">
              <span className="text-lg font-black text-indigo-700">{profileName[0]}</span>
            </div>
            <div>
              <p className="font-bold text-slate-900">{profileName}</p>
              <RoleBadge role={currentUser.role} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Nome Completo</label>
              <Input value={profileName} onChange={e => setProfileName(e.target.value)} className="h-10 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">E-mail Corporativo</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input type="email" value={profileEmail} onChange={e => setProfileEmail(e.target.value)} className="pl-9 h-10 text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">CPF</label>
              <Input value={profileCpf} onChange={e => setProfileCpf(e.target.value)} className="h-10 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Telefone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input value={profilePhone} onChange={e => setProfilePhone(e.target.value)} className="pl-9 h-10 text-sm" />
              </div>
            </div>

            {/* Alterar Senha */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Senha</label>
              <Button variant="outline" className="w-full h-10 text-xs flex items-center gap-2 justify-center">
                <Lock className="h-3.5 w-3.5" /> Alterar Senha
              </Button>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <Button onClick={handleSaveProfile} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-10 font-bold text-xs flex items-center gap-2 justify-center">
              <Save className="h-3.5 w-3.5" /> Salvar Perfil
            </Button>
          </div>
        </div>
      )}

      {/* ── Aba Operadores ──────────────────────────────────────────────────── */}
      {activeTab === 'operadores' && isAdmin && (
        <div className="space-y-4">

          {/* Grade de Perfis */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Shield className="h-4 w-4 text-indigo-600" /> Grade de Perfis de Acesso
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {([
                { role: 'Operador' as UserRole, description: 'Cria cotações, gerencia produtos e visualiza relatórios.', color: 'bg-slate-50 border-slate-200', badge: 'bg-slate-100 text-slate-700' },
                { role: 'Gestor' as UserRole, description: 'Aprova cotações, convida operadores e acessa análises financeiras.', color: 'bg-violet-50 border-violet-100', badge: 'bg-violet-100 text-violet-700' },
                { role: 'Administrador' as UserRole, description: 'Acesso total: configurações da empresa, políticas, operadores e integrações.', color: 'bg-indigo-50 border-indigo-100', badge: 'bg-indigo-100 text-indigo-800' },
              ] as { role: UserRole; description: string; color: string; badge: string }[]).map(p => (
                <div key={p.role} className={`border rounded-xl p-4 ${p.color}`}>
                  <RoleBadge role={p.role} />
                  <p className="text-[11px] text-slate-500 mt-2 leading-snug">{p.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Header da listagem */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Operadores Ativos ({operators.length})</h3>
            <Button onClick={() => setShowInviteModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 text-xs font-bold flex items-center gap-2">
              <UserPlus className="h-3.5 w-3.5" /> Convidar Operador
            </Button>
          </div>

          {/* Tabela de Operadores */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Operador</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Perfil</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Último Acesso</th>
                  <th className="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {operators.map(op => (
                  <tr key={op.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center shrink-0">
                          <span className="text-xs font-black text-indigo-700">{op.name[0]}</span>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">{op.name}</p>
                          <p className="text-[10px] text-slate-400">{op.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5"><RoleBadge role={op.role} /></td>
                    <td className="px-5 py-3.5"><StatusBadge status={op.status} /></td>
                    <td className="px-5 py-3.5 text-[11px] text-slate-400 font-mono">{op.lastLogin}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setEditingOperator(op)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        {op.id !== 'op-1' && (
                          <button
                            onClick={() => setDeletingId(op.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Aba Políticas de Aprovação ──────────────────────────────────────── */}
      {activeTab === 'aprovacoes' && isAdmin && (
        <div className="space-y-4">
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-indigo-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-indigo-800">Políticas de Aprovação por Valor</p>
              <p className="text-xs text-indigo-600 mt-0.5">Defina os limites financeiros de aprovação por perfil de usuário. Cotações que ultrapassarem o limite definido exigirão aprovação do perfil correspondente.</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Faixa de Valor</th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Limite</th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Aprovador Requerido</th>
                  <th className="px-6 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">Ativo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {policies.map(pol => (
                  <tr key={pol.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-800 text-xs">{pol.name}</td>
                    <td className="px-6 py-4 font-bold text-indigo-700 text-xs font-mono">{pol.threshold}</td>
                    <td className="px-6 py-4"><RoleBadge role={pol.requiresApprover} /></td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <button
                          onClick={() => handleTogglePolicy(pol.id)}
                          className={`w-10 h-5 rounded-full transition-colors relative ${pol.enabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
                        >
                          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${pol.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-800">Importante</p>
              <p className="text-[11px] text-amber-700 mt-0.5">As políticas de aprovação serão aplicadas em tempo real a partir do próximo envio de cotação. Valores já em andamento não são afetados retroativamente.</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
