# MATRIZ DE TRANSIÇÃO DE STATUS DE CONTRATOS

| Origem | Destino | Transição Permitida | Permissão (Role) | Validações e Motivos | Regra Final |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **draft** | pending_approval | SIM | `contract_editor` ou Gestor | Valida se há itens ativos. Datas. Fornecedor preenchido. | OBRIGATÓRIA |
| **pending_approval** | draft | SIM | `contract_approver` | Necessário motivo de rejeição. Volta para edição. | PERMITIDA |
| **pending_approval** | active | SIM | `contract_approver` | Audita Approver_id, approved_at. Só entra no estado final se data >= start_date (ou sistema considera active mas future pending logic). | PERMITIDA |
| **active** | suspended | SIM | Gestor / Aprovador | Exige motivo da suspensão (`suspension_reason`). Para o uso do contrato em cotações instantaneamente. | EXCEPCIONAL |
| **suspended** | active | SIM | Gestor / Aprovador | Reversão permitida. Justificativa registrada. | EXCEPCIONAL |
| **active** | expired | AUTO | Sistema / Job / View | Ocorre naturalmente (end_date atingida). Idealmente, uma VIEW `effective_contract_status` resolve no backend para n depender de Jobs de meia-noite. | TERMINAL PARCIAL |
| **active** | canceled | SIM | Gestor / Aprovador | Exige `cancellation_reason`. Encerra abruptamente antes da vigência. | TERMINAL |
| **active** | closed | SIM | Gestor / Admin | Encerramento administrativo formal e manual, distinto do expire. | TERMINAL |
| **closed** | draft / active | NÃO | - | Proibido. Qualquer reativação deve passar por novo processo de aditivo ou cópia como novo draft. | PROIBIDA |
| **canceled**| active | NÃO | - | Proibido. Exige refação ou novo número de revisão (Versionamento). | PROIBIDA |
