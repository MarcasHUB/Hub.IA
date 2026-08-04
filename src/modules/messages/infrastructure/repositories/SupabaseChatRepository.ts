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
    const partnerOrgId = orgIdB; // O frontend chama getOrCreateConversation(activeOrgId, partnerId)
    
    console.log('CHAT_CONVERSATION_LOOKUP_RPC', {
      currentOrganizationId: orgIdA,
      partnerOrganizationId: orgIdB,
    });

    const { data: convId, error: rpcError } = await supabase
      .rpc('get_or_create_partner_conversation', {
        p_partner_organization_id: partnerOrgId
      });

    console.log('CHAT_CONVERSATION_RPC_RESULT', { data: convId, error: rpcError });

    if (rpcError) {
      console.error('Error creating/fetching conversation via RPC', rpcError);
      throw rpcError;
    }

    return convId;
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
    console.log('CHAT_MESSAGE_INSERT_RPC', {
      conversationId,
      senderId: senderUserId,
      senderOrganizationId: senderOrgId,
      contentLength: content?.length,
    });

    const { data: msgId, error: rpcError } = await supabase
      .rpc('send_partner_message', {
        p_conversation_id: conversationId,
        p_content: content
      });

    console.log('CHAT_MESSAGE_RPC_RESULT', { data: msgId, error: rpcError });

    if (rpcError) {
      console.error('Error sending message via RPC', rpcError);
      throw rpcError;
    }
    
    // As the RPC returns a UUID, we mock a ChatMessage structure to not break the frontend that expects the created object back.
    // In a real app we might want the RPC to return the full record, or fetch it.
    return {
      id: msgId,
      conversation_id: conversationId,
      sender_id: senderUserId,
      sender_organization_id: senderOrgId,
      content: content,
      created_at: new Date().toISOString()
    };
  }

  async uploadAttachment(conversationId: string, senderOrgId: string, file: File, senderUserId?: string): Promise<ChatMessage> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${conversationId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('messages')
      .upload(fileName, file);

    if (uploadError) {
      console.error('Error uploading attachment', uploadError);
      throw uploadError;
    }

    const { data: publicUrlData } = supabase.storage
      .from('messages')
      .getPublicUrl(fileName);

    const attachmentUrl = publicUrlData.publicUrl;
    const content = `📁 Anexo: [${file.name}](${attachmentUrl})`;

    return this.sendMessage(conversationId, senderOrgId, content, senderUserId);
  }
}

export const chatRepository = new SupabaseChatRepository();
