# SupplyHub

**SupplyHub** Ã© uma plataforma SaaS de compras corporativas que conecta empresas e fornecedores em um marketplace privado e inteligente. O sistema visa substituir processos manuais (como e-mail, WhatsApp e planilhas) por um ambiente automatizado para reduzir custos e aumentar a concorrÃªncia e transparÃªncia.

## Arquitetura
A arquitetura do SupplyHub foi construÃ­da com base em **Domain Driven Design (DDD)**, atuando como um MonÃ³lito Modular com separaÃ§Ã£o clara entre as camadas de Kernel, DomÃ­nio, AplicaÃ§Ã£o e ApresentaÃ§Ã£o, alÃ©m de suportar a comunicaÃ§Ã£o interna por um Event Bus.

## Estrutura de DiretÃ³rios
- src/kernel/: Ferramentas globais (Event Bus, Logger, DI, Providers).
- src/modules/: MÃ³dulos de negÃ³cios independentes (Auth, Identity, Organizations, Suppliers, etc).
- src/infrastructure/: ComunicaÃ§Ã£o com serviÃ§os externos, como banco de dados.
- src/contracts/: Interfaces para integraÃ§Ãµes futuras.
- src/sdk/: SDK interno para serviÃ§os de terceiros (SAP, Oracle, TOTVS).
- src/shared/: Recursos reutilizÃ¡veis pela camada de apresentaÃ§Ã£o.
- docs/: DocumentaÃ§Ã£o viva e Architecture Decision Records (ADRs).

## InstalaÃ§Ã£o e ExecuÃ§Ã£o
1. Instale as dependÃªncias: 
pm install
2. Copie o arquivo de configuraÃ§Ã£o de ambiente: cp .env.example .env (e adicione as credenciais do Supabase).
3. Inicie o servidor: 
pm run dev

## Roadmap
O detalhamento do roadmap estÃ¡ localizado na documentaÃ§Ã£o: [Roadmap](./docs/Roadmap.md)