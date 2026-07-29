-- ============================================================
-- SUPPLYHUB - SPRINT 6: REDE DE EMPRESAS + NOTIFICAÇÕES
-- Migration: 01_network_and_notifications.sql
-- ============================================================

-- ============================================================
-- 1. ENUMS adicionais
-- ============================================================
CREATE TYPE connection_status AS ENUM ('pending', 'accepted', 'rejected', 'canceled');
CREATE TYPE notification_type AS ENUM (
  'connection_request_received',
  'connection_request_accepted',
  'quotation_received',        -- fornecedor recebeu cotação para responder
  'quotation_responded',       -- comprador recebeu proposta de preço
  'quotation_rejected',
  'sla_overdue',
  'price_anomaly',
  'sourcing_suggestion'
);

-- ============================================================
-- 2. COMPANIES (Rede Hub.IA - diretório público de empresas)
-- ============================================================
CREATE TABLE companies (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(255) NOT NULL,
  document       VARCHAR(50)  NOT NULL UNIQUE,
  trade_name     VARCHAR(255),
  segment        VARCHAR(100),
  city           VARCHAR(100),
  state          VARCHAR(2),
  logo_url       TEXT,
  description    TEXT,
  website        TEXT,
  -- Empresa dona (vinculada a uma organização da plataforma)
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. CONNECTION_REQUESTS (vínculos entre empresas na rede)
-- ============================================================
CREATE TABLE connection_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- quem enviou o convite
  requester_org_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- quem recebeu
  target_org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status         connection_status DEFAULT 'pending',
  message        TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (requester_org_id, target_org_id)
);

-- ============================================================
-- 4. NOTIFICATIONS (Central de Notificações)
-- ============================================================
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- usuário destinatário
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        notification_type NOT NULL,
  title       VARCHAR(255) NOT NULL,
  message     TEXT,
  is_read     BOOLEAN DEFAULT FALSE,
  -- URL de ação do card (ex: /quotations/1, /suppliers/network)
  action_url  TEXT,
  -- metadados adicionais em JSON (ex: { quotation_id, supplier_name })
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. RLS (Row Level Security)
-- ============================================================
ALTER TABLE companies           ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       ENABLE ROW LEVEL SECURITY;

-- Companies: qualquer usuário autenticado pode ver (diretório público)
CREATE POLICY companies_select ON companies
  FOR SELECT TO authenticated USING (true);

CREATE POLICY companies_insert ON companies
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_tenant_id());

CREATE POLICY companies_update ON companies
  FOR UPDATE TO authenticated
  USING (organization_id = get_auth_tenant_id());

-- Connection Requests: usuário vê apenas onde é parte
CREATE POLICY connections_select ON connection_requests
  FOR SELECT TO authenticated
  USING (
    requester_org_id = get_auth_tenant_id()
    OR target_org_id = get_auth_tenant_id()
  );

CREATE POLICY connections_insert ON connection_requests
  FOR INSERT TO authenticated
  WITH CHECK (requester_org_id = get_auth_tenant_id());

CREATE POLICY connections_update ON connection_requests
  FOR UPDATE TO authenticated
  USING (
    requester_org_id = get_auth_tenant_id()
    OR target_org_id = get_auth_tenant_id()
  );

-- Notifications: usuário vê apenas as suas
CREATE POLICY notifications_select ON notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY notifications_update ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- 6. FUNÇÕES AUXILIARES
-- ============================================================

-- Retorna o user_id do usuário logado com base no auth.uid()
CREATE OR REPLACE FUNCTION get_auth_user_id() RETURNS UUID AS $$
  SELECT auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Busca todos os usuários de uma organização (para notificar múltiplos)
CREATE OR REPLACE FUNCTION get_org_user_ids(p_org_id UUID)
RETURNS TABLE(user_id UUID) AS $$
  SELECT u.id FROM users u WHERE u.organization_id = p_org_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================
-- 7. TRIGGERS AUTOMÁTICOS DE NOTIFICAÇÃO
-- ============================================================

-- 7a. Notificar quando um convite de conexão for CRIADO
CREATE OR REPLACE FUNCTION fn_notify_connection_request()
RETURNS TRIGGER AS $$
DECLARE
  target_user RECORD;
  requester_name VARCHAR;
BEGIN
  -- Nome da empresa que enviou o convite
  SELECT name INTO requester_name
  FROM organizations WHERE id = NEW.requester_org_id;

  -- Notificar todos os usuários da org alvo
  FOR target_user IN (SELECT user_id FROM get_org_user_ids(NEW.target_org_id)) LOOP
    INSERT INTO notifications (user_id, type, title, message, action_url, metadata)
    VALUES (
      target_user.user_id,
      'connection_request_received',
      'Novo convite de parceria recebido',
      requester_name || ' enviou um convite para se conectar à sua rede de empresas.',
      '/suppliers/network',
      jsonb_build_object('connection_id', NEW.id, 'requester_org_id', NEW.requester_org_id, 'requester_name', requester_name)
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_connection_request
AFTER INSERT ON connection_requests
FOR EACH ROW EXECUTE FUNCTION fn_notify_connection_request();

-- 7b. Notificar quando um convite for ACEITO
CREATE OR REPLACE FUNCTION fn_notify_connection_accepted()
RETURNS TRIGGER AS $$
DECLARE
  req_user RECORD;
  target_name VARCHAR;
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- Nome da empresa que aceitou
    SELECT name INTO target_name
    FROM organizations WHERE id = NEW.target_org_id;

    -- Notificar quem enviou o convite
    FOR req_user IN (SELECT user_id FROM get_org_user_ids(NEW.requester_org_id)) LOOP
      INSERT INTO notifications (user_id, type, title, message, action_url, metadata)
      VALUES (
        req_user.user_id,
        'connection_request_accepted',
        'Convite de parceria aceito!',
        target_name || ' aceitou seu convite. Agora vocês são parceiros na Rede de Empresas.',
        '/suppliers',
        jsonb_build_object('connection_id', NEW.id, 'partner_name', target_name)
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_connection_accepted
AFTER UPDATE ON connection_requests
FOR EACH ROW EXECUTE FUNCTION fn_notify_connection_accepted();

-- 7c. Notificar fornecedor quando RECEBER uma cotação para responder
CREATE OR REPLACE FUNCTION fn_notify_quotation_received()
RETURNS TRIGGER AS $$
DECLARE
  supplier_user RECORD;
  quotation_title VARCHAR;
  supplier_org_id UUID;
BEGIN
  -- Título da cotação
  SELECT title INTO quotation_title
  FROM quotation_requests WHERE id = NEW.quotation_id;

  -- Org do fornecedor (via tabela suppliers)
  SELECT tenant_id INTO supplier_org_id
  FROM suppliers WHERE id = NEW.supplier_id;

  IF supplier_org_id IS NOT NULL THEN
    FOR supplier_user IN (SELECT user_id FROM get_org_user_ids(supplier_org_id)) LOOP
      INSERT INTO notifications (user_id, type, title, message, action_url, metadata)
      VALUES (
        supplier_user.user_id,
        'quotation_received',
        'Nova cotação para responder',
        'Você recebeu uma solicitação de cotação: ' || quotation_title || '. Acesse para enviar sua proposta.',
        '/quotations/received',
        jsonb_build_object('quotation_id', NEW.quotation_id, 'supplier_quotation_id', NEW.id, 'title', quotation_title)
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_quotation_received
AFTER INSERT ON supplier_quotations
FOR EACH ROW EXECUTE FUNCTION fn_notify_quotation_received();

-- 7d. Notificar comprador quando uma proposta for RESPONDIDA
CREATE OR REPLACE FUNCTION fn_notify_quotation_responded()
RETURNS TRIGGER AS $$
DECLARE
  buyer_user RECORD;
  quotation_title VARCHAR;
  buyer_org_id UUID;
  supplier_name VARCHAR;
BEGIN
  IF NEW.status = 'Sent' AND OLD.status = 'Pending' THEN
    SELECT qr.title, qr.tenant_id, s.name
      INTO quotation_title, buyer_org_id, supplier_name
    FROM quotation_requests qr
    JOIN suppliers s ON s.id = NEW.supplier_id
    WHERE qr.id = NEW.quotation_id;

    FOR buyer_user IN (SELECT user_id FROM get_org_user_ids(buyer_org_id)) LOOP
      INSERT INTO notifications (user_id, type, title, message, action_url, metadata)
      VALUES (
        buyer_user.user_id,
        'quotation_responded',
        'Nova proposta recebida',
        supplier_name || ' enviou uma proposta para a cotação "' || quotation_title || '".',
        '/quotations/' || NEW.quotation_id || '/compare',
        jsonb_build_object(
          'quotation_id', NEW.quotation_id,
          'supplier_name', supplier_name,
          'title', quotation_title
        )
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_quotation_responded
AFTER UPDATE ON supplier_quotations
FOR EACH ROW EXECUTE FUNCTION fn_notify_quotation_responded();

-- ============================================================
-- 8. ÍNDICES para performance
-- ============================================================
CREATE INDEX idx_notifications_user_unread  ON notifications (user_id, is_read);
CREATE INDEX idx_notifications_created      ON notifications (created_at DESC);
CREATE INDEX idx_connections_requester      ON connection_requests (requester_org_id, status);
CREATE INDEX idx_connections_target         ON connection_requests (target_org_id, status);
CREATE INDEX idx_companies_document         ON companies (document);
CREATE INDEX idx_companies_org              ON companies (organization_id);
