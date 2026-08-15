import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Label } from '@/shared/components/ui/Label';
import { useNavigate } from 'react-router-dom';
import { SupabaseSupplierRepository } from '../../infrastructure/repositories/SupabaseSupplierRepository';
import { Supplier } from '../../domain/entities/Supplier';
import { useAuthenticatedIdentity } from '@/modules/auth/presentation/hooks/useAuthenticatedIdentity';

const repo = new SupabaseSupplierRepository();

export default function SupplierFormPage() {
  const { data: identity } = useAuthenticatedIdentity();
  const tenantId = identity?.organizationId || '';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !document.trim() || !category.trim()) return;

    try {
      const newSupplier = new Supplier(
        crypto.randomUUID(),
        tenantId,
        name,
        document,
        undefined,
        'APPROVED'
      );
      await repo.save(newSupplier);
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar fornecedor.');
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
