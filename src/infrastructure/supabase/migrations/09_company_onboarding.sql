-- ==========================================
-- Migration 09: Company Onboarding & Master Isolation
-- ==========================================

-- 1. Tabela INVITATIONS (Expansão para convites de empresas)
ALTER TABLE invitations 
    ADD COLUMN IF NOT EXISTS city VARCHAR(255),
    ADD COLUMN IF NOT EXISTS state VARCHAR(50),
    ADD COLUMN IF NOT EXISTS segments TEXT[] DEFAULT '{}';

-- 2. Tabela ORGANIZATIONS (Perfil completo do tenant)
ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS trade_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS logo_url TEXT,
    ADD COLUMN IF NOT EXISTS website TEXT,
    ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
    ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(50),
    ADD COLUMN IF NOT EXISTS commercial_contact VARCHAR(255),
    ADD COLUMN IF NOT EXISTS commercial_email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS address TEXT,
    ADD COLUMN IF NOT EXISTS city VARCHAR(255),
    ADD COLUMN IF NOT EXISTS state VARCHAR(50),
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS company_role VARCHAR(50), -- buyer, seller, both
    ADD COLUMN IF NOT EXISTS operation_radius VARCHAR(50), -- 100km, 250km, 500km, national
    ADD COLUMN IF NOT EXISTS company_types TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS profile_completion INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS segments TEXT[] DEFAULT '{}';

-- 3. Tabela USERS (Identificação explícita do Super Admin)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN DEFAULT FALSE;

-- Notify postgrest to reload schema cache
NOTIFY pgrst, 'reload schema';
