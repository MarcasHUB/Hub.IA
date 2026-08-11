export interface AttachmentRiskAssessment {
  flagged: boolean;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  reasons: string[];
}

export function classifyAttachmentRisk(file: File): AttachmentRiskAssessment {
  const fileName = file.name.toLowerCase();
  const reasons: string[] = [];
  let riskScore = 0;
  let riskLevel: 'low' | 'medium' | 'high' = 'low';

  // High risk patterns
  const highRiskPatterns = [
    /\brg\b/,
    /\bcpf\b/,
    /\bcnh\b/,
    /identidade/,
    /passaporte/,
    /dados[\s_]*pessoais/,
    /documento[\s_]*pessoal/
  ];

  // Medium risk patterns
  const mediumRiskPatterns = [
    /comprovante/,
    /\bpix\b/,
    /extrato/,
    /fatura/,
    /bancario/,
    /bancário/
  ];

  let hasHighRisk = false;
  for (const pattern of highRiskPatterns) {
    if (pattern.test(fileName)) {
      hasHighRisk = true;
      reasons.push(`filename:${pattern.toString().replace(/\//g, '').replace(/\\b/g, '')}`);
    }
  }

  let hasMediumRisk = false;
  if (!hasHighRisk) {
    for (const pattern of mediumRiskPatterns) {
      if (pattern.test(fileName)) {
        hasMediumRisk = true;
        reasons.push(`filename:${pattern.toString().replace(/\//g, '').replace(/\\b/g, '')}`);
      }
    }
  }

  if (hasHighRisk) {
    riskScore = 70;
    riskLevel = 'high';
  } else if (hasMediumRisk) {
    riskScore = 40;
    riskLevel = 'medium';
  }

  return {
    flagged: riskScore > 0,
    riskScore,
    riskLevel,
    reasons
  };
}
