-- ==========================================
-- Migration 13: Solicitações Internas (Mobile & Web)
-- ==========================================

-- 1. Enum para Prioridades
DO $$ BEGIN
    CREATE TYPE internal_request_priority AS ENUM ('baixa', 'normal', 'alta', 'urgente', 'emergencial');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Enum para Status da Solicitação Interna
DO $$ BEGIN
    CREATE TYPE internal_request_status AS ENUM ('pendente', 'em_aprovacao', 'aprovada', 'rejeitada', 'em_cotacao', 'pedido_emitido', 'entregue', 'cancelada');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Tabela Principal: Solicitações Internas
CREATE TABLE IF NOT EXISTS internal_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Snapshot do solicitante (histórico)
    requested_by_name VARCHAR(255) NOT NULL,
    
    -- Metadados da solicitação
    priority internal_request_priority DEFAULT 'normal',
    status internal_request_status DEFAULT 'pendente',
    expected_date DATE,
    department VARCHAR(255),
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE internal_requests ENABLE ROW LEVEL SECURITY;

-- Drop policies to avoid errors on rerun
DROP POLICY IF EXISTS "internal_requests_select" ON internal_requests;
DROP POLICY IF EXISTS "internal_requests_insert" ON internal_requests;
DROP POLICY IF EXISTS "internal_requests_update" ON internal_requests;

-- Policy: Acesso restrito ao Solicitante, Gestor e Comprador
CREATE POLICY "internal_requests_select" ON internal_requests
    FOR SELECT TO authenticated
    USING (
        organization_id = (SELECT organization_id FROM operators WHERE operators.id = auth.uid())
    );

CREATE POLICY "internal_requests_insert" ON internal_requests
    FOR INSERT TO authenticated
    WITH CHECK (
        organization_id = (SELECT organization_id FROM operators WHERE operators.id = auth.uid()) AND
        requester_id = auth.uid()
    );

CREATE POLICY "internal_requests_update" ON internal_requests
    FOR UPDATE TO authenticated
    USING (
        organization_id = (SELECT organization_id FROM operators WHERE operators.id = auth.uid())
    );

-- 4. Tabela Filha: Itens da Solicitação Interna
CREATE TABLE IF NOT EXISTS internal_request_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    request_id UUID NOT NULL REFERENCES internal_requests(id) ON DELETE CASCADE,
    
    -- Categoria é opcional pois o usuário pode não saber exatamente qual é
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    
    description VARCHAR(255) NOT NULL,
    quantity DECIMAL(15,3) NOT NULL,
    uom VARCHAR(20) NOT NULL,
    
    -- Pode apontar para um produto homologado caso já saiba (opcional)
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE internal_request_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "internal_request_items_select" ON internal_request_items;
DROP POLICY IF EXISTS "internal_request_items_insert" ON internal_request_items;
DROP POLICY IF EXISTS "internal_request_items_update" ON internal_request_items;
DROP POLICY IF EXISTS "internal_request_items_delete" ON internal_request_items;

CREATE POLICY "internal_request_items_select" ON internal_request_items
    FOR SELECT TO authenticated
    USING (
        request_id IN (
            SELECT id FROM internal_requests 
            WHERE organization_id = (SELECT organization_id FROM operators WHERE operators.id = auth.uid())
        )
    );

CREATE POLICY "internal_request_items_insert" ON internal_request_items
    FOR INSERT TO authenticated
    WITH CHECK (
        request_id IN (
            SELECT id FROM internal_requests 
            WHERE organization_id = (SELECT organization_id FROM operators WHERE operators.id = auth.uid())
        )
    );
    
CREATE POLICY "internal_request_items_update" ON internal_request_items
    FOR UPDATE TO authenticated
    USING (
        request_id IN (
            SELECT id FROM internal_requests 
            WHERE organization_id = (SELECT organization_id FROM operators WHERE operators.id = auth.uid())
        )
    );

CREATE POLICY "internal_request_items_delete" ON internal_request_items
    FOR DELETE TO authenticated
    USING (
        request_id IN (
            SELECT id FROM internal_requests 
            WHERE organization_id = (SELECT organization_id FROM operators WHERE operators.id = auth.uid())
        )
    );

-- 5. Tabela Filha: Histórico/Mensagens da Solicitação
CREATE TABLE IF NOT EXISTS internal_request_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    request_id UUID NOT NULL REFERENCES internal_requests(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    message TEXT NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE internal_request_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "internal_request_messages_select" ON internal_request_messages;
DROP POLICY IF EXISTS "internal_request_messages_insert" ON internal_request_messages;

CREATE POLICY "internal_request_messages_select" ON internal_request_messages
    FOR SELECT TO authenticated
    USING (
        request_id IN (
            SELECT id FROM internal_requests 
            WHERE organization_id = (SELECT organization_id FROM operators WHERE operators.id = auth.uid())
        )
    );

CREATE POLICY "internal_request_messages_insert" ON internal_request_messages
    FOR INSERT TO authenticated
    WITH CHECK (
        sender_id = auth.uid() AND
        request_id IN (
            SELECT id FROM internal_requests 
            WHERE organization_id = (SELECT organization_id FROM operators WHERE operators.id = auth.uid())
        )
    );
