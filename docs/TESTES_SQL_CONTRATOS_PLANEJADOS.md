# TESTES SQL PLANEJADOS PARA O MÓDULO DE CONTRATOS

## Cenários RLS (Row Level Security)
1. **Comprador cria contrato draft:** Teste Inserir contrato validando se a policy de `organization_id` autoriza a escrita e leitura imediata, sendo `current_org_id()`.
2. **Outro tenant não visualiza:** SET Role auth_user e org X; SELECT * FROM contracts de Org Y -> Deve retornar zero linhas.
3. **Fornecedor conectado visualiza contrato:** SET org Z (fornecedor conectado); SELECT contrato ativo de Org X. Deve retornar os campos básicos e o cabeçalho do contrato.
4. **Fornecedor conectado não visualiza campos internos:** Select em `notes` (notas internas se separadas ou metadados de workflow) -> Deve retornar restrição, nulo ou aplicar máscara.
5. **ADM Global acesso a preços bloqueado:** SET ROLE admin. SELECT price FROM contract_items -> Validar que sem view genérica o preço real seja inacessível, e acessível somente via RPC transacional mascarado.

## Cenários de Integridade Funcional
1. **Datas Inválidas Rejeitadas:** Insert contrato com `start_date > end_date`. O CHECK `chk_contracts_dates` deve jogar Exception.
2. **Preço Negativo Rejeitado:** Insert item com `price = -100`. O CHECK `chk_ci_price` deve abortar.
3. **Contrato draft sem itens permitido:** Inserir `contracts` draft; commitar. OK.
4. **Ativação sem itens rejeitada:** Trigger futura ou Function RPC `activate_contract` falhar se `COUNT(contract_items) = 0`.
5. **Supplier_id faltante:** Inserir `contracts` com `supplier_id = NULL` e `supplier_organization_id = NULL`. O CHECK `chk_contracts_supplier` aborta.
6. **Exclusão Histórica Defensiva:** Apagar `materials` onde existe um `contract_item`. A FK com `ON DELETE RESTRICT` barra a exclusão do material master, forçando inativação soft-delete e preservando contratos vigentes/históricos.
