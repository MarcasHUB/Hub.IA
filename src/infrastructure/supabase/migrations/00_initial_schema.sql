-- SUPPLYHUB - SPRINT 5 INITIAL SCHEMA

-- 1. ENUMS
CREATE TYPE user_role AS ENUM ('admin', 'buyer', 'manager', 'supplier');
CREATE TYPE product_status AS ENUM ('Draft', 'Active', 'Inactive');
CREATE TYPE quotation_status AS ENUM ('Draft', 'Open', 'Closed', 'Cancelled');
CREATE TYPE supplier_quotation_status AS ENUM ('Pending', 'Sent', 'Rejected');

-- 2. ORGANIZATIONS (TENANTS)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    document VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. USERS
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'buyer',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SUPPLIERS
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    document VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CATEGORIES
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. PRODUCTS
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sku VARCHAR(100) NOT NULL,
    uom VARCHAR(20) NOT NULL,
    manufacturer VARCHAR(150),
    price DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    status product_status DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. QUOTATION REQUESTS
CREATE TABLE quotation_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status quotation_status DEFAULT 'Draft',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. QUOTATION ITEMS
CREATE TABLE quotation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES quotation_requests(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity DECIMAL(15,3) NOT NULL,
    uom VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. SUPPLIER QUOTATIONS (BIDS)
CREATE TABLE supplier_quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES quotation_requests(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    price DECIMAL(15,2) NOT NULL,
    delivery_days INT NOT NULL,
    comments TEXT,
    status supplier_quotation_status DEFAULT 'Pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ROW LEVEL SECURITY (RLS)

-- FunÃ§Ã£o para obter o tenant_id do usuÃ¡rio logado
CREATE OR REPLACE FUNCTION get_auth_tenant_id() RETURNS UUID AS $$
    SELECT organization_id FROM users WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Ativar RLS em todas as tabelas tenant-bound
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_quotations ENABLE ROW LEVEL SECURITY;

-- Criar PolÃ­ticas (Policies) isolando os dados por Tenant
CREATE POLICY tenant_isolation_policy_suppliers ON suppliers USING (tenant_id = get_auth_tenant_id());
CREATE POLICY tenant_isolation_policy_categories ON categories USING (tenant_id = get_auth_tenant_id());
CREATE POLICY tenant_isolation_policy_products ON products USING (tenant_id = get_auth_tenant_id());
CREATE POLICY tenant_isolation_policy_quotations ON quotation_requests USING (tenant_id = get_auth_tenant_id());
-- quotation_items e supplier_quotations herdam a seguranÃ§a atravÃ©s da junÃ§Ã£o indireta com o pedido de cotaÃ§Ã£o ou simplesmente verificando o parent.
-- Por seguranÃ§a profunda:
CREATE POLICY tenant_isolation_policy_items ON quotation_items USING (
    quotation_id IN (SELECT id FROM quotation_requests WHERE tenant_id = get_auth_tenant_id())
);
CREATE POLICY tenant_isolation_policy_bids ON supplier_quotations USING (
    quotation_id IN (SELECT id FROM quotation_requests WHERE tenant_id = get_auth_tenant_id())
);