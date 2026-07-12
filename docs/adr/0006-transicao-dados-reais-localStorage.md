# ADR 0006: Transição de Simulações para Dados Reais no localStorage

## Status
Aprovado

## Contexto
O SupplyHub utilizava uma série de inicializadores de dados mockados estáticos (`INITIAL_PRODUCTS`, `INITIAL_SENT_QUOTATIONS`, `MOCK_RECEIVED`, etc.) para simular a interface em etapas iniciais de desenvolvimento. Com o avanço do projeto e a necessidade de testes funcionais reais por parte do usuário administrador (Vinicius Cordebello), tornou-se necessário desativar dados simulados e permitir o cadastro, edição e exclusão de dados persistentes de verdade. Como o backend real ainda não está integrado, utilizaremos o `localStorage` do navegador como banco de dados local unificado para salvar essas informações.

## Decisão
Decidimos por:
1. Remover todas as listas estáticas fictícias de produtos, cotações enviadas, cotações recebidas, colaboradores e dados corporativos da inicialização padrão.
2. Injetar o usuário real **Vinicius Cordebello** (CPF: `368.047.418-03`, Perfil: `Administrador Manager`) como operador logado e administrador central.
3. Desenvolver adaptadores locais de leitura e escrita (`localStorage.getItem` e `setItem`) para as chaves `supplyhub_products`, `supplyhub_sent_quotations`, `supplyhub_colaboradores` e `supplyhub_company_name`/`logo`.
4. Garantir que as telas carreguem os estados a partir dessas chaves, exibindo telas limpas (tabelas e catálogos vazios) se o usuário ainda não tiver cadastrado dados, permitindo a construção do banco de dados de testes de forma 100% orgânica.

## Consequências
- Os testes serão fiéis à realidade, permitindo cadastrar, editar e excluir itens sem misturar com dados fictícios.
- A exclusão ou limpeza de dados do navegador (`Clear Cache/Site Data`) apagará as informações locais de testes, funcionando como um reset completo do banco local.
