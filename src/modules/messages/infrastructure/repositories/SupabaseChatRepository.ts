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
  metadata?: any;
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

  async sendMessage(conversationId: string, senderOrgId: string, content: string, senderUserId?: string, metadata?: any): Promise<ChatMessage> {
    console.log('CHAT_MESSAGE_INSERT_RPC', {
      conversationId,
      senderId: senderUserId,
      senderOrganizationId: senderOrgId,
      contentLength: content?.length,
      hasMetadata: !!metadata
    });

    const { data: msgId, error: rpcError } = await supabase
      .rpc('send_partner_message', {
        p_conversation_id: conversationId,
        p_content: content,
        p_metadata: metadata || null
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
      metadata: metadata,
      created_at: new Date().toISOString()
    };
  }

  async uploadAttachment(conversationId: string, senderOrgId: string, file: File, senderUserId?: string, complianceData?: any): Promise<ChatMessage> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${conversationId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('messages')
      .upload(fileName, file);

    if (uploadError) {
      console.error('Error uploading attachment', uploadError);
      throw uploadError;
    }

    const metadata: any = {
      type: 'attachment',
      version: 1,
      attachment: {
        name: file.name,
        path: fileName,
        mimeType: file.type || 'application/octet-stream',
        size: file.size
      }
    };

    if (complianceData) {
      metadata.compliance = complianceData;
    }

    const content = ``; // The RPC accepts an empty string if it's an attachment. We will use an empty string.

    return this.sendMessage(conversationId, senderOrgId, content, senderUserId, metadata);
  }

  async registerUploadCancellation(conversationId: string, file: File, complianceData: any): Promise<void> {
    const { error } = await supabase.rpc('register_compliance_cancelled_event', {
      p_conversation_id: conversationId,
      p_file_name: file.name,
      p_mime_type: file.type || 'application/octet-stream',
      p_risk_score: complianceData.riskScore,
      p_risk_level: complianceData.riskLevel,
      p_reasons: complianceData.reasons || []
    });
    if (error) {
      console.error('Failed to register cancellation event', error);
    }
  }
  async listConversationsForCurrentOrganization(activeOrgId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        id,
        organization_a_id,
        organization_b_id,
        updated_at,
        created_at,
        org_a:organizations!organization_a_id(id, razao_social, nome_fantasia),
        org_b:organizations!organization_b_id(id, razao_social, nome_fantasia),
        messages (
          id,
          content,
          created_at,
          read_at,
          metadata,
          sender_organization_id
        )
      `)
      .or(`organization_a_id.eq.${activeOrgId},organization_b_id.eq.${activeOrgId}`);

    if (error) {
      console.error('Error fetching conversations', error);
      throw error;
    }

    if (!data) return [];

    const list = data.map((conv: any) => {
      const isA = conv.organization_a_id === activeOrgId;
      const partnerId = isA ? conv.organization_b_id : conv.organization_a_id;

      const rawPartner = isA ? conv.org_b : conv.org_a;
      const partnerObj = Array.isArray(rawPartner) ? rawPartner[0] : rawPartner;
      const partnerName = partnerObj?.razao_social || partnerObj?.nome_fantasia || 'Empresa Parceira';

      const msgs = conv.messages || [];
      msgs.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const lastMsg = msgs.length > 0 ? msgs[0] : null;
      const unreadCount = msgs.filter((m: any) => m.sender_organization_id !== activeOrgId && !m.read_at).length;

      return {
        conversationId: conv.id,
        partnerOrganizationId: partnerId,
        partnerName: partnerName,
        partnerInitials: partnerName.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase(),
        lastMessage: lastMsg ? lastMsg.content : null,
        lastMessageAt: lastMsg ? lastMsg.created_at : conv.updated_at,
        lastMessageSenderOrganizationId: lastMsg ? lastMsg.sender_organization_id : null,
        unreadCount: unreadCount
      };
    });

    list.sort((a, b) => {
      const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return timeB - timeA;
    });

    return list;
  }

  async markAsRead(conversationId: string, currentOrgId: string): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .neq('sender_organization_id', currentOrgId)
      .is('read_at', null);

    if (error) {
      console.error('Error marking messages as read', error);
      throw error;
    }
  }
}

export const chatRepository = new SupabaseChatRepository();
