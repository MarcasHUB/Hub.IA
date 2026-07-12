# ADR-0005: Módulo de Mensagens B2B com Compliance e Utilitário de Snapshot FlashPoint

**Data:** 2026-07-11  
**Status:** Aceito  
**Autor:** SupplyHub.IA Engineering Team

---

## Contexto

Dois requisitos surgiram nesta sprint:
1. **Comunicação B2B Direta**: A necessidade de permitir que as empresas parceiras conversem diretamente dentro da plataforma para negociar cotações e tirar dúvidas, com regras estritas de compliance corporativo para evitar fraude e desvio de transações para fora da plataforma.
2. **Estabilidade de Desenvolvimento (FlashPoint)**: A necessidade de criar snapshots rápidos do código de desenvolvimento. Caso algum erro grave aconteça durante alterações sucessivas, o desenvolvedor deve conseguir voltar para o estado estável anterior em poucos segundos.

---

## Decisão

### 1. Módulo de Mensagens com Compliance Local

*   Criou-se o módulo `/messages` no router e navbar.
*   Implementou-se o `ComplianceFilter.ts` contendo expressões regulares (`RegExp`) e termos bloqueados.
*   A validação ocorre de forma **síncrona no envio**, bloqueando:
    *   Telefones, e-mails, PIX e contas bancárias.
    *   Termos como "por fora", "meu whatsapp", "chama no zap", impedindo a desintermediação comercial.
*   Em caso de violação, o chat renderiza um banner de aviso e cancela a transmissão antes do salvamento da mensagem.

### 2. Utilitário FlashPoint (Backups Rápidos)

*   Criou-se o script `scripts/flashpoint.ps1`.
*   O script utiliza o comando nativo Windows `robocopy` para copiar o diretório atual de forma ágil, excluindo:
    *   `node_modules/` (extremamente pesado)
    *   `.git/` (controle de versão completo)
    *   `.flashpoints/` (backups antigos)
    *   `dist/` (build final)
    *   `.env` (credenciais sensíveis)
*   **Rollback automático**: Em caso de falha na restauração do backup, o script mantém um snapshot temporário de segurança (`.flashpoints_tmp`) para reverter o estado atual e evitar a corrupção total do workspace.

---

## Consequências

**Positivas:**
- Canal de comunicação oficial integrado e protegido contra abusos de compliance.
- Aumento da retenção comercial, mantendo as transações no funil de cotações da plataforma.
- Rapidez no desenvolvimento: snapshots do projeto levam menos de 2 segundos para serem gerados ou restaurados.
- Segurança contra erros catastróficos causados por refatorações em lote.

**Negativas / Tradeoffs:**
- Validação de compliance no lado do cliente (`client-side`). Em produção, deverá existir um trigger ou middleware no backend (Supabase functions/triggers) duplicando essa lógica para evitar contorno por chamadas de API diretas.
- Os backups são armazenados localmente e, embora ignorados no `.gitignore`, ocupam espaço em disco a cada novo snapshot (cerca de 5MB por FlashPoint).
