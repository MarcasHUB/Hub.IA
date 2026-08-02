-- DRAFT TÉCNICO: MIGRATION DO MÓDULO DE CONTRATOS (FASE 4)
-- AVISO: ESTE ARQUIVO É UM ESBOÇO (DRAFT) E NÃO ESTÁ AUTORIZADO PARA EXECUÇÃO.

-- 1. Criação de Enums e Tipos
DO $$ BEGIN
    CREATE TYPE contract_status AS ENUM ('draft', 'pending_approval', 'active', 'suspended', 'expired', 'canceled', 'closed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Tabela de Cabeçalho (contracts)
CREATE TABLE IF NOT EXISTS public.contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL, -- Organização compradora
    supplier_id UUID, -- Fornecedor local sombra (shadow)
    supplier_organization_id UUID, -- Fornecedor conectado (tenant real)
    contract_number TEXT NOT NULL,
    title TEXT NOT NULL,
    status contract_status NOT NULL DEFAULT 'draft',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    currency_code TEXT NOT NULL DEFAULT 'BRL',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    
    -- Constraint: exige ao menos uma identificação de fornecedor
    CONSTRAINT chk_contracts_supplier CHECK (
        supplier_id IS NOT NULL OR supplier_organization_id IS NOT NULL
    ),
    -- Constraint: Unicidade do número do contrato dentro da organização
    CONSTRAINT uq_contracts_org_number UNIQUE (organization_id, contract_number),
    -- Datas
    CONSTRAINT chk_contracts_dates CHECK (start_date <= end_date),
    
    -- FKs (Algumas a validar em ambiente se user_id -> auth.users ou profiles)
    CONSTRAINT fk_contracts_org FOREIGN KEY (organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE,
    CONSTRAINT fk_contracts_supplier_org FOREIGN KEY (supplier_organization_id) REFERENCES public.organizations (id) ON DELETE RESTRICT
    -- TODO: Verificar a FK correta para supplier_id (se suppliers possui id uuid e é ON DELETE SET NULL)
);

-- 3. Tabela de Itens (contract_items)
CREATE TABLE IF NOT EXISTS public.contract_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL,
    organization_id UUID NOT NULL, -- Desnormalizado para simplificar RLS e relatórios
    material_id UUID NOT NULL, -- V1 restrita a Materiais (escopo confirmado)
    product_id UUID, -- Reflete o SKU privado da compradora
    unit TEXT NOT NULL,
    price NUMERIC(15, 4) NOT NULL,
    currency_code TEXT NOT NULL DEFAULT 'BRL',
    contracted_quantity NUMERIC(15, 4),
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    
    CONSTRAINT fk_contract_items_contract FOREIGN KEY (contract_id) REFERENCES public.contracts (id) ON DELETE CASCADE,
    CONSTRAINT fk_contract_items_org FOREIGN KEY (organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE,
    CONSTRAINT fk_contract_items_material FOREIGN KEY (material_id) REFERENCES public.materials (id) ON DELETE RESTRICT,
    CONSTRAINT fk_contract_items_product FOREIGN KEY (product_id) REFERENCES public.products (id) ON DELETE SET NULL,
    
    CONSTRAINT chk_ci_price CHECK (price >= 0),
    CONSTRAINT chk_ci_dates CHECK (start_date <= end_date)
);

-- 4. Índices
CREATE INDEX IF NOT EXISTS idx_contracts_org_supplier ON public.contracts (organization_id, supplier_organization_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status_dates ON public.contracts (status, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_contract_items_material ON public.contract_items (material_id);

-- 5. RLS (Row Level Security) - Esboço
-- TODO: Necessita a função real is_platform_admin() confirmada.
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comprador ve seus contratos" ON public.contracts
    FOR SELECT USING (organization_id = public.current_org_id());

CREATE POLICY "Fornecedor ve contratos conectados ativos" ON public.contracts
    FOR SELECT USING (
        supplier_organization_id = public.current_org_id() 
        AND status IN ('active', 'expired', 'closed')
    );
