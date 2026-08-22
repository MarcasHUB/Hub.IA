import type { PublicOrganizationProfile } from '@/modules/organizations/domain/entities/PublicOrganizationProfile';
import {
  buildPartnerCardPresentation,
  cleanPartnerValue,
  type PartnerCardPresentation,
  type PartnerCardSource,
} from './partnerCardPresentation.ts';

export interface PartnerRelationshipEvent {
  label: string;
  date: string;
}

export interface Partner360Presentation extends PartnerCardPresentation {
  description: string | null;
  companySize: string | null;
  geographicCoverageType: string | null;
  servedStates: string[];
  relationshipEvents: PartnerRelationshipEvent[];
  canViewEnrichedData: boolean;
}

export function buildPartner360Presentation(
  partner: PartnerCardSource,
  profile?: PublicOrganizationProfile | null,
): Partner360Presentation {
  const base = buildPartnerCardPresentation(partner, profile);
  const canViewEnrichedData = base.isActivePartner;

  return {
    ...base,
    description: canViewEnrichedData ? cleanPartnerValue(profile?.description) : null,
    companySize: canViewEnrichedData ? cleanPartnerValue(profile?.companySize) : null,
    geographicCoverageType: canViewEnrichedData
      ? cleanPartnerValue(profile?.geographicCoverageType)
      : null,
    servedStates: canViewEnrichedData
      ? (profile?.servedStates || []).filter((state) => Boolean(cleanPartnerValue(state)))
      : [],
    relationshipEvents: canViewEnrichedData && base.since
      ? [{ label: 'Parceria iniciada', date: base.since }]
      : [],
    canViewEnrichedData,
  };
}
