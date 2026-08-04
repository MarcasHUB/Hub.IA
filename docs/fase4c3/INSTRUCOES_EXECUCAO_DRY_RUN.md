# Instruções de Execução — Etapa A (Auditoria Remota de Somente Leitura)

Este documento contém os passos para o administrador executar com segurança o script SQL preparatório de auditoria (`ETAPA_A_DRY_RUN_READ_ONLY.sql`) no banco de dados remoto da Supabase. 
Esta execução é indispensável para extrairmos a realidade física do modelo de dados e confirmarmos as estimativas *antes* de avançarmos para as Etapas de Backup e Consolidação (B e C).

## 1. Conferência Prévia
1. Acesse o **Dashboard da Supabase** (https://app.supabase.com).
2. Localize e entre no projeto correspondente ao **Project Ref**: `zwliwnpxwxxcqshxxmuu`.
3. Garanta que você está no ambiente remoto correto (Produção).

## 2. Preparação do SQL Editor
1. No menu lateral esquerdo, clique em **SQL Editor**.
2. Clique no botão **New Query** (Nova Consulta).
3. Abra o arquivo local `docs/fase4c3/ETAPA_A_DRY_RUN_READ_ONLY.sql` no seu editor de texto ou IDE (VS Code).
4. Copie **todo o conteúdo** do arquivo.
5. Cole o conteúdo no SQL Editor da Supabase.

## 3. Revisão de Segurança (Dry-Run Read-Only)
Antes de apertar em "Run", confirme visualmente que o script:
- Possui o cabeçalho confirmando `DRY-RUN SOMENTE LEITURA`.
- Começa apenas com `SELECT` ou `WITH`.
- **NÃO POSSUI** comandos `UPDATE`, `DELETE`, `INSERT`, `DROP`, `ALTER` ou `TRUNCATE`.

## 4. Execução e Exportação
O script foi dividido intencionalmente em blocos independentes separados por ponto-e-vírgula (`;`).
Para executar e lidar com eventuais diferenças de schema entre o mapeamento local e a produção, siga EXATAMENTE este procedimento:

1. **Execute primeiro os blocos de estrutura** (como `01`, `02` e `03`). Eles mapeiam o que de fato existe no banco.
2. **Execute depois cada bloco de dados separadamente** (ou execute tudo de uma vez clicando em `RUN`).
3. **Caso um bloco apresente erro** (ex: informando que uma tabela ou coluna não existe), **registre o erro**.
4. **Não improvise alteração no SQL Editor** na tentativa de "consertar" a consulta. Se falhou, a ausência da tabela/coluna já é um dado importante para a auditoria.
5. **Continue apenas com os demais blocos independentes**, pulando o bloco que gerou falha.
6. **Devolva os resultados obtidos e os eventuais erros** de forma integral para análise estrutural.

Ao obter os resultados válidos (nas abas *Results 1, Results 2*, etc.):
- Clique no botão de exportação **(Download CSV)** no canto inferior direito da tabela de resultados, **OU** 
- Copie os dados no formato estruturado (JSON / texto tabulado).
- Salve todos os CSVs/resultados obtidos.

## 5. Devolução dos Resultados
Não cole senhas, tokens ou connection strings no chat. 
Devolva apenas o conteúdo estruturado (tabelas, CSVs, JSONs ou mensagens de erro) retornado pelo script para que eu possa validá-los e consolidar as contagens finais da **Etapa A**, atualizando o documento `CHECKPOINT_ETAPA_A.md`.

Após receber e tabular os resultados finais da Etapa A, emitirei a conclusão da fase e o aguardarei para seguirmos com a **Etapa B**.
