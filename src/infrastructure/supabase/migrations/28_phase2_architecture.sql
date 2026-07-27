-- Migration 28: Phase 2 Architecture (Organizations, Certifications, Catalog, Partners)

-- 1. Alter organizations table
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS inscricao_estadual VARCHAR(50),
  ADD COLUMN IF NOT EXISTS inscricao_municipal VARCHAR(50),
  ADD COLUMN IF NOT EXISTS situacao_cadastral VARCHAR(50),
  ADD COLUMN IF NOT EXISTS data_abertura DATE,
  ADD COLUMN IF NOT EXISTS natureza_juridica VARCHAR(255),
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 8),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(11, 8),
  ADD COLUMN IF NOT EXISTS tipo_empresa VARCHAR(50),
  ADD COLUMN IF NOT EXISTS perfil_comercial VARCHAR(50),
  ADD COLUMN IF NOT EXISTS status_empresa VARCHAR(50) DEFAULT 'Ativa',
  ADD COLUMN IF NOT EXISTS tipo_cobertura VARCHAR(50),
  ADD COLUMN IF NOT EXISTS raio_atendimento_km INTEGER,
  ADD COLUMN IF NOT EXISTS recebe_oportunidades BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS nivel_interesse VARCHAR(50),
  ADD COLUMN IF NOT EXISTS ultima_sincronizacao_receita TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cnae_principal VARCHAR(50),
  ADD COLUMN IF NOT EXISTS atividade_principal TEXT,
  ADD COLUMN IF NOT EXISTS nivel_confianca_cadastro INTEGER DEFAULT 25;

-- 2. Tabela EMPRESA_CNAES
CREATE TABLE IF NOT EXISTS public.empresa_cnaes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    cnae_code VARCHAR(50) NOT NULL,
    description TEXT,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela global CERTIFICATIONS
CREATE TABLE IF NOT EXISTS public.certifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed certifications
INSERT INTO public.certifications (name) VALUES 
('ISO 9001'), ('ISO 14001'), ('ISO 45001'), ('SASSMAQ'), ('FSC'), ('PEFC'), ('ANVISA'), ('IBAMA')
ON CONFLICT (name) DO NOTHING;

-- 4. Tabela EMPRESA_CERTIFICACOES
CREATE TABLE IF NOT EXISTS public.empresa_certificacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    certification_id UUID NOT NULL REFERENCES public.certifications(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, certification_id)
);

-- 5. Tabela EMPRESA_ESTADOS_ATENDIDOS
CREATE TABLE IF NOT EXISTS public.empresa_estados_atendidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    state_code VARCHAR(2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, state_code)
);

-- 6. Tabela ORGANIZATION_SEGMENTS
CREATE TABLE IF NOT EXISTS public.organization_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    segment_id UUID NOT NULL REFERENCES public.segments(id) ON DELETE CASCADE,
    origem VARCHAR(50) DEFAULT 'usuario', -- usuario, hub_ia, cnae
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, segment_id)
);

-- 7. Tabela EMPRESA_CATALOGO (Fase 2 - Meu Catálogo)
CREATE TABLE IF NOT EXISTS public.empresa_catalogo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    material_id UUID REFERENCES public.materials(id) ON DELETE SET NULL,
    internal_code VARCHAR(100),
    brand VARCHAR(255),
    manufacturer VARCHAR(255),
    description TEXT,
    image_url TEXT,
    status VARCHAR(50) DEFAULT 'ativo', -- ativo, inativo, pendente_curadoria
    material_type VARCHAR(50) DEFAULT 'fornecido', -- fornecido, comprado, ambos
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Tabela EMPRESA_PARCEIROS (Fase 2 - Meus Parceiros)
CREATE TABLE IF NOT EXISTS public.empresa_parceiros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    partner_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) NOT NULL, -- Fornecedor, Cliente, Parceiro Comercial, Parceiro Logistico
    status VARCHAR(50) DEFAULT 'Novo', -- Novo, Conectado, Ativo, Inativo, Bloqueado
    origem_relacionamento VARCHAR(50) DEFAULT 'manual', -- convite, hub_ia, marketplace, cotacao, manual
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, partner_id, relationship_type)
);

-- ENABLE RLS
ALTER TABLE public.empresa_cnaes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_certificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_estados_atendidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_parceiros ENABLE ROW LEVEL SECURITY;

-- POLICIES
CREATE POLICY "empresa_cnaes_org_all" ON public.empresa_cnaes FOR ALL USING (organization_id = current_org_id());
CREATE POLICY "empresa_cnaes_read_all" ON public.empresa_cnaes FOR SELECT USING (true);

CREATE POLICY "certifications_read_all" ON public.certifications FOR SELECT USING (true);

CREATE POLICY "empresa_certificacoes_org_all" ON public.empresa_certificacoes FOR ALL USING (organization_id = current_org_id());
CREATE POLICY "empresa_certificacoes_read_all" ON public.empresa_certificacoes FOR SELECT USING (true);

CREATE POLICY "empresa_estados_atendidos_org_all" ON public.empresa_estados_atendidos FOR ALL USING (organization_id = current_org_id());
CREATE POLICY "empresa_estados_atendidos_read_all" ON public.empresa_estados_atendidos FOR SELECT USING (true);

CREATE POLICY "organization_segments_org_all" ON public.organization_segments FOR ALL USING (organization_id = current_org_id());
CREATE POLICY "organization_segments_read_all" ON public.organization_segments FOR SELECT USING (true);

CREATE POLICY "empresa_catalogo_org_all" ON public.empresa_catalogo FOR ALL USING (organization_id = current_org_id());
CREATE POLICY "empresa_catalogo_read_all" ON public.empresa_catalogo FOR SELECT USING (true);

CREATE POLICY "empresa_parceiros_org_all" ON public.empresa_parceiros FOR ALL USING (organization_id = current_org_id() OR partner_id = current_org_id());
CREATE POLICY "empresa_parceiros_read_all" ON public.empresa_parceiros FOR SELECT USING (true);

-- GRANTS FOR API
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresa_cnaes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.certifications TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresa_certificacoes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresa_estados_atendidos TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_segments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresa_catalogo TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresa_parceiros TO anon, authenticated;
