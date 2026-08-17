import { supabase } from '@/infrastructure/supabase/client';

export interface ComplianceEvent {
  id: string;
  organization_id: string;
  conversation_id: string;
  message_id: string | null;
  sender_user_id: string;
  sender_organization_id: string;
  recipient_organization_id: string;
  event_type: 'attachment_flagged' | 'upload_cancelled';
  risk_level: 'low' | 'medium' | 'high';
  risk_score: number;
  detection_source: string;
  file_name: string | null;
  mime_type: string | null;
  user_warned: boolean;
  user_confirmed: boolean;
  was_cancelled: boolean;
  is_blocked: boolean;
  reasons: any;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  sender_name?: string;
  recipient_name?: string;
  sender_user?: { full_name?: string; email?: string };
  recipient_organization?: { name?: string; id?: string };
}

export class SupabaseComplianceRepository {
  async getEvents(orgId: string): Promise<ComplianceEvent[]> {
    const { data, error } = await supabase
      .rpc('get_my_compliance_events');

    if (error) {
      throw error;
    }

    return data as ComplianceEvent[];
  }

  async markAsReviewed(eventId: string): Promise<void> {
    const { error } = await supabase
      .rpc('review_compliance_event', { p_event_id: eventId });
      
    // For now we don't have the RPC, so if we can't do it via RPC we fail.
    // The instructions say "Criar posteriormente RPC específica como: review_compliance_event".
    if (error) throw error;
  }
}

export const complianceRepository = new SupabaseComplianceRepository();
