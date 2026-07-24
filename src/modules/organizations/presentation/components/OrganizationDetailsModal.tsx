import React, { useState, useEffect } from 'react';
import { supabase } from '@/infrastructure/supabase/client';
import { XCircle, Save, CheckCircle2, Tag, Building2, Phone, Mail, Globe, MapPin, Users } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Badge } from '@/shared/components/ui/Badge';

interface OrganizationDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  organization: any;
  onSaved: () => void;
}
  
const formatPhone = (value: string) => {
  const v = value.replace(/\D/g, '');
  if (v.length <= 10) {
    return v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
  }
  return v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
};

export function OrganizationDetailsModal({ isOpen, onClose, organization, onSaved }: OrganizationDetailsModalProps) {
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  // Form State
  const [formData, setFormData] = useState<any>({});
  
  // Segments State
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [availableSegments, setAvailableSegments] = useState<{id: string, nome: string}[]>([]);
  const [isNewSegmentModalOpen, setIsNewSegmentModalOpen] = useState(false);
  const [newSegment, setNewSegment] = useState({ nome: '', descricao: '' });

  useEffect(() => {
    if (isOpen && organization) {
      setFormData({
        razao_social: organization.razao_social || organization.name || '',
        nome_fantasia: organization.nome_fantasia || organization.trade_name || '',
        cnpj: organization.cnpj || '',
        business_model: organization.business_model || organization.profile_type || '',
        status: organization.status || 'ativo',
        telefone: organization.telefone || organization.phone || '',
        email_corporativo: organization.email_corporativo || organization.business_email || '',
        website: organization.website || '',
        city: organization.city || '',
        state: organization.state || '',
      });

      if (Array.isArray(organization.segment)) {
        setSelectedSegments(organization.segment);
      } else if (typeof organization.segment === 'string') {
        setSelectedSegments(organization.segment.split(',').map((s: string) => s.trim()).filter(Boolean));
      } else {
        setSelectedSegments([]);
      }

      loadAvailableSegments();
      setSaved(false);
    }
  }, [isOpen, organization]);

  const loadAvailableSegments = async () => {
    const { data } = await supabase.from('segments').select('id, nome').order('nome');
    if (data) {
      setAvailableSegments(data);
    }
  };

  const handleSave = async () => {
    if (!organization?.id) return;
    setLoading(true);
    
    const payload = {
      ...formData,
      segment: selectedSegments.length > 0 ? selectedSegments.join(', ') : null
    };

    const { error } = await supabase.from('organizations').update(payload).eq('id', organization.id);
    
    setLoading(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSaved();
    }
  };

  if (!isOpen || !organization) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col relative animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-4">
            {organization.logo_url ? (
              <img src={organization.logo_url} alt="Logo" className="h-12 w-12 rounded-xl object-contain bg-slate-50 border border-slate-200" />
            ) : (
              <div className="h-12 w-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-lg border border-indigo-100">
                {(formData.nome_fantasia || 'Hub').substring(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">{formData.nome_fantasia || 'Detalhes da Empresa'}</h2>
              <p className="text-sm font-mono text-slate-500 mt-1">{formData.cnpj}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <XCircle className="h-6 w-6 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            <div className="lg:col-span-2 space-y-8">
              {/* DADOS GERAIS */}
              <section className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2 pb-2 border-b border-slate-100">
                  <Building2 className="h-4 w-4" /> Dados Gerais
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Razão Social</label>
                    <Input value={formData.razao_social} onChange={e => setFormData({...formData, razao_social: e.target.value})} className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Nome Fantasia</label>
                    <Input value={formData.nome_fantasia} onChange={e => setFormData({...formData, nome_fantasia: e.target.value})} className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">CNPJ</label>
                    <Input value={formData.cnpj} onChange={e => setFormData({...formData, cnpj: e.target.value})} className="h-9 font-mono text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Perfil Comercial</label>
                    <select 
                      value={formData.business_model} 
                      onChange={e => setFormData({...formData, business_model: e.target.value})}
                      className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Selecione...</option>
                      <option value="Indústria / Fabricante">Indústria / Fabricante</option>
                      <option value="Distribuidor / Revenda">Distribuidor / Revenda</option>
                      <option value="Prestador de Serviços">Prestador de Serviços</option>
                      <option value="Importador">Importador</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* SEGMENTOS */}
              <section className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2 pb-2 border-b border-slate-100">
                  <Tag className="h-4 w-4" /> Segmentos de Atuação
                </h3>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {selectedSegments.map(seg => (
                      <span key={seg} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-100 flex items-center gap-1">
                        {seg}
                        <button onClick={() => setSelectedSegments(prev => prev.filter(s => s !== seg))} className="hover:text-indigo-900">&times;</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className="h-9 px-3 pr-8 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[200px]"
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          if (!selectedSegments.includes(val)) setSelectedSegments(prev => [...prev, val]);
                          e.target.value = '';
                        }
                      }}
                    >
                      <option value="">Selecione para adicionar...</option>
                      {availableSegments.map(s => (
                        <option key={s.id} value={s.nome}>{s.nome}</option>
                      ))}
                    </select>
                    <button 
                      onClick={() => setIsNewSegmentModalOpen(true)}
                      className="px-3 h-9 border border-dashed border-slate-300 text-slate-500 text-xs font-bold rounded-lg hover:border-indigo-500 hover:text-slate-700 transition-colors"
                    >
                      + Criar Novo
                    </button>
                  </div>
                </div>
              </section>
              
              {/* EVOLUÇÃO FUTURA (MOCK) */}
              <section className="space-y-4 pt-4 opacity-50 pointer-events-none">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2 pb-2 border-b border-slate-100">
                  Métricas de Negócio (Em Breve)
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Volume Comprado</p>
                    <p className="text-lg font-extrabold text-slate-800 mt-1">R$ --</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">BIDs Ganhos</p>
                    <p className="text-lg font-extrabold text-slate-800 mt-1">--</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Fornecedores</p>
                    <p className="text-lg font-extrabold text-slate-800 mt-1">--</p>
                  </div>
                </div>
              </section>

            </div>

            <div className="space-y-8">
              {/* CONTATO & OPERAÇÃO */}
              <section className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2 pb-2 border-b border-slate-100">
                  <Phone className="h-4 w-4" /> Contato e Operação
                </h3>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Telefone</label>
                    <Input value={formData.telefone} onChange={e => setFormData({...formData, telefone: formatPhone(e.target.value)})} maxLength={15} className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">E-mail Corporativo</label>
                    <Input value={formData.email_corporativo} onChange={e => setFormData({...formData, email_corporativo: e.target.value})} className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Site</label>
                    <Input value={formData.website} onChange={e => setFormData({...formData, website: e.target.value})} className="h-9" />
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cidade</label>
                      <Input value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Estado (UF)</label>
                      <Input value={formData.state} onChange={e => setFormData({...formData, state: e.target.value.toUpperCase()})} maxLength={2} className="h-9 uppercase" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-3">
                  <div className="h-10 w-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{organization.operatorCount || 0} Operadores</p>
                    <p className="text-xs text-slate-500">{organization.activeOperatorCount || 0} Ativos / {organization.inactiveOperatorCount || 0} Inativos</p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex items-center justify-between shrink-0">
          <Badge className={formData.status === 'ativo' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}>
            {formData.status === 'ativo' ? 'EMPRESA ATIVA' : 'EMPRESA INATIVA'}
          </Badge>
          
          <div className="flex items-center gap-3">
            {saved && <span className="text-sm font-bold text-green-600 flex items-center gap-1"><CheckCircle2 className="h-4 w-4"/> Salvo!</span>}
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2">
              <Save className="h-4 w-4" /> Salvar Alterações
            </Button>
          </div>
        </div>
      </div>

      {/* Modal Novo Segmento (Reutilizado) */}
      {isNewSegmentModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">Novo Segmento</h3>
              <button onClick={() => setIsNewSegmentModalOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-full">
                <XCircle className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Nome *</label>
                <Input value={newSegment.nome} onChange={e => setNewSegment({ ...newSegment, nome: e.target.value })} placeholder="Ex: Logística..." className="h-9" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Descrição</label>
                <textarea value={newSegment.descricao} onChange={e => setNewSegment({ ...newSegment, descricao: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 pb-6">
              <Button variant="outline" onClick={() => setIsNewSegmentModalOpen(false)}>Cancelar</Button>
              <Button onClick={async () => {
                if (!newSegment.nome.trim()) return;
                await supabase.from('segments').insert({ organization_id: 'GLOBAL', nome: newSegment.nome.trim(), descricao: newSegment.descricao.trim(), status: 'ativo' });
                setSelectedSegments(prev => Array.from(new Set([...prev, newSegment.nome.trim()])));
                await loadAvailableSegments();
                setIsNewSegmentModalOpen(false);
                setNewSegment({nome:'', descricao:''});
              }} disabled={!newSegment.nome.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white">Criar Segmento</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
