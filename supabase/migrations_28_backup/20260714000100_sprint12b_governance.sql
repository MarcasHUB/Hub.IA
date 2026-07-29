-- ============================================================
-- Sprint 12B — Governança Inteligente de Operadores
-- Migração: 20260714_001_sprint12b_governance.sql
-- ============================================================

-- ─── Extensão para UUID v4 (já deve estar ativa, garantindo) ──
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── ENUM TYPES ───────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE operator_perfil AS ENUM ('administrador', 'gestor', 'comprador', 'consulta');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE operator_status AS ENUM ('pendente', 'ativo', 'inativo', 'bloqueado', 'ferias', 'substituido');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE invitation_status AS ENUM ('pendente', 'aceito', 'expirado', 'cancelado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE delegation_status AS ENUM ('ativa', 'encerrada', 'cancelada');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE session_status AS ENUM ('ativa', 'encerrada', 'expirada');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE access_log_tipo AS ENUM ('login', 'logout', 'tentativa_falha', 'bloqueio');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE hubia_signal_tipo AS ENUM (
    'oportunidade_saving',
    'novo_fornecedor',
    'cobertura_insuficiente',
    'operador_inativo',
    'convite_pendente',
    'tendencia_mercado',
    'segmento_sem_responsavel'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─── AMPLIAR ORGANIZATIONS ────────────────────────────────────
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS razao_social       text,
  ADD COLUMN IF NOT EXISTS nome_fantasia      text,
  ADD COLUMN IF NOT EXISTS cnpj               text,
  ADD COLUMN IF NOT EXISTS email_corporativo  text,
  ADD COLUMN IF NOT EXISTS telefone           text,
  ADD COLUMN IF NOT EXISTS gestor_principal_id uuid;

-- ─── OPERATORS ────────────────────────────────────────────────
-- NOTA: invite_token e invite_expires_at NÃO estão aqui.
-- A única fonte de verdade de convites é operator_invitations.
CREATE TABLE IF NOT EXISTS operators (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  nome              text        NOT NULL,
  sobrenome         text        NOT NULL DEFAULT '',
  email             text        NOT NULL,
  telefone          text,
  cargo             text,
  perfil            operator_perfil NOT NULL DEFAULT 'comprador',
  status            operator_status NOT NULL DEFAULT 'pendente',
  gestor_id         uuid        REFERENCES operators(id) ON DELETE SET NULL,
  invited_at        timestamptz,
  accepted_at       timestamptz,
  last_login_at     timestamptz,
  last_activity_at  timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz,
  UNIQUE(organization_id, email)
);

-- ─── SEGMENTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS segments (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  nome            text    NOT NULL,
  descricao       text,
  status          text    NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  responsavel_id  uuid    REFERENCES operators(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

-- ─── OPERATOR_SEGMENTS (N:N) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS operator_segments (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id     uuid    NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  segment_id      uuid    NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
  todos_segmentos boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(operator_id, segment_id)
);

-- ─── OPERATOR_INVITATIONS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS operator_invitations (
  id              uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid               NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invited_by_id   uuid               REFERENCES operators(id) ON DELETE SET NULL,
  email           text               NOT NULL,
  nome            text               NOT NULL,
  cargo           text,
  perfil          operator_perfil    NOT NULL DEFAULT 'comprador',
  token           text               NOT NULL UNIQUE, -- hash SHA-256
  status          invitation_status  NOT NULL DEFAULT 'pendente',
  segment_ids     uuid[]             DEFAULT '{}',
  sent_at         timestamptz        NOT NULL DEFAULT now(),
  expires_at      timestamptz        NOT NULL DEFAULT (now() + interval '72 hours'),
  accepted_at     timestamptz,
  ip_aceite       text,
  user_agent_aceite text
);

-- ─── DELEGATIONS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delegations (
  id                      uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         uuid              NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  operador_origem_id      uuid              NOT NULL REFERENCES operators(id),
  operador_substituto_id  uuid              NOT NULL REFERENCES operators(id),
  data_inicio             date              NOT NULL,
  data_fim                date              NOT NULL,
  motivo                  text,
  status                  delegation_status NOT NULL DEFAULT 'ativa',
  segmentos_espelhados    boolean           NOT NULL DEFAULT true,
  permissoes_espelhadas   boolean           NOT NULL DEFAULT false,
  created_at              timestamptz       NOT NULL DEFAULT now()
);

-- ─── OPERATOR_SESSIONS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS operator_sessions (
  id            uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id   uuid           NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  token_hash    text           NOT NULL, -- nunca o token cru
  ip            text,
  user_agent    text,
  status        session_status NOT NULL DEFAULT 'ativa',
  started_at    timestamptz    NOT NULL DEFAULT now(),
  last_seen_at  timestamptz    NOT NULL DEFAULT now(),
  ended_at      timestamptz
);

-- ─── ACCESS_LOGS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS access_logs (
  id              uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id     uuid             REFERENCES operators(id) ON DELETE SET NULL,
  organization_id uuid             NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tipo            access_log_tipo  NOT NULL,
  ip              text,
  user_agent      text,
  resultado       text             CHECK (resultado IN ('sucesso', 'falha')),
  created_at      timestamptz      NOT NULL DEFAULT now()
);

-- ─── OPERATION_LOGS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS operation_logs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id     uuid        REFERENCES operators(id) ON DELETE SET NULL,
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entidade        text        NOT NULL,
  acao            text        NOT NULL,
  payload_antes   jsonb,
  payload_depois  jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── HUBIA_SIGNALS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hubia_signals (
  id              uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid              NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  operator_id     uuid              REFERENCES operators(id) ON DELETE SET NULL,
  segment_id      uuid              REFERENCES segments(id) ON DELETE SET NULL,
  tipo_sinal      hubia_signal_tipo NOT NULL,
  descricao       text              NOT NULL,
  dados           jsonb             DEFAULT '{}',
  lido            boolean           NOT NULL DEFAULT false,
  created_at      timestamptz       NOT NULL DEFAULT now()
);

-- ─── SEGMENT_ID em PRODUCTS (obrigatório) ─────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS segment_id uuid REFERENCES segments(id) ON DELETE SET NULL;

-- Nota: Após popular segment_id nos registros existentes,
-- adicionar NOT NULL constraint com: ALTER TABLE products ALTER COLUMN segment_id SET NOT NULL;

-- ─── SUPPLIER_SEGMENTS (N:N fornecedor x segmento) ────────────
CREATE TABLE IF NOT EXISTS supplier_segments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  segment_id  uuid NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(supplier_id, segment_id)
);

-- ─── ÍNDICES DE PERFORMANCE ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_operators_org         ON operators(organization_id);
CREATE INDEX IF NOT EXISTS idx_operators_status      ON operators(status);
CREATE INDEX IF NOT EXISTS idx_segments_org          ON segments(organization_id);
CREATE INDEX IF NOT EXISTS idx_operator_segments_op  ON operator_segments(operator_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token     ON operator_invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email     ON operator_invitations(email);
CREATE INDEX IF NOT EXISTS idx_sessions_operator     ON operator_sessions(operator_id, status);
CREATE INDEX IF NOT EXISTS idx_hubia_signals_org     ON hubia_signals(organization_id, lido);
CREATE INDEX IF NOT EXISTS idx_access_logs_op        ON access_logs(operator_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_op     ON operation_logs(operator_id);

-- ─── RLS (Row Level Security) ─────────────────────────────────
ALTER TABLE operators           ENABLE ROW LEVEL SECURITY;
ALTER TABLE segments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_segments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE delegations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE hubia_signals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_segments   ENABLE ROW LEVEL SECURITY;

-- Políticas básicas de leitura isolada por tenant (via user_roles)
-- Nota: As políticas de escrita devem ser adicionadas conforme o perfil do operador.

CREATE POLICY operators_org_read ON operators
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY segments_org_read ON segments
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY hubia_signals_org_read ON hubia_signals
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
    )
  );
