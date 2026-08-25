import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/Dialog';
import { useAdminOrganizationDetails } from '../../application/hooks/useAdminOrganizationDetails';
import { Loader2, Building2, MapPin, Mail, ShieldCheck, Tag, Info } from 'lucide-react';
import { resolveOrganizationLogoUrl } from '@/shared/utils/logoUtils';
import { Badge } from '@/shared/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card';
import { useState } from 'react';

export function AdminCompanyDetailsModal({
  isOpen,
  onClose,
  organizationId,
}: {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string | null;
}) {
  const { data: details, isLoading } = useAdminOrganizationDetails(organizationId);
  const [activeTab, setActiveTab] = useState('geral');

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes da Empresa</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="animate-spin w-8 h-8 text-slate-400" /></div>
        ) : details ? (
          <div className="space-y-6 mt-4">
            {/* Header Profiling */}
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 border">
                {details.identificacao.logo_url ? (
                  <img src={resolveOrganizationLogoUrl(details.identificacao.logo_url) || undefined} alt="Logo" className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <Building2 className="w-8 h-8 text-slate-400" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold">{details.identificacao.nome_fantasia || details.identificacao.name}</h2>
                <p className="text-sm text-slate-500">{details.identificacao.razao_social}</p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline">{details.identificacao.cnpj}</Badge>
                  <Badge>{details.identificacao.status}</Badge>
                  <Badge variant="secondary">{details.identificacao.profile_completion}% Cadastro</Badge>
                </div>
              </div>
            </div>

            <div className="border-b border-slate-200">
              <div className="flex space-x-4">
                {['geral', 'cadastro', 'sistema'].map((tab) => (
                  <button
                    key={tab}
                    className={`py-2 px-1 border-b-2 text-sm font-medium ${
                      activeTab === tab
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab === 'geral' && 'Visão Geral'}
                    {tab === 'cadastro' && 'Cadastro e Fiscal'}
                    {tab === 'sistema' && 'Sistema'}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === 'geral' && (
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><MapPin className="w-4 h-4"/> Endereço</CardTitle></CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <p>{details.endereco.address_street}, {details.endereco.address_number}</p>
                      <p>{details.endereco.address_neighborhood} - {details.endereco.city}/{details.endereco.state}</p>
                      <p>CEP: {details.endereco.address_zip_code}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Mail className="w-4 h-4"/> Contato</CardTitle></CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <p>Email: {details.contato.email_corporativo || details.contato.business_email}</p>
                      <p>Tel: {details.contato.telefone || details.contato.phone}</p>
                      <p>Site: {details.contato.website || '-'}</p>
                    </CardContent>
                  </Card>
                </div>
                
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Tag className="w-4 h-4"/> Segmentos e Perfil Comercial</CardTitle></CardHeader>
                  <CardContent className="text-sm">
                    <div className="flex flex-wrap gap-2 mb-4">
                      {details.canonicos.segmentos.map(s => <Badge key={s} variant="secondary">{s}</Badge>)}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-slate-600">
                      <p>Perfil: {details.perfil.perfil_comercial}</p>
                      <p>Porte: {details.perfil.company_size}</p>
                      <p>Modelo: {details.perfil.business_model}</p>
                      <p>Raio de Atendimento: {details.perfil.raio_atendimento_km} km</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === 'cadastro' && (
              <div className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="w-4 h-4"/> Dados Fiscais</CardTitle></CardHeader>
                  <CardContent className="text-sm grid grid-cols-2 gap-y-2">
                    <p><span className="font-medium">Inscrição Estadual:</span> {details.fiscal.inscricao_estadual}</p>
                    <p><span className="font-medium">Inscrição Municipal:</span> {details.fiscal.inscricao_municipal}</p>
                    <p><span className="font-medium">Situação Cadastral:</span> {details.fiscal.situacao_cadastral}</p>
                    <p><span className="font-medium">Data de Abertura:</span> {details.fiscal.data_abertura}</p>
                    <p><span className="font-medium">Natureza Jurídica:</span> {details.fiscal.natureza_juridica}</p>
                    <p><span className="font-medium">CNAE Principal:</span> {details.fiscal.cnae_principal}</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === 'sistema' && (
              <div className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Info className="w-4 h-4"/> Dados Internos</CardTitle></CardHeader>
                  <CardContent className="text-sm grid grid-cols-2 gap-y-2 text-slate-600">
                    <p>UUID: {details.identificacao.id}</p>
                    <p>Criado em: {new Date(details.sistema.created_at).toLocaleDateString()}</p>
                    <p>Atualizado em: {new Date(details.sistema.updated_at).toLocaleDateString()}</p>
                    <p>Sync Receita: {details.sistema.ultima_sincronizacao_receita ? new Date(details.sistema.ultima_sincronizacao_receita).toLocaleDateString() : '-'}</p>
                    <p>Confiança Receita: {details.sistema.nivel_confianca_cadastro}%</p>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500">Erro ao carregar dados.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
