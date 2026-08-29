import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/shared/components/ui/Dialog';
import { Button } from '@/shared/components/ui/Button';
import { Checkbox } from '@/shared/components/ui/Checkbox';
import { ClearableInput } from '@/shared/components/ui/ClearableInput';
import { SupabaseSupplierRepository } from '../../../suppliers/infrastructure/repositories/SupabaseSupplierRepository';
import { useAuthenticatedIdentity } from '@/modules/auth/presentation/hooks/useAuthenticatedIdentity';

interface Supplier {
  id: string;
  name: string;
  document: string;
}

interface LinkSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLink: (selectedSuppliers: Supplier[]) => void;
  alreadyLinkedIds: string[];
}

export function LinkSupplierModal({ isOpen, onClose, onLink, alreadyLinkedIds }: LinkSupplierModalProps) {
  const { data: identity } = useAuthenticatedIdentity();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      loadSuppliers();
      setSelectedIds(new Set()); // Reset selection on open
    }
  }, [isOpen]);

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const repo = new SupabaseSupplierRepository();
      const data = await repo.findAll(identity?.organizationId || '');
      // Filter out those already linked
      const available = data.filter(s => !alreadyLinkedIds.includes(s.id));
      setSuppliers(available.map(s => ({ id: s.id, name: s.name, document: s.document })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.document.includes(search)
  );

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleConfirm = () => {
    const selected = suppliers.filter(s => selectedIds.has(s.id));
    onLink(selected);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Vincular Fornecedores</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <ClearableInput 
            placeholder="Buscar fornecedor por nome ou documento..." 
            value={search}
            onChange={setSearch}
            onClear={() => setSearch('')}
          />

          <div className="max-h-[300px] overflow-y-auto border rounded-md">
            {loading ? (
              <div className="p-4 text-center text-sm text-slate-500">Carregando fornecedores...</div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500">Nenhum fornecedor disponível para vínculo.</div>
            ) : (
              <div className="divide-y">
                {filteredSuppliers.map(s => (
                  <div key={s.id} className="flex items-center space-x-3 p-3 hover:bg-slate-50 transition-colors">
                  <Checkbox
                    id={s.id}
                    checked={selectedIds.has(s.id)}
                    onChange={() => toggleSelection(s.id)}
                  />

                    <label htmlFor={s.id} className="flex-1 cursor-pointer text-sm font-medium">
                      {s.name}
                      <span className="block text-xs text-slate-500 mt-0.5">Doc: {s.document}</span>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={selectedIds.size === 0}>
            Vincular Selecionados ({selectedIds.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
