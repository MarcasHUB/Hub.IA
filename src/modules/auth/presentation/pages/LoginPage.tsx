import React from 'react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Label } from '@/shared/components/ui/Label';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SupabaseLogRepository } from '@/modules/employees/infrastructure/repositories/SupabaseLogRepository';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reason = searchParams.get('reason');

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState('');

  const logRepo = new SupabaseLogRepository();

  React.useEffect(() => {
    if (reason === 'session_terminated') {
      setErrorMsg('Sua sessão foi encerrada porque esta conta foi conectada em outro dispositivo.');
    }
  }, [reason]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    
    const ua = navigator.userAgent;
    let orgId = localStorage.getItem('supplyhub_organization_id');
    if (!orgId || orgId === 'org-1') {
      orgId = '00000000-0000-0000-0000-000000000000';
      localStorage.setItem('supplyhub_organization_id', orgId);
    }

    try {
      const { supabase } = await import('@/infrastructure/supabase/client');
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Registrar tentativa falha
        await logRepo.logAccess({
          organization_id: orgId,
          tipo: 'tentativa_falha',
          resultado: 'falha',
          ip: '127.0.0.1',
          user_agent: ua,
        });

        // Contabilizar falhas consecutivas localmente
        const currentFailures = Number(localStorage.getItem(`login_failures_${email}`) || 0) + 1;
        localStorage.setItem(`login_failures_${email}`, String(currentFailures));

        if (currentFailures >= 5) {
          // Gerar Sinal Hub.IA
          const signalsRaw = localStorage.getItem('supplyhub_signals_v2') || '[]';
          const signals = JSON.parse(signalsRaw);
          signals.push({
            id: `sig-${Date.now()}`,
            organization_id: orgId,
            tipo_sinal: 'oportunidade_saving', // Tipo mapeado no banco
            descricao: `Alerta: Excesso de tentativas de login falhas detectadas para o e-mail: ${email}.`,
            dados: { email, tentativas: currentFailures, tipo: 'excesso_tentativas_login' },
            lido: false,
            created_at: new Date().toISOString(),
          });
          localStorage.setItem('supplyhub_signals_v2', JSON.stringify(signals));
        }

        throw error;
      }
      
      if (data.user) {
        // Resetar contador de falhas
        localStorage.removeItem(`login_failures_${email}`);

        // Resolvendo o organization_id real do operador
        let realOrgId: string | null = null;
        try {
          const { data: opData } = await supabase
            .from('operators')
            .select('organization_id')
            .eq('email', data.user.email)
            .single();
          if (opData?.organization_id) realOrgId = opData.organization_id;
        } catch {}

        if (!realOrgId) {
          try {
            const { data: roleData } = await supabase
              .from('user_roles')
              .select('organization_id')
              .eq('user_id', data.user.id)
              .single();
            if (roleData?.organization_id) realOrgId = roleData.organization_id;
          } catch {}
        }

        if (!realOrgId) {
          try {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('organization_id')
              .eq('user_id', data.user.id)
              .single();
            if (profileData?.organization_id) realOrgId = profileData.organization_id;
          } catch {}
        }

        if (!realOrgId) {
          try {
            const { data: allOrgs } = await supabase
              .from('organizations')
              .select('id')
              .limit(1);
            if (allOrgs && allOrgs.length > 0) realOrgId = allOrgs[0].id;
          } catch {}
        }

        // Usar o UUID real da organização principal "SupplyHub.IA" como último fallback de contingência
        const finalOrgId = realOrgId || '68a2f0b2-80f7-4868-bbb9-30b531c12db2';
        localStorage.setItem('supplyhub_organization_id', finalOrgId);

        const operatorId = data.user.id;

        // Provisionamento automático do Operador se ele não existir
        try {
          const { data: checkOp } = await supabase
            .from('operators')
            .select('id')
            .eq('id', operatorId)
            .maybeSingle();

          if (!checkOp) {
            // Criar na tabela operators
            const { error: insertError } = await supabase.from('operators').insert({
              id: operatorId,
              organization_id: finalOrgId,
              nome: data.user.user_metadata?.nome || 'Gestor',
              sobrenome: data.user.user_metadata?.sobrenome || 'Central',
              email: data.user.email,
              perfil: 'administrador',
              status: 'ativo',
              invited_at: new Date().toISOString(),
              accepted_at: new Date().toISOString(),
            });

            if (insertError) {
              console.error('Erro ao inserir operador no auto-provisionamento:', insertError);
            } else {
              // Registrar log operacional de criação automática
              await supabase.from('operation_logs').insert({
                operator_id: operatorId,
                organization_id: finalOrgId,
                entidade: 'operator',
                acao: 'auto_provisionado',
                payload_depois: {
                  id: operatorId,
                  email: data.user.email,
                  perfil: 'administrador',
                  status: 'ativo'
                }
              });
            }
          }
        } catch (opProvisionError) {
          console.error('Erro ao auto-provisionar operador:', opProvisionError);
        }

        // Registrar login com sucesso
        await logRepo.logAccess({
          operator_id: operatorId,
          organization_id: finalOrgId,
          tipo: 'login',
          resultado: 'sucesso',
          ip: '127.0.0.1',
          user_agent: ua,
        });

        // ─── Controle de Sessão Única ───
        const newSessionToken = crypto.randomUUID();
        localStorage.setItem('supplyhub_session_token', newSessionToken);

        // Terminar sessões anteriores na persistência local
        const rawSessions = localStorage.getItem('supplyhub_sessions_v2') || '[]';
        let sessionsList = JSON.parse(rawSessions);
        
        const activeBefore = sessionsList.filter((s: any) => s.operator_id === operatorId && s.status === 'ativa');
        
        if (activeBefore.length > 0) {
          // Registrar log de encerramento por nova conexão
          await logRepo.logAccess({
            operator_id: operatorId,
            organization_id: finalOrgId,
            tipo: 'bloqueio',
            resultado: 'falha',
            ip: '127.0.0.1',
            user_agent: ua,
          });
        }

        sessionsList = sessionsList.map((s: any) => {
          if (s.operator_id === operatorId && s.status === 'ativa') {
            return { ...s, status: 'encerrada', ended_at: new Date().toISOString() };
          }
          return s;
        });

        // Adicionar nova sessão
        sessionsList.push({
          id: `ses-${Date.now()}`,
          operator_id: operatorId,
          token_hash: newSessionToken,
          status: 'ativa',
          started_at: new Date().toISOString(),
        });
        localStorage.setItem('supplyhub_sessions_v2', JSON.stringify(sessionsList));

        // Salvar operador logado
        localStorage.setItem('supplyhub_logged_operator', JSON.stringify({
          id: operatorId,
          email: data.user.email,
          nome: data.user.user_metadata?.nome || 'Operador',
          sobrenome: data.user.user_metadata?.sobrenome || '',
          perfil: data.user.user_metadata?.perfil || 'comprador',
        }));

        navigate('/dashboard');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao realizar login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">SupplyHub</h1>
        <p className="mt-2 text-sm text-slate-500">Entre com suas credenciais para acessar a plataforma.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {errorMsg && (
          <div className="p-3 text-sm font-medium text-red-800 bg-red-100 rounded-md">
            {errorMsg}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">E-mail Corporativo</Label>
          <Input 
            id="email" 
            type="email" 
            placeholder="voce@empresa.com" 
            required 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Senha</Label>
            <a href="#" className="text-sm font-medium text-slate-900 hover:underline">
              Esqueceu a senha?
            </a>
          </div>
          <Input 
            id="password" 
            type="password" 
            required 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar no Sistema'}
        </Button>
      </form>
    </div>
  );
}