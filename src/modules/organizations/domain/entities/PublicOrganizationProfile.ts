export interface PublicOrganizationSegment {
  id: string;
  name: string;
}

export interface PublicOrganizationCertification {
  id: string;
  name: string;
}

export interface PublicOrganizationProduct {
  id: string;
  name: string;
  imageUrl?: string | null;
}

export interface PublicOrganizationProfile {
  id: string;
  legalName: string;
  tradeName: string;
  document: string; // CNPJ
  
  logoPath: string | null;
  logoUrl: string | null;
  
  city: string | null;
  state: string | null;
  website: string | null;
  businessEmail: string | null;
  phone: string | null;
  
  companyType: string | null;
  commercialProfile: string | null;
  companySize: string | null;
  
  geographicCoverageType: string | null;
  serviceRadiusKm: number | null;
  servedStates: string[];
  
  segments: PublicOrganizationSegment[];
  certifications: PublicOrganizationCertification[];
  productsAndServices: PublicOrganizationProduct[];
  
  profileCompletion: number;
  status: string;
}
