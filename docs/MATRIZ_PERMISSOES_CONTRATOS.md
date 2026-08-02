# MATRIZ DE PERMISSÕES DE CONTRATOS E ADM GLOBAL

| Perfil | Criação | Leitura (Privado) | Alteração de Valor/Vigência | Visualiza Dados Sensíveis? | ADM Global Actions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Comprador** (Tenant Owner) | SIM | SIM | SIM | SIM | N/A |
| **Fornecedor** (Via Network) | NÃO | SIM (Apenas visão) | NÃO | SIM (Visão de seu contrato) | N/A |
| **Visualizador Interno** | NÃO | SIM | NÃO | Parcial (Conforme policy) | N/A |
| **ADM Global / Curadoria** | NÃO | METADADOS | NÃO | **NÃO** | Audita ciclo de vida e quantidade. Acesso a valores ou quebra de privacidade requer escalonamento documentado e triggers de auditoria (Break-Glass). |
| **Gestor de Contratos** | SIM | SIM | SIM | SIM | N/A |

O princípio central é: **A plataforma Hub.IA não visualiza o preço acordado entre o Comprador e o Fornecedor** na interface padrão de suporte.
