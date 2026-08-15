import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Key, Eye, EyeOff, CheckCircle2, AlertTriangle, ArrowRight, Globe } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Card, CardContent } from '@/shared/components/ui/Card';
import { SupabaseOperatorRepository } from '../../infrastructure/repositories/SupabaseOperatorRepository';
import { Invitation } from '../../domain/entities/Invitation';
import { extractInviteToken } from '@/shared/utils/inviteToken';

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [errorTitle, setErrorTitle] = useState('');

  const [activeToken, setActiveToken] = useState<string | null>(extractInviteToken(searchParams.get('token') || ''));
  const [manualInput, setManualInput] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const repo = new SupabaseOperatorRepository();

  useEffect(() => {
    async function validateToken() {
      if (!activeToken) {
        // Modo entrada manual
        return;
      }

      setLoading(true);
      setErrorMsg('');
      setErrorTitle('');
      
      try {
        const invite = await repo.getInvitationByToken(activeToken);
        if (!invite) {
          setErrorTitle('Convite inválido');
          setErrorMsg('O código ou link informado não foi encontrado ou é inválido.');
        } else if (invite.status === 'aceito') {
          setErrorTitle('Convite já utilizado');
          setErrorMsg('Este convite já foi aceito anteriormente. Você pode acessar sua conta pelo login.');
        } else if (invite.status === 'cancelado') {
          setErrorTitle('Convite cancelado');
          setErrorMsg('Este convite foi cancelado pelo administrador.');
        } else if (new Date(invite.expires_at) < new Date()) {
          setErrorTitle('Convite expirado');
          setErrorMsg('Solicite um novo convite ao administrador da empresa.');
        } else {
          setInvitation(invite);
        }
      } catch (err) {
        setErrorMsg('Erro de conexão ao validar o seu convite.');
      } finally {
        setLoading(false);
      }
    }

    validateToken();
  }, [activeToken]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const token = extractInviteToken(manualInput);
    if (token) {
      setActiveToken(token);
    } else {
      setErrorTitle('Código inválido');
      setErrorMsg('Não foi possível identificar o código do convite. Copie apenas o código informado no e-mail.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeToken || !invitation) return;

    if (password.length < 8) {
      setErrorMsg('A senha deve conter no mínimo 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('As senhas digitadas não são iguais.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await repo.acceptInvite({
        token: activeToken,
        password,
      });

      if (res.success) {
        setSuccess(true);
      } else {
        setErrorMsg(res.message || 'Erro ao ativar a conta. Tente novamente.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro de rede ao ativar sua conta.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-slate-400 text-sm font-semibold flex items-center gap-2">
          <Globe className="h-5 w-5 animate-spin text-indigo-400" />
          Validando convite no Hub.IA...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex items-baseline justify-center gap-1.5">
          <span className="text-3xl font-extrabold text-indigo-500 tracking-tight">Hub.IA</span>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">
            Suprimentos
          </span>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md p-4">
        <Card className="rounded-3xl border-slate-800 bg-slate-900 text-white shadow-2xl overflow-hidden">
          <CardContent className="p-8">
            {success ? (
              // Sucesso
              <div className="space-y-6 text-center animate-in fade-in duration-300">
                <div className="h-14 w-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-7 w-7 text-green-400" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold">Conta Ativada!</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Olá, <strong className="text-white">{invitation?.nome}</strong>. 
                    { (invitation?.cargo?.includes('[APP]')) ? (
                      <>
                        {' '}Seu perfil foi liberado para uso no APP.
                        <br/>
                        Você já pode acessar suas solicitações pelo celular.
                      </>
                    ) : (
                      <>
                        {' '}Seu perfil foi liberado para uso no Desktop.
                        <br/>
                        Para acessar todas as funcionalidades, utilize o navegador em um computador.
                      </>
                    )}
                  </p>
                </div>
                <Button
                  onClick={() => navigate('/login')}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 rounded-xl flex items-center justify-center gap-2 text-sm"
                >
                  Ir para o Login <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            ) : errorMsg && !invitation ? (
              // Erro de Token
              <div className="space-y-6 text-center animate-in fade-in duration-300">
                <div className="h-14 w-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
                  <AlertTriangle className="h-7 w-7 text-red-400" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold">{errorTitle || 'Erro no Convite'}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{errorMsg}</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => navigate('/login')}
                  className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 h-10 text-xs"
                >
                  Voltar ao Login
                </Button>
              </div>
            ) : !activeToken ? (
              // Formulário de Entrada Manual de Código
              <form onSubmit={handleManualSubmit} className="space-y-6 text-center animate-in fade-in duration-300">
                <div className="h-14 w-14 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto">
                  <Key className="h-7 w-7 text-indigo-400" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold">Aceitar Convite</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Cole o código do convite ou o link recebido por e-mail.
                  </p>
                </div>
                
                {errorMsg && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 text-left">
                    <strong className="block mb-1">{errorTitle}</strong>
                    {errorMsg}
                  </div>
                )}
                
                <div className="space-y-4">
                  <Input
                    type="text"
                    value={manualInput}
                    onChange={e => setManualInput(e.target.value)}
                    placeholder="Cole o código do convite"
                    className="h-12 bg-slate-950 border-slate-700 text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 w-full"
                    required
                  />
                  <Button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 rounded-xl"
                  >
                    Continuar
                  </Button>
                </div>
              </form>
            ) : (
              // Formulário de Definição de Senha
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-bold">Definir Senha</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Você foi convidado como operador perfil <strong className="text-indigo-400 uppercase tracking-wide">{invitation?.perfil}</strong>.
                    Defina sua credencial para acessar a rede.
                  </p>
                </div>

                {errorMsg && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-2 items-start text-xs text-red-400">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="space-y-4">
                  {/* Email somente leitura */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">E-mail</label>
                    <Input
                      type="text"
                      disabled
                      value={invitation?.email || ''}
                      className="h-10 text-sm bg-slate-800/50 border-slate-700 text-slate-400 cursor-not-allowed"
                    />
                  </div>

                  {/* Senha */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Nova Senha</label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Mínimo 8 caracteres"
                        className="h-10 text-sm bg-slate-800/30 border-slate-700 text-white pl-3 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirmar Senha */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Confirmar Senha</label>
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Repita a nova senha"
                      className="h-10 text-sm bg-slate-800/30 border-slate-700 text-white"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 rounded-xl flex items-center justify-center gap-2 text-sm transition-all"
                >
                  <Key className="h-4 w-4" />
                  {submitting ? 'Ativando...' : 'Ativar Conta de Operador'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
