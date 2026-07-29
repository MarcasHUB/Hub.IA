DO $$
DECLARE
    prod_row RECORD;
    matched_material_id uuid;
    resolved_manufacturer_id uuid;
    norm_code text;
    norm_name text;
    norm_manufacturer text;
    match_count integer;
BEGIN
    FOR prod_row IN 
        SELECT id, name, description, manufacturer_code, category_id, organization_id, created_at,
               metadata->>'manufacturer' as manufacturer_name
        FROM public.products
        WHERE material_id IS NULL
        ORDER BY created_at ASC, id ASC
    LOOP
        matched_material_id := NULL;
        resolved_manufacturer_id := NULL;
        
        -- Normalizar código e nome do produto
        norm_code := BTRIM(UPPER(prod_row.manufacturer_code));
        norm_name := public.normalize_text_key(prod_row.name);
        
        IF prod_row.manufacturer_name IS NOT NULL AND BTRIM(prod_row.manufacturer_name) <> '' THEN
            norm_manufacturer := public.normalize_text_key(prod_row.manufacturer_name);
        ELSE
            norm_manufacturer := NULL;
        END IF;

        -- 4.A Resolver ou criar o Fabricante (manufacturer_id) na tabela oficial
        IF norm_manufacturer IS NOT NULL THEN
            SELECT id INTO resolved_manufacturer_id 
            FROM public.manufacturers 
            WHERE normalized_name = norm_manufacturer 
            LIMIT 1;

            IF resolved_manufacturer_id IS NULL THEN
                INSERT INTO public.manufacturers (name, normalized_name)
                VALUES (BTRIM(prod_row.manufacturer_name), norm_manufacturer)
                RETURNING id INTO resolved_manufacturer_id;
            END IF;
        END IF;

        -- 4.B Regras de Correspondência e Criação de Materials
        IF resolved_manufacturer_id IS NOT NULL AND norm_code IS NOT NULL AND norm_code <> '' THEN
            -- Caso B: Fabricante + Código (Correspondência estrita)
            SELECT count(*) INTO match_count
            FROM public.materials
            WHERE manufacturer_id = resolved_manufacturer_id
              AND normalized_manufacturer_code = norm_code;

            IF match_count = 1 THEN
                SELECT id INTO matched_material_id
                FROM public.materials
                WHERE manufacturer_id = resolved_manufacturer_id
                  AND normalized_manufacturer_code = norm_code
                LIMIT 1;
            END IF;
            
            IF matched_material_id IS NULL THEN
                -- Se não existe (ou é ambíguo), cria um novo pending_review
                INSERT INTO public.materials (
                    official_name, description, normalized_official_name,
                    master_owner_organization_id, validation_status, visibility, created_source,
                    is_active, manufacturer_id, manufacturer_code, normalized_manufacturer_code, created_at, updated_at
                ) VALUES (
                    prod_row.name, prod_row.description, norm_name,
                    prod_row.organization_id, 'pending_review'::material_validation_status, 'private'::material_visibility, 'manual'::material_source,
                    true, resolved_manufacturer_id, prod_row.manufacturer_code, norm_code, COALESCE(prod_row.created_at, now()), now()
                ) RETURNING id INTO matched_material_id;
            END IF;

        ELSIF norm_code IS NOT NULL AND norm_code <> '' THEN
            -- Caso C: Código sem fabricante
            SELECT count(*) INTO match_count
            FROM public.materials
            WHERE normalized_manufacturer_code = norm_code;

            IF match_count = 1 THEN
                SELECT id INTO matched_material_id
                FROM public.materials
                WHERE normalized_manufacturer_code = norm_code
                LIMIT 1;
            END IF;

            IF matched_material_id IS NULL THEN
                -- Se não acha (ou ambíguo), cria novo sem código e fabricante p/ respeitar constraint e não unificar falsamente
                INSERT INTO public.materials (
                    official_name, description, normalized_official_name,
                    master_owner_organization_id, validation_status, visibility, created_source,
                    is_active, manufacturer_id, manufacturer_code, normalized_manufacturer_code, created_at, updated_at
                ) VALUES (
                    prod_row.name, prod_row.description, norm_name,
                    prod_row.organization_id, 'pending_review'::material_validation_status, 'private'::material_visibility, 'manual'::material_source,
                    true, NULL, NULL, NULL, COALESCE(prod_row.created_at, now()), now()
                ) RETURNING id INTO matched_material_id;
            END IF;

        ELSE
            -- Caso D / E: Sem fabricante e sem código (ou apenas nome)
            INSERT INTO public.materials (
                official_name, description, normalized_official_name,
                master_owner_organization_id, validation_status, visibility, created_source,
                is_active, manufacturer_id, manufacturer_code, normalized_manufacturer_code, created_at, updated_at
            ) VALUES (
                prod_row.name, prod_row.description, norm_name,
                prod_row.organization_id, 'pending_review'::material_validation_status, 'private'::material_visibility, 'manual'::material_source,
                true, NULL, NULL, NULL, COALESCE(prod_row.created_at, now()), now()
            ) RETURNING id INTO matched_material_id;
        END IF;

        -- 4.C Atualizar produto com o ID resolvido/criado
        UPDATE public.products 
        SET material_id = matched_material_id
        WHERE id = prod_row.id;

    END LOOP;
END
$$;
