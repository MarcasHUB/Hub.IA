# ESCOPO DA V1: CONTRATOS DE MATERIAIS VS SERVIÇOS/GERAL

## Definição Restritiva e Formal (Opção A)
A V1 do módulo de Contratos da Hub.IA é **exclusivamente direcionada para Contratos de Fornecimento de Materiais** (bens de consumo, insumos indiretos, mercadorias físicas).
Serviços, contratos institucionais e fretes puros não estão contemplados na mecânica transacional nativa da V1.

## Justificativa
O elo central de coesão do banco de dados na Fase 4 e vindoura Fase 5 é o `material_id`. O Material Master dita a estrutura da Plataforma e do Supplier. 
Permitir contratos sem itens atrelados a materiais forçaria a abertura do `material_id` para NULL em `contract_items`, quebrando a integridade rígida referencial proposta e transformando a tabela em um repositório agnóstico. 
Contratos agnósticos exigiriam uma arquitetura diferente de faturamento e recebimento.

## Evolução Futura
Caso serviços sejam agregados no futuro, a entidade `materials` precisará possuir o flag `is_service` ou deverá ser criada uma entidade espelho (`services_master`). No momento atual, o bloqueio do `material_id NOT NULL` na migration é o guard rail que restringe o uso incorreto.
