import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Label } from '@/shared/components/ui/Label';
import { useNavigate } from 'react-router-dom';

export default function SupplierFormPage() {
  const navigate = useNavigate();

  // Estados locais
  const [document, setDocument] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !document.trim() || !category.trim()) return;

    const newPartner = {
      id: `sup-${Date.now()}`,
      name,
      document,
      segment: category,
      city: city || 'São Paulo',
      state: state || 'SP',
      status: 'accepted',
      since: new Date().toLocaleDateString('pt-BR'),
      connectionId: `conn-${Date.now()}`,
      phone: phone || undefined,
      email: email || undefined,
      website: website || undefined,
      employeesRange: '10–50',
      rating: 5.0,
      responseTime: '~1h',
      quotationsCount: 0,
      products: [category]
    };

    // Salva no localStorage de parceiros homologados
    const saved = localStorage.getItem('supplyhub_partners');
    const list = saved ? JSON.parse(saved) : [];
    list.push(newPartner);
    localStorage.setItem('supplyhub_partners', JSON.stringify(list));

    // Também adiciona na rede de empresas como conectado para integridade
    const savedNetwork = localStorage.getItem('supplyhub_network_companies');
    const networkList = savedNetwork ? JSON.parse(savedNetwork) : [];
    if (!networkList.some((c: any) => c.document === document)) {
      networkList.push({
        id: newPartner.id,
        name: newPartner.name,
        document: newPartner.document,
        segment: newPartner.segment,
        city: newPartner.city,
        state: newPartner.state,
        description: 'Fornecedor cadastrado manualmente',
        employeesRange: '10–50',
        connected: true,
        invited: false
      });
      localStorage.setItem('supplyhub_network_companies', JSON.stringify(networkList));
    }

    navigate('/suppliers');
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Cadastrar Fornecedor</h2>
        <p className="text-slate-500">Preencha os dados básicos para iniciar a homologação.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="document">CNPJ / CPF *</Label>
              <Input
                id="document"
                placeholder="00.000.000/0001-00"
                value={document}
                onChange={e => setDocument(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Categoria Principal *</Label>
              <Input
                id="category"
                placeholder="Ex: Equipamentos de TI"
                value={category}
                onChange={e => setCategory(e.target.value)}
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="name">Razão Social / Nome Fantasia *</Label>
            <Input
              id="name"
              placeholder="Ex: Alfa Industrial Ltda"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">Cidade</Label>
              <Input
                id="city"
                placeholder="Ex: São Paulo"
                value={city}
                onChange={e => setCity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">Estado (UF)</Label>
              <Input
                id="state"
                placeholder="Ex: SP"
                value={state}
                onChange={e => setState(e.target.value)}
                maxLength={2}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 border-t border-slate-100 pt-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                placeholder="Ex: (11) 4002-8922"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                placeholder="Ex: vendas@empresa.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                placeholder="Ex: www.empresa.com.br"
                value={website}
                onChange={e => setWebsite(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-4 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={() => navigate('/suppliers')}>
            Cancelar
          </Button>
          <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
            Salvar Fornecedor
          </Button>
        </div>
      </form>
    </div>
  );
}