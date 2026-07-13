-- ==========================================
-- FASE 1A: RELACIONAMENTO PRODUTO X FORNECEDOR
-- ==========================================

-- 1. Criação da Tabela Many-to-Many
CREATE TABLE product_suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- A Chave Tenant mestre confirmada pela auditoria
    organization_id UUID NOT NULL 
        REFERENCES organizations(id) ON DELETE CASCADE,
        
    product_id UUID NOT NULL 
        REFERENCES products(id) ON DELETE CASCADE,
        
    supplier_id UUID NOT NULL 
        REFERENCES suppliers(id) ON DELETE CASCADE,
        
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Previne que um mesmo fornecedor seja vinculado duas vezes ao mesmo produto
    UNIQUE(product_id, supplier_id) 
);

-- Habilitar RLS
ALTER TABLE product_suppliers ENABLE ROW LEVEL SECURITY;

-- Policy isolando a visão da tabela à organização atual do usuário
CREATE POLICY "product_suppliers_org_all" ON product_suppliers
    FOR ALL
    USING (organization_id = current_org_id())
    WITH CHECK (organization_id = current_org_id());


-- ==========================================
-- FASE 1B: REDE DE PARCEIROS E CONVITES
-- ==========================================

-- 1. Criação da Tabela de Convites
CREATE TABLE invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- A Chave Tenant mestre confirmada pela auditoria
    organization_id UUID NOT NULL 
        REFERENCES organizations(id) ON DELETE CASCADE,
        
    name VARCHAR(255) NOT NULL,
    company VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    document VARCHAR(50) NOT NULL, -- CNPJ/CPF do convidado
    status VARCHAR(50) DEFAULT 'Pending',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Policy isolando a visão da tabela à organização atual do usuário
CREATE POLICY "invitations_org_all" ON invitations
    FOR ALL
    USING (organization_id = current_org_id())
    WITH CHECK (organization_id = current_org_id());
