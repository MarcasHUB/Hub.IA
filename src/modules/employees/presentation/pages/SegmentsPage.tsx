import { useState } from 'react';
import {
  Layers, Plus, Search, CheckCircle2, XCircle,
  Users, Edit2, ToggleLeft, ToggleRight
} from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Card, CardContent } from '@/shared/components/ui/Card';
import { Segment, SegmentStatus, DEFAULT_SEGMENTS } from '@/modules/employees/domain/entities/Segment';

// ─── Storage helpers ──────────────────────────────────────────────────────────
function loadSegments(): Segment[] {
  try {
    const raw = localStorage.getItem('supplyhub_segments_v2');
    if (raw) return JSON.parse(raw);
  } catch {}
  // Seed padrão
  return DEFAULT_SEGMENTS.map((nome, i) => ({
    id: `seg-${i + 1}`,
    organization_id: '00000000-0000-0000-0000-000000000000',
    nome,
    descricao: '',
    status: 'ativo' as SegmentStatus,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    operadores_count: 0,
  }));
}

function saveSegments(segs: Segment[]) {
  localStorage.setItem('supplyhub_segments_v2', JSON.stringify(segs));
}

// ─── Modal de Segmento ────────────────────────────────────────────────────────
function SegmentModal({
  seg, onClose, onSave,
}: {
  seg?: Segment;
  onClose: () => void;
  onSave: (s: Segment) => void;
}) {
  const [nome, setNome] = useState(seg?.nome || '');
  const [descricao, setDescricao] = useState(seg?.descricao || '');

  const handleSave = () => {
    if (!nome.trim()) return;
    const now = new Date().toISOString();
    onSave({
      id: seg?.id || `seg-${Date.now()}`,
      organization_id: '00000000-0000-0000-0000-000000000000',
      nome: nome.trim(),
      descricao: descricao.trim(),
      status: seg?.status || 'ativo',
      created_at: seg?.created_at || now,
      updated_at: now,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <h3 className="text-base font-extrabold text-slate-900">
            {seg ? 'Editar Segmento' : 'Novo Segmento'}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-full">
            <XCircle className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Nome *</label>
            <Input
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: EPI, Motores, Rolamentos..."
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Descrição</label>
            <textarea
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Descreva o escopo deste segmento..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
            <p className="text-[10px] font-bold text-indigo-700 flex items-center gap-1.5">
              <Layers className="h-3 w-3" />
              Segmentos são a base para filtros de acesso, matching de fornecedores e alertas da Hub.IA.
            </p>
          </div>
        </div>

        <div className="flex gap-3 justify-end px-6 pb-6">
          <Button variant="outline" onClick={onClose} className="h-9 text-xs">Cancelar</Button>
          <Button
            onClick={handleSave}
            disabled={!nome.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 text-xs font-bold flex items-center gap-2"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> {seg ? 'Salvar' : 'Criar Segmento'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── SegmentsPage ─────────────────────────────────────────────────────────────
export default function SegmentsPage() {
  const [segments, setSegments] = useState<Segment[]>(loadSegments);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ open: boolean; seg?: Segment }>({ open: false });

  const filtered = segments.filter(s =>
    s.nome.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = (s: Segment) => {
    const updated = modal.seg
      ? segments.map(x => x.id === s.id ? s : x)
      : [...segments, s];
    setSegments(updated);
    saveSegments(updated);
    setModal({ open: false });
  };

  const toggleStatus = (id: string) => {
    const updated = segments.map(s =>
      s.id === id
        ? { ...s, status: (s.status === 'ativo' ? 'inativo' : 'ativo') as SegmentStatus, updated_at: new Date().toISOString() }
        : s
    );
    setSegments(updated);
    saveSegments(updated);
  };

  const ativos = segments.filter(s => s.status === 'ativo').length;
  const inativos = segments.filter(s => s.status === 'inativo').length;

  return (
    <div className="flex-1 bg-slate-50 min-h-full flex flex-col font-sans">
      {modal.open && (
        <SegmentModal
          seg={modal.seg}
          onClose={() => setModal({ open: false })}
          onSave={handleSave}
        />
      )}

      {/* HEADER BANNER */}
      <div className="bg-slate-900 rounded-2xl mx-6 mt-6 mb-6 px-8 pt-8 pb-8 shadow-md">
        <div className="max-w-[1600px] mx-auto space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                <Layers className="h-7 w-7 text-indigo-400" />
                Segmentos
              </h1>
              <p className="text-slate-400 mt-1 text-sm max-w-2xl">
                Base de categorização para produtos, fornecedores, operadores e inteligência Hub.IA.
              </p>
            </div>
            <Button
              onClick={() => setModal({ open: true })}
              className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-5 text-sm font-bold flex items-center gap-2 shrink-0"
            >
              <Plus className="h-4 w-4" /> Novo Segmento
            </Button>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total', value: segments.length, color: 'text-white' },
              { label: 'Ativos', value: ativos, color: 'text-green-400' },
              { label: 'Inativos', value: inativos, color: 'text-slate-400' },
            ].map(item => (
              <div key={item.label} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.label}</p>
                <p className={`text-2xl font-extrabold mt-0.5 ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Busca */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Buscar segmento..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 h-10 rounded-xl focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* GRID DE SEGMENTOS */}
      <div className="px-6 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(seg => (
            <Card
              key={seg.id}
              className={`rounded-2xl border shadow-sm transition-all duration-150 ${
                seg.status === 'ativo'
                  ? 'border-slate-200 hover:border-indigo-200 hover:shadow-md'
                  : 'border-slate-100 opacity-60'
              }`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <Layers className="h-5 w-5 text-indigo-600" />
                  </div>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                    seg.status === 'ativo'
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>
                    {seg.status === 'ativo' ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-sm mb-1">{seg.nome}</h3>
                {seg.descricao && (
                  <p className="text-xs text-slate-500 mb-3 leading-relaxed line-clamp-2">{seg.descricao}</p>
                )}

                <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-4">
                  <Users className="h-3 w-3" />
                  <span>{seg.operadores_count || 0} operador{(seg.operadores_count || 0) !== 1 ? 'es' : ''}</span>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setModal({ open: true, seg })}
                    className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 py-1.5 rounded-lg transition-colors"
                  >
                    <Edit2 className="h-3 w-3" /> Editar
                  </button>
                  <button
                    onClick={() => toggleStatus(seg.id)}
                    className={`flex-1 flex items-center justify-center gap-1 text-[10px] font-bold py-1.5 rounded-lg transition-colors ${
                      seg.status === 'ativo'
                        ? 'text-slate-500 hover:text-red-600 hover:bg-red-50'
                        : 'text-slate-500 hover:text-green-600 hover:bg-green-50'
                    }`}
                  >
                    {seg.status === 'ativo'
                      ? <><ToggleLeft className="h-3 w-3" /> Inativar</>
                      : <><ToggleRight className="h-3 w-3" /> Ativar</>
                    }
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Card de novo segmento */}
          <button
            onClick={() => setModal({ open: true })}
            className="rounded-2xl border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all duration-150 p-5 flex flex-col items-center justify-center gap-2 min-h-[160px] group"
          >
            <div className="h-10 w-10 rounded-xl bg-slate-100 group-hover:bg-indigo-100 transition-colors flex items-center justify-center">
              <Plus className="h-5 w-5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
            </div>
            <span className="text-xs font-bold text-slate-500 group-hover:text-indigo-700 transition-colors">
              Novo Segmento
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
