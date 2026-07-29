-- Migration: 20260728215000_fase3_complementar_isolamento.sql
-- Descrição: Impede que a organização interna (Hub.IA) seja usada em relacionamentos comerciais (conexões, cotações, convites).

BEGIN;

CREATE OR REPLACE FUNCTION public.prevent_internal_org_relationships()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $func$
DECLARE
    is_org_internal BOOLEAN;
    is_partner_internal BOOLEAN;
BEGIN
    -- Verifica se organization_id é interno
    SELECT is_platform_internal INTO is_org_internal 
    FROM public.organizations WHERE id = NEW.organization_id;
    
    -- Verifica se partner_id é interno (para tabela empresa_parceiros)
    IF TG_TABLE_NAME = 'empresa_parceiros' THEN
        SELECT is_platform_internal INTO is_partner_internal 
        FROM public.organizations WHERE id = NEW.partner_id;
        
        IF is_org_internal = true OR is_partner_internal = true THEN
            RAISE EXCEPTION 'Ação bloqueada: Organizações internas da plataforma não podem participar de conexões comerciais.';
        END IF;
    END IF;

    -- Para cotações (supplier_quotations / rfqs) - Assumindo que a coluna do fornecedor seja supplier_id
    IF TG_TABLE_NAME = 'supplier_quotations' OR TG_TABLE_NAME = 'rfqs' THEN
        -- Ajuste o nome da coluna conforme a tabela real (ex: supplier_id)
        IF hasattr(NEW, 'supplier_id') THEN
           SELECT is_platform_internal INTO is_partner_internal 
           FROM public.organizations WHERE id = NEW.supplier_id;
           
           IF is_org_internal = true OR is_partner_internal = true THEN
               RAISE EXCEPTION 'Ação bloqueada: Organizações internas não podem emitir ou receber cotações.';
           END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$func$;

REVOKE ALL ON FUNCTION public.prevent_internal_org_relationships() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_internal_org_relationships() FROM anon;

DROP TRIGGER IF EXISTS prevent_internal_org_in_connections ON public.empresa_parceiros;
CREATE TRIGGER prevent_internal_org_in_connections
BEFORE INSERT OR UPDATE ON public.empresa_parceiros
FOR EACH ROW
EXECUTE FUNCTION public.prevent_internal_org_relationships();

-- (Adicione outras triggers conforme as tabelas de cotação reais existam)

COMMIT;
