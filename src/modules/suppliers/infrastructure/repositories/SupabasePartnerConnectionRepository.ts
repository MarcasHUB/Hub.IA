import { supabase } from '@/infrastructure/supabase/client';

export interface PartnerConnectionRow {
  connection_id: string;
  partner_organization_id: string;
  partner_name: string;
  partner_document: string | null;
  partner_segment: string | null;
  partner_city: string | null;
  partner_state: string | null;
  partner_email: string | null;
  partner_phone: string | null;
  partner_website: string | null;
  partner_commercial_profile: string | null;
  partner_company_type: string | null;
  partner_service_radius: number | null;
  connection_status: 'pending' | 'accepted';
  requester_approval_status: 'pending' | 'approved' | 'rejected' | 'not_required';
  direction: 'sent' | 'received';
  can_review_internal: boolean;
  can_respond: boolean;
  connected_at: string;
  message: string | null;
}

export class SupabasePartnerConnectionRepository {
  async list(): Promise<PartnerConnectionRow[]> {
    const { data, error } = await supabase.rpc('list_partner_connections');
    if (error) throw error;
    return (data || []) as PartnerConnectionRow[];
  }

  async request(targetOrganizationId: string, message?: string): Promise<string> {
    const { data, error } = await supabase.rpc('request_connection', {
      p_target_company_id: targetOrganizationId,
      p_message: message?.trim() || null,
    });
    if (error) throw error;
    return data as string;
  }

  async reviewInternal(requestId: string, approve: boolean, reason?: string): Promise<void> {
    const { error } = await supabase.rpc('review_internal_connection', {
      p_request_id: requestId,
      p_approve: approve,
      p_reason: reason?.trim() || null,
    });
    if (error) throw error;
  }

  async respond(requestId: string, accept: boolean, reason?: string): Promise<void> {
    const { error } = await supabase.rpc('respond_connection_request', {
      p_request_id: requestId,
      p_accept: accept,
      p_reason: reason?.trim() || null,
    });
    if (error) throw error;
  }

  async cancel(requestId: string): Promise<void> {
    const { error } = await supabase.rpc('cancel_connection_request', {
      p_request_id: requestId,
    });
    if (error) throw error;
  }

  async disconnect(requestId: string): Promise<void> {
    const { error } = await supabase.rpc('disconnect_partner', {
      p_request_id: requestId,
    });
    if (error) throw error;
  }
}
