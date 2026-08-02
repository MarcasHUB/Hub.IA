# SEGREGAÇÃO DE DADOS INTERNOS E COMPARTILHADOS

Ao desenhar a tabela de Contratos, devemos considerar que a Entidade (Registro UUID 1) representa juridicamente as duas partes envolvidas. No entanto, sistematicamente, o Fornecedor visualiza menos coisas do que a Compradora (Dona do Registro).

## A Solução via Arquitetura RLS e Backend
Não criaremos tabelas paralelas complexas do tipo `contract_internal_data` e `contract_shared_data` para a V1, pois isso sobrecarrega JOINs e queries do App.

- **A Abordagem Proposta (Row Level Security + API Views)**:
  A tabela `contracts` guardará todos os dados (Compartilhados e Notas Internas). 
  O fornecedor, apesar de ter acesso ao SELECT na tabela (pois seu tenant = `supplier_organization_id`), receberá os dados processados via uma Data View ou Payload sanitizado no Backend (NestJS/Node).
  O RLS por si só garante que o fornecedor A não veja o contrato do fornecedor B. A granularidade por coluna (esconder coluna "nota interna" do fornecedor A) fica a encargo da camada de acesso a dados ou de Views Específicas `vw_contracts_supplier`.

## Anexos (Storage)
O bucket do Supabase suporta divisões. Todos os uploads de contratos possuirão no Path:
`contracts/{contract_id}/internal/{filename}` e `contracts/{contract_id}/shared/{filename}`.
As Storage Policies liberarão acesso à pasta `/shared/` para ambos os Tenants, enquanto a pasta `/internal/` exigirá restrição `organization_id = user.organization_id`.
