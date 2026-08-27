# Módulos de Negócio - SupplyHub

Esta documentação descreve os módulos de negócio implementados no projeto SupplyHub.

---

## 1. Módulo de Organizações (`organizations`)

O módulo de Organizações é responsável por gerenciar a identidade e o perfil corporativo da empresa do usuário logado na plataforma.

### Tela: Minha Empresa (`/organizations`)
Esta tela serve como o hub central para gerenciar informações cadastrais e perfis de atuação. Ela possui abas para:
*   **Dados Gerais**: Cadastro principal de Identidade Visual, Descrição da Empresa e Informações de Contato.
*   **Perfil Comercial**: Dados mercadológicos e de faturamento da empresa.
*   **Colaboradores**: Lista e gestão dos membros cadastrados.
*   **Solicitantes**: Tabela de usuários autorizados a iniciar novas requisições de compra.
*   **Permissões**: Configuração de controle de acessos (ACL) por módulo.
*   **Aprovações**: Histórico de auditoria interna e status de homologações.

### Consulta do Cartão de CNPJ (Simulada)
Integrado na aba **Dados Gerais**, há um mecanismo de busca que simula uma consulta de CNPJ à API da Receita Federal:
1.  O usuário insere o CNPJ.
2.  Ao clicar em **Consultar**, o sistema executa um feedback visual de carregamento e busca dados correspondentes.
3.  O CNPJ padrão `10.364.979/0001-30` preenche automaticamente:
    *   **Razão Social**: `SUPPLYHUB TECNOLOGIA E INTELIGENCIA EM COMPRAS LTDA`
    *   **Nome Fantasia**: `SupplyHub.IA` (que se sincroniza reativamente no topo da tela, ao lado da logomarca).
    *   **Atividades Principais (CNAEs)**: Códigos e descrições das atividades comerciais registradas.
    *   **Em atividade desde**: Data de início da atividade da empresa.
4.  Outros CNPJs informados carregam dados fictícios de demonstração.

---

## 3. Módulo de Mensagens B2B (`messages`)

O módulo de Mensagens fornece uma central de chat interna e direta entre empresas parceiras na plataforma (conexão aceita). Ele visa facilitar a negociação direta e a cotação de produtos.

### Interface canônica: ChatDrawer
O `ChatDrawer` lateral é a única interface de conversas. Ele mantém a lista de conversas, mensagens, contadores de não lidas e subscriptions de Realtime em uma única fonte de estado.

A rota `/messages` foi descontinuada como interface independente. Ela permanece somente como ponte de compatibilidade: links antigos no formato `/messages?conversation=<uuid>` redirecionam para o dashboard, abrem a conversa no drawer e eliminam o parâmetro transitório. Novos deep links usam `chatConversation=<uuid>` e também são removidos da URL após o processamento.

### Políticas de Compliance Automáticas
Integrado no envio de mensagens, há um motor de compliance executado no cliente (`ComplianceFilter.ts`) que analisa o texto de forma reativa antes de ser transmitido para evitar fraudes ou vazamento comercial:
*   **Dados Bancários/PIX**: Bloqueia o envio se forem identificados números de agência/conta ou chaves PIX.
*   **Dados de Contato Externos**: Bloqueia e-mails pessoais e números de celular/WhatsApp.
*   **Desvio de Plataforma**: Identifica e bloqueia frases que instiguem desviar a transação para fora do SupplyHub.
*   **Feedback**: Quando bloqueada, a mensagem não é enviada e um alerta vermelho do compliance indica o motivo do bloqueio para o usuário.

---

## 4. Outros Módulos
*   **`auth`**: Gestão de login e autenticação com Supabase Auth.
*   **`dashboard`**: Visão geral de métricas, cotações recentes e atalhos.
*   **`suppliers`**: Homologação, cadastro e controle da base de fornecedores.
*   **`products`**: Gestão de catálogo de produtos corporativos.
*   **`quotations`**: Criação, comparação, negociação e fechamento de cotações de preços.
    *   **Emissão de PDF**: Permite exportar o espelho detalhado da cotação finalizada em formato PDF a partir da folha de estilos de impressão `@media print` no navegador.
    *   **Pedido de Compra (PC)**: Gera a estrutura JSON de dados do pedido de compra pronta para integrações automatizadas com sistemas de ERP (SAP, Totvs, Senior, etc.).
    *   **Score de Fornecedores (0 a 100)**: Motor inteligente de pontuação que classifica as propostas dos parceiros em medalhas **Ouro** (90-100), **Prata** (70-89) ou **Bronze** (abaixo de 70), ponderando preço em relação à média de mercado (40%), prazo de faturamento proposto (30%) e bônus por entrega antecipada/no prazo (30%).
*   **`intelligence`**: Dashboard de BI e análise inteligente de compras baseada em dados reais.
