const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const data = JSON.parse(fs.readFileSync('inventory_raw.json', 'utf-8'));

let md = `# Inventário Técnico do Módulo de Organizações\n\n`;

md += `## 1. Estrutura do módulo\n`;
md += "```\n";
try {
  md += execSync('Get-ChildItem -Path src/modules/organizations, src/modules/suppliers, src/kernel/router -Recurse -Name', { shell: 'powershell.exe', encoding: 'utf-8' }).trim();
} catch(e) {}
md += "\n```\n\n";

md += `## 2. Rotas\n\n`;
md += `| Caminho | Componente | Utilização |\n`;
md += `|---|---|---|\n`;
data.routes.forEach(r => {
  if(r.path.includes('empresa') || r.path.includes('admin') || r.path.includes('organization') || r.path.includes('network')) {
    md += `| ${r.path} | ${r.component} | |\n`;
  }
});
md += "\n";

md += `## 3. Componentes\n\n`;
md += `| Componente | Props | Arquivo |\n`;
md += `|---|---|---|\n`;
data.components.forEach(c => {
  md += `| ${c.name} | \`${(c.props || 'nenhuma').replace(/\n/g, ' ')}\` | ${c.file} |\n`;
});
md += "\n";

md += `## 4. Banco de dados\n\n`;
for(const [tableName, cols] of Object.entries(data.db.tables)) {
  md += `### Tabela: \`${tableName}\`\n\n\`\`\`sql\n`;
  md += cols.join('\n');
  md += `\n\`\`\`\n\n`;
}

md += `## 5. Políticas RLS\n\n`;
md += `| Tabela | Política | Tipo | Condição |\n`;
md += `|---|---|---|---|\n`;
data.db.rls.forEach(r => {
  md += `| ${r.table} | ${r.policy} | ${r.type} | \`${r.using}\` |\n`;
});
md += "\n";

md += `## 6. Hooks\n\n`;
md += `| Hook | Arquivo |\n`;
md += `|---|---|\n`;
data.hooks.forEach(h => {
  md += `| ${h.name} | ${h.file} |\n`;
});
md += "\n";

md += `## 7. Serviços\n\n`;
md += `| Serviço | Arquivo |\n`;
md += `|---|---|\n`;
data.services.forEach(s => {
  md += `| ${s.name} | ${s.file} |\n`;
});
md += "\n";

md += `## 8. Campos existentes\n\n`;
md += `*(Mapeamento não-exaustivo baseado nas colunas básicas e UI)*\n`;
md += `| Campo UI | Coluna Banco | Tabela | Utilizado | Observação |\n`;
md += `|---|---|---|---|---|\n`;
md += `| Razão Social | razao_social / name | organizations | Sim | |\n`;
md += `| Nome Fantasia | nome_fantasia / trade_name | organizations | Sim | |\n`;
md += `| CNPJ | document / cnpj | organizations | Sim | |\n`;
md += `| Site | website | organizations | Sim | |\n`;
md += `| Telefone | phone | organizations | Sim | |\n`;
md += `| Email | email | organizations | Sim | |\n`;
md += `| Endereço (Logradouro, etc) | address_street, etc | organizations | Sim | Adicionado via migration 18 |\n`;
md += `| CNAEs | cnae_code | empresa_cnaes | Sim | Tabela auxiliar |\n`;
md += `| Certificações | certification_id | empresa_certificacoes | Sim | Tabela auxiliar |\n`;
md += `| Segmentos | segment_id | organization_segments | Sim | Tabela auxiliar |\n`;
md += `| Estados Atendidos | state_code | empresa_estados_atendidos | Sim | Tabela auxiliar |\n`;
md += `| Raio de Atendimento | area_cobertura_raio | organizations | Sim | |\n`;
md += "\n";

md += `## 9. Área geográfica\n\n`;
let areaGrep = "";
try {
    areaGrep = execSync('grep -rn "area_cobertura_raio" src/', { encoding: 'utf-8' });
} catch(e) {}
md += `- **Implementação atual:** Utiliza a coluna \`area_cobertura_raio\` na tabela \`organizations\`.\n`;
md += `- **Onde é utilizada:**\n\`\`\`\n${areaGrep}\n\`\`\`\n`;
md += `- **Impacto da alteração:** Transformar de input numérico para select exigirá alterar o tipo no banco de dados se for Integer, ou mapear as novas strings. Atualmente parece ser salva no JSON ou em coluna específica. A mudança afetará a busca por raio em filtros futuros.\n\n`;

md += `## 10. Dependências\n\n`;
md += `- **Dashboard:** Sinais, métricas (usa organization_id)\n`;
md += `- **Rede e Parceiros:** Módulo \`suppliers\` (empresa_parceiros, convites)\n`;
md += `- **Convites:** Relacionado à empresa base\n`;
md += `- **Cotações:** Requisições de cotação atreladas à empresa\n`;
md += `- **Produtos:** \`empresa_catalogo\` atrela produtos à empresa\n`;
md += `- **Chat:** Mensagens contextualizadas pela empresa\n\n`;

md += `## 11. Código morto\n\n`;
md += `- **Rotas mortas:** \`/admin/empresas/:id\` recém-criada mas solicitada remoção.\n`;
md += `- **Componentes:** \`AdminCompanyProfilePage\` será obsoleto.\n`;
md += `- Aprofundamento necessário para hooks/páginas legados da Fase 1, já que muitos ainda podem ler \`localStorage\` ao invés da prop.\n\n`;

md += `## 12. Possíveis riscos\n\n`;
md += `- **Modal vs Tabs:** O \`CompanyProfileView\` atual possui tabs complexas (Colaboradores, Logs). Colocar tudo isso dentro de um Modal causará problemas graves de UX (modal dentro de modal, overflow de tela, carregamento excessivo). O modal deve ser estritamente para dados comerciais/gerais.\n`;
md += `- **Remoção de rotas atuais:** Quebra de links salvos (bookmarks) pelos administradores.\n`;
md += `- **Alteração no banco:** Mudar \`area_cobertura_raio\` pode quebrar queries existentes que assumam tipo numérico.\n\n`;

md += `## 13. Sugestões arquiteturais\n\n`;
md += `1. **Criar \`CompanyProfileForm\` isolado:** Em vez de tentar enfiar o \`CompanyProfileView\` (que é uma página com layout de 2 colunas e navegação) no Modal, extrair apenas o formulário central (\`DadosEmpresaTab\`) para um componente \`CompanyProfileForm\`. O \`CompanyProfileModal\` e o \`MinhaEmpresaPage\` usariam esse form.\n`;
md += `2. **Sub-abas no Modal:** Evitar gerenciar colaboradores e permissões dentro do modal de perfil. O modal deve ter apenas "Dados Gerais" e "Área Comercial". A gestão de usuários deve ter tela/modal próprio se necessário.\n`;
md += `3. **Componentização de Selects:** O novo select de Área Geográfica deve usar o componente de Dropdown/Select padronizado do projeto.\n`;

fs.writeFileSync('relatorio_inventario_organizacoes.md', md, 'utf-8');
console.log('Relatório gerado.');
