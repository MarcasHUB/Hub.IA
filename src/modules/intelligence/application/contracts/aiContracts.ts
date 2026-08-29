/**
 * Versioned, non-authoritative contracts for future AI/n8n integrations.
 * Every mutation still belongs to authenticated application services and RLS.
 */
export type HubIaEventName =
  | 'MATERIAL_CREATED_OR_UPDATED'
  | 'PARTNER_DISCOVERY_REQUESTED'
  | 'QUOTATION_READY_FOR_ANALYSIS'
  | 'QUOTATION_AI_OVERRIDE'
  | 'SUPPORT_AI_REQUESTED'
  | 'COMPLIANCE_CONTEXT_ANALYSIS_REQUESTED';

export type HubIaEvent<TPayload extends Record<string, unknown>> = {
  eventId: string;
  eventName: HubIaEventName;
  schemaVersion: '1.0';
  occurredAt: string;
  organizationId: string;
  actorUserId: string;
  payload: TPayload;
};

export type MaterialIntelligenceSuggestion = {
  normalized_name: string;
  manufacturer: string | null;
  manufacturer_code: string | null;
  suggested_category_id: string | null;
  possible_duplicate_material_id: string | null;
  confidence: number;
  reasoning_summary: string;
  technical_attributes: Record<string, string | number | boolean | null>;
};

export type PartnerMatchSuggestion = {
  candidate_organization_id: string;
  compatibility_score: number;
  reasons: string[];
  matched_materials: string[];
  matched_segments: string[];
  coverage_match: boolean;
};

export type QuotationCopilotRecommendation = {
  recommended_supplier_id: string;
  recommended_supplier_quotation_id: string;
  score: number;
  ranking: Array<{ supplier_quotation_id: string; position: number; score: number }>;
  estimated_total_cost: number;
  reasons: string[];
  risk_flags: string[];
  model_version: string;
  policy_version: string;
};

export type ComplianceIntelligenceResult = {
  signals: Array<{ type: string; severity: 'low' | 'medium' | 'high'; summary: string }>;
  needs_human_review: boolean;
  confidence: number;
};

export type SupportIntelligenceResult = {
  answer: string;
  confidence: number;
  needs_human: boolean;
  suggested_ticket_category: string | null;
};
