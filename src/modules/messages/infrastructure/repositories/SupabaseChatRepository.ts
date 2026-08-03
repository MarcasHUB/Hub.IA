import { supabase } from '../../../../infrastructure/supabase/client';

export interface ChatConversation {
  id: string;
  organization_a_id: string;
  organization_b_id: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id?: string;
  sender_organization_id: string;
  content: string;
  created_at: string;
  read_at?: string;
}

export class SupabaseChatRepository {
  async getOrCreateConversation(orgIdA: string, orgIdB: string): Promise<string> {
    // Tenta encontrar uma conversa existente entre as duas orgs
    const { data: convs, error: fetchError } = await supabase
      .from('conversations')
      .select('id')
      .or(`and(organization_a_id.eq.${orgIdA},organization_b_id.eq.${orgIdB}),and(organization_a_id.eq.${orgIdB},organization_b_id.eq.${orgIdA})`)
      .limit(1);

    if (fetchError) {
      console.error('Error fetching conversation', fetchError);
      throw fetchError;
    }

    if (convs && convs.length > 0) {
      return convs[0].id;
    }

    // Se não existir, cria uma nova
    const { data: newConv, error: insertError } = await supabase
      .from('conversations')
      .insert({
        organization_a_id: orgIdA,
        organization_b_id: orgIdB
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Error creating conversation', insertError);
      throw insertError;
    }

    return newConv.id;
  }

  async getMessages(conversationId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages', error);
      throw error;
    }
    return data || [];
  }

  async sendMessage(conversationId: string, senderOrgId: string, content: string, senderUserId?: string): Promise<ChatMessage> {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_organization_id: senderOrgId,
        sender_id: senderUserId,
        content: content
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error sending message', error);
      throw error;
    }
    
    return data;
  }
}

export const chatRepository = new SupabaseChatRepository();
