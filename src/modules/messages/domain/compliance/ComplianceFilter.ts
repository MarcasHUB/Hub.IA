// ─── Filtro de Compliance para o Chat B2B ────────────────────────────────────
// Bloqueia mensagens com dados bancários, contatos externos e conteúdo
// que incentive desvio de negócios para fora da plataforma.

export interface ComplianceResult {
  blocked: boolean;
  reason?: string;
  highlightPattern?: RegExp;
}

const COMPLIANCE_RULES: { pattern: RegExp; reason: string }[] = [
  {
    pattern: /\b\d{4,5}[-.\s]?\d{3,4}[-.\s]?\d{1}\b/,
    reason: 'Compartilhamento de dados bancários (agência/conta) não é permitido na plataforma.',
  },
  {
    pattern: /\b(pix|chave\s*pix)\s*[:=]?\s*[\w.@+-]{5,}/i,
    reason: 'Compartilhamento de chave PIX não é permitido. Utilize as cotações da plataforma para formalizar pagamentos.',
  },
  {
    pattern: /\b[A-Z0-9._%+-]+@(?!supplyhub)[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
    reason: 'Compartilhamento de e-mails externos não é permitido. Toda comunicação deve ocorrer dentro da plataforma.',
  },
  {
    pattern: /(\+55\s?)?\(?\d{2}\)?\s?\d{4,5}[-.\s]?\d{4}/,
    reason: 'Compartilhamento de números de telefone/WhatsApp não é permitido. Toda comunicação deve ocorrer dentro da plataforma.',
  },
  {
    pattern: /\b(por fora|fora da plataforma|direto comigo|meu whatsapp|me chama no zap|zap(\.)?zap|telegram)\b/i,
    reason: 'Tentativa de desviar negociação para fora da plataforma detectada. Todas as transações devem ser formalizadas aqui.',
  },
  {
    pattern: /\b(cartão de crédito|número do cartão|cvv|validade do cartão)\b/i,
    reason: 'Compartilhamento de dados de cartão de crédito não é permitido.',
  },
];

export function checkCompliance(text: string): ComplianceResult {
  for (const rule of COMPLIANCE_RULES) {
    if (rule.pattern.test(text)) {
      return {
        blocked: true,
        reason: rule.reason,
        highlightPattern: rule.pattern,
      };
    }
  }
  return { blocked: false };
}
