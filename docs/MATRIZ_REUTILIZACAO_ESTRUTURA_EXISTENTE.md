# MATRIZ DE REUTILIZAÇÃO DE ESTRUTURAS EXISTENTES

| Necessidade | Estrutura encontrada | Arquivo/Migration Referência | Pode reutilizar? | Precisa estender? | Precisa criar? | Justificativa |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Material Master** | Tabela `materials` | `20260728001400` | SIM | NÃO | NÃO | Já foi modelada com base global na Fase 4B. |
| **Material Privado** | Tabela `products` | `00_initial_schema` | SIM | NÃO | NÃO | Possui metadata e liga-se a `materials`. É O local correto. |
| **Fabricante** | Tabela `manufacturers` | `20260728001400` | SIM | NÃO | NÃO | Estrutura adequada (name e normalized_name). |
| **Solicitação de Material** | `validation_status` em `materials` | `20260728001400` | SIM | NÃO | NÃO | O processo ocorre alterando `validation_status = 'pending_review'`. Tabela paralela não necessária. |
| **Rede: Conexões** | `organization_connections` | `00_initial_schema` | SIM | NÃO | NÃO | Já gerencia a Rede de Negócios (Business Network). |
| **Catálogo de Venda** | `product_offers` | `00_initial_schema` | SIM | SIM | NÃO | Representa a oferta, mas pode requerer ajustes mínimos de FK e RLS. |
| **Cotações** | `quotation_requests`, `rfqs` | `00_initial_schema` | SIM | NÃO | NÃO | O core do módulo de cotações. |
| **Módulo de Contratos** | **NÃO LOCALIZADO** | N/A | NÃO | NÃO | **SIM** | Estruturas de Contratos Comerciais privados (`contracts` e `contract_items`) não existem e deverão ser criadas sob governança de organização (tenant). |
| **Documentos/Evidências** | Storage Supabase/Buckets | Portal de anexo genérico | SIM | SIM | NÃO | Já gerencia PDF e imagens, porém necessita vincular aos Contratos. |
