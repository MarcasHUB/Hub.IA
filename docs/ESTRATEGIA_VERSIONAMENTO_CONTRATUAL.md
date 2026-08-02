# ESTRATÉGIA DE VERSIONAMENTO CONTRATUAL

## Análise das Alternativas
A necessidade de alteração de preço, quantidade ou vigência de um contrato após aprovação e uso gera conflitos de dados temporais.

- **Alternativa A (Atualização Direta + Auditoria)**: Altera-se o item direto. Fácil de fazer. **Problema**: Cotações atreladas no passado perdem referência nominal imediata ao preço original sem ter que desenterrar a tabela JSON de logs.
- **Alternativa C (Versionamento Completo)**: Tabelas `contract_versions`, duplicidade profunda. **Problema**: Explode a complexidade do frontend, backoffice e queries. Muito custoso para a V1 de SupplyHUB.

## Recomendação Técnica (Alternativa D - Híbrida: Novo Registro Semântico / Aditivos)
A abordagem recomendada para a Plataforma, visando simplicidade para a V1 e robustez transacional, é impedir a alteração de Campos Críticos Financeiros (Preço, Vigência) no estado `ACTIVE` da entidade. 
Sempre que uma mudança crítica precisar ocorrer (um Aditivo), a aplicação duplicará o cabeçalho logicamente, anexará um sufixo ao número (ex: `CTR-001-V2`) e inativará (`closed` ou `superseded`) a versão antiga, transferindo o novo UUID para a vigência posterior.
As Cotações que fecharam usando `CTR-001` no mês passado continuam apontando para o UUID antigo, o qual preserva o `unit_price` imaculado daquele período.

## Campos Passíveis de Alteração Direta (Sem versão)
- Notas internas.
- Inclusão/Remoção de anexos acessórios não assinados formalmente.
- Classificação local (Business unit).
