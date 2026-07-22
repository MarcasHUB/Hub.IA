// ============================================================
// SupplyHub.IA — Edge Function: invite-operator
// ============================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const body = await req.json();
    const { email, nome, sobrenome, cargo, perfil, category_ids, invited_by_id, organization_id, todas_categorias } = body;

    if (!email || !nome || !perfil || !organization_id) {
      return new Response(
        JSON.stringify({ error: 'Os campos email, nome, perfil e organization_id são obrigatórios.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Gerar token seguro para rastreabilidade
    const token = crypto.randomUUID();

    const origin = req.headers.get('origin') || 'http://localhost:5173';
    const redirectUrl = `${origin}/aceitar-convite?token=${token}`;

    // 2. Verificar se o operador já existe nesta organização (ex: foi soft-deleted ou está inativo)
    const { data: existingOp } = await supabase
      .from('operators')
      .select('id')
      .eq('email', email)
      .eq('organization_id', organization_id)
      .maybeSingle();

    let userId = '';

    if (existingOp) {
      userId = existingOp.id;
      // Atualiza o operador existente para pendente e limpa o deleted_at
      const { error: updateOpError } = await supabase
        .from('operators')
        .update({
          nome,
          sobrenome,
          cargo,
          perfil,
          status: 'pendente',
          telefone: body.telefone || null,
          todas_categorias: todas_categorias || false,
          deleted_at: null,
          invited_at: new Date().toISOString(),
          gestor_id: invited_by_id || null
        })
        .eq('id', userId);
        
      if (updateOpError) throw updateOpError;
    } else {
      // Operador não existe nesta org. Tentar criar no Supabase Auth.
      const { data: inviteData, error: inviteError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: false,
        password: crypto.randomUUID(),
        user_metadata: {
          nome,
          sobrenome,
          cargo,
          perfil,
          organization_id,
          invite_token: token,
        }
      });

      if (inviteError) {
        // Se der "User already registered", o usuário existe no Auth mas não na org local.
        // Tenta buscar o ID dele caso ele exista em outra org.
        const { data: globalOp } = await supabase.from('operators').select('id').eq('email', email).limit(1).maybeSingle();
        if (globalOp) {
          userId = globalOp.id;
        } else {
          // Fallback: se não achar de jeito nenhum, repassa o erro do Auth.
          throw inviteError;
        }
      } else {
        userId = inviteData.user.id;
      }

      // 4. Criar o operador com status 'pendente' na tabela operators
      const { error: operatorRecordError } = await supabase
        .from('operators')
        .insert({
          id: userId,
          organization_id,
          nome,
          sobrenome,
          email,
          telefone: body.telefone || null,
          cargo,
          perfil,
          status: 'pendente',
          todas_categorias: todas_categorias || false,
          gestor_id: invited_by_id || null,
          invited_at: new Date().toISOString(),
        });

      if (operatorRecordError && !operatorRecordError.message.includes('duplicate key')) {
        throw operatorRecordError;
      }
    }

    // 3. Resolver category_ids (se o frontend enviar array de strings/nomes em vez de UUIDs)
    let resolvedCategoryIds = category_ids || [];
    if (resolvedCategoryIds.length > 0 && !resolvedCategoryIds[0].match(/^[0-9a-f]{8}-/i)) {
      const { data: foundCategories } = await supabase
        .from('categories')
        .select('id')
        .eq('tenant_id', organization_id)
        .in('name', resolvedCategoryIds);
      
      if (foundCategories) {
        resolvedCategoryIds = foundCategories.map((s: any) => s.id);
      } else {
        resolvedCategoryIds = [];
      }
    }

    // 4. Registrar o convite em operator_invitations para auditoria e controle
    const { error: inviteRecordError } = await supabase
      .from('operator_invitations')
      .insert({
        organization_id,
        invited_by_id: invited_by_id || null,
        email,
        nome: `${nome} ${sobrenome}`.trim(),
        cargo,
        perfil,
        token, // Rastreável
        status: 'pendente',
        todas_categorias: todas_categorias || false,
        category_ids: resolvedCategoryIds,
        sent_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(), // 72 horas
      });

    if (inviteRecordError) {
      throw inviteRecordError;
    }

    // 5. Vincular as categorias na tabela de junção se fornecidos
    if (resolvedCategoryIds && resolvedCategoryIds.length > 0) {
      const catRecords = resolvedCategoryIds.map((catId: string) => ({
        operator_id: userId,
        category_id: catId,
      }));
      await supabase.from('operator_categories').insert(catRecords);
    }

    // 6. Registrar log operacional do envio de convite
    await supabase.from('operation_logs').insert({
      operator_id: invited_by_id || null,
      organization_id,
      entidade: 'operator_invitation',
      acao: 'convidou',
      payload_depois: { email, nome, perfil, token }
    });

    // 7. Gerar sinal Hub.IA de convite pendente se desejado
    await supabase.from('hubia_signals').insert({
      organization_id,
      tipo_sinal: 'convite_pendente',
      descricao: `O convite para o operador ${nome} está pendente.`,
      dados: { email, token }
    });

    const expires_at = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Convite processado com sucesso.', 
        user: { id: userId, email },
        token,
        expires_at
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[invite-operator] Erro:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
