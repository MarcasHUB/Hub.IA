import React, { useState, useEffect } from 'react';
import { supabase } from '@/infrastructure/supabase/client';
import { Button } from '@/shared/components/ui/Button';
import { UserRound, Mail, Phone, Briefcase, Building, AlertCircle } from 'lucide-react';
import { AppLayout } from '@/kernel/layouts/AppLayout';

export function MyProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        setEmail(user.email || '');
        
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();
          
        if (error) throw error;
        
        if (data) {
          setFullName(data.full_name || '');
          setDisplayName(data.display_name || '');
          setPhone(data.phone || '');
          setJobTitle(data.job_title || '');
          setDepartment(data.department || '');
          setAvatarUrl(data.avatar_url || '');
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    loadProfile();
  }, []);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploadingAvatar(true);
      setError('');
      
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('Você deve selecionar uma imagem.');
      }
      
      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const allowedExts = ['jpg', 'jpeg', 'png', 'webp'];
      
      if (!allowedExts.includes(fileExt?.toLowerCase() || '')) {
         throw new Error('Formato inválido. Use JPG, PNG ou WEBP.');
      }

      if (file.size > 2 * 1024 * 1024) {
         throw new Error('A imagem deve ter no máximo 2MB.');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) {
         throw uploadError;
      }
      
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setAvatarUrl(publicUrl);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          display_name: displayName,
          phone,
          job_title: jobTitle,
          department,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (error) throw error;

      setSuccess(true);
      
      // Update local storage for immediate header update
      if (avatarUrl) localStorage.setItem('supplyhub_user_avatar', avatarUrl);
      else localStorage.removeItem('supplyhub_user_avatar');
      
      // Force reload layout or window to show updated name (simple approach)
      setTimeout(() => window.location.reload(), 1000);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 bg-slate-50 min-h-full">
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <UserRound className="h-6 w-6 text-indigo-600" />
            Meus Dados
          </h1>
          <p className="text-slate-500 mt-1">Gerencie suas informações pessoais e preferências.</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6">
            
            {error && (
              <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-lg flex items-start gap-3 border border-red-100">
                <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}
            
            {success && (
              <div className="mb-6 bg-emerald-50 text-emerald-700 p-4 rounded-lg flex items-start gap-3 border border-emerald-100">
                <div className="h-5 w-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                  <div className="h-2 w-2 rounded-full bg-emerald-600" />
                </div>
                <p className="text-sm font-medium">Dados atualizados com sucesso!</p>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : (
              <form onSubmit={handleSave} className="space-y-6">
                
                {/* Avatar */}
                <div className="flex items-center gap-6 pb-6 border-b border-slate-100">
                  <div 
                    className="relative cursor-pointer group rounded-full overflow-hidden" 
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-20 h-20 rounded-full object-cover border border-slate-200" />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                        <UserRound className="h-10 w-10 text-slate-400" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-white text-xs font-bold">Alterar</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Foto de Perfil (Avatar)</label>
                    <input 
                      type="file" 
                      accept="image/png, image/jpeg, image/jpg, image/webp"
                      className="hidden" 
                      ref={fileInputRef}
                      onChange={handleAvatarUpload}
                      disabled={uploadingAvatar}
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="text-xs h-8"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                    >
                      {uploadingAvatar ? 'Enviando...' : 'Selecionar Nova Foto'}
                    </Button>
                    <p className="text-xs text-slate-500 mt-2">Formatos: JPG, PNG, WEBP. Máximo: 2MB.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Nome Completo */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo *</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <UserRound className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full h-10 pl-10 pr-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                        placeholder="Seu nome completo"
                      />
                    </div>
                  </div>

                  {/* Nome de Exibição */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nome de Exibição</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <UserRound className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full h-10 pl-10 pr-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                        placeholder="Como prefere ser chamado?"
                      />
                    </div>
                  </div>

                  {/* E-mail (Somente leitura) */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        type="email"
                        value={email}
                        readOnly
                        disabled
                        className="w-full h-10 pl-10 pr-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed"
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">O e-mail só pode ser alterado via segurança da conta.</p>
                  </div>

                  {/* Telefone */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Telefone / Celular</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Phone className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full h-10 pl-10 pr-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                  </div>

                  {/* Cargo */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Cargo (Profissão)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Briefcase className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        type="text"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        className="w-full h-10 pl-10 pr-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                        placeholder="Ex: Gerente de Compras"
                      />
                    </div>
                  </div>

                  {/* Departamento */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Departamento</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Building className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        type="text"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="w-full h-10 pl-10 pr-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                        placeholder="Ex: Suprimentos"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 flex justify-end">
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Salvando...' : 'Salvar Alterações'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
