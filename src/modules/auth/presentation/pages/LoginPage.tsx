import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Label } from '@/shared/components/ui/Label';
import { supabase } from '@/infrastructure/supabase/client';
import { usePrivateSession } from '../context/PrivateSessionBoundary';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Erro ao realizar login';
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const { transitionTo } = usePrivateSession();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    const reason = searchParams.get('reason');
    if (reason === 'session_terminated') {
      setErrorMsg('Sua sessão foi encerrada. Entre novamente para continuar.');
    } else if (reason === 'tenant_inactive') {
      setErrorMsg('Sua empresa foi inativada. Entre em contato com o suporte da Hub.IA.');
    } else if (reason === 'identity_inconsistent') {
      setErrorMsg('Não foi possível confirmar sua identidade e empresa. Entre em contato com o suporte.');
    }
  }, [searchParams]);

  const clearLegacyIdentityCache = () => {
    localStorage.removeItem('supplyhub_company_name');
    localStorage.removeItem('supplyhub_company_logo');
    localStorage.removeItem('supplyhub_organization_id');
    localStorage.removeItem('supplyhub_logged_operator');
    localStorage.removeItem('supplyhub_session_token');
    localStorage.removeItem('supplyhub_sessions_v2');
    localStorage.removeItem('supplyhub_user_avatar');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setErrorMsg('');
    clearLegacyIdentityCache();

    try {
      await transitionTo(null);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw error;
      if (!data.user) throw new Error('AUTH_SESSION_INVALID');

      await transitionTo(data.user.id);
      navigate('/dashboard');
    } catch (error) {
      await supabase.auth.signOut({ scope: 'local' });
      await transitionTo(null);
      clearLegacyIdentityCache();
      setErrorMsg(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const resendConfirmation = async () => {
    if (!email || cooldown > 0) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: `${window.location.origin}/login` },
      });
      if (error) throw error;
      setCooldown(60);
      window.alert('E-mail de confirmação reenviado com sucesso.');
    } catch (error) {
      setCooldown(60);
      window.alert(`Erro ao reenviar: ${errorMessage(error)}`);
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
            {errorMsg.toLowerCase().includes('email not confirmed') && (
              <button
                type="button"
                disabled={loading || cooldown > 0}
                onClick={resendConfirmation}
                className="block mt-2 font-bold underline hover:text-red-900 disabled:opacity-50"
              >
                {cooldown > 0 ? `Reenviar novamente em ${cooldown}s` : 'Reenviar e-mail de confirmação'}
              </button>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">E-mail Corporativo</Label>
          <Input id="email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Senha</Label>
            <a href="#" className="text-sm font-medium text-slate-900 hover:underline">Esqueceu a senha?</a>
          </div>
          <Input id="password" type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar no Sistema'}
        </Button>
      </form>
    </div>
  );
}
