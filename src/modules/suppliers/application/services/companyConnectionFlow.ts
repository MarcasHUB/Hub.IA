export type CompanyLookupState =
  | 'idle'
  | 'loading'
  | 'found'
  | 'not_found'
  | 'ambiguous'
  | 'failed';

export type CompanyConnectionDecision =
  | { kind: 'existing_organization'; targetOrganizationId: string }
  | { kind: 'external_invitation' }
  | {
      kind: 'blocked';
      reason: 'lookup_required' | 'lookup_in_progress' | 'lookup_ambiguous' | 'lookup_failed';
    };

export interface CompanyConnectionFlowInput {
  lookupState: CompanyLookupState;
  existingOrganizationId: string | null;
  message?: string;
}

export interface CompanyConnectionFlowActions {
  requestConnection: (targetOrganizationId: string, message?: string) => Promise<unknown>;
  createExternalInvitation: () => Promise<unknown>;
}

export class CompanyConnectionFlowBlockedError extends Error {
  readonly reason: Extract<CompanyConnectionDecision, { kind: 'blocked' }>['reason'];

  constructor(reason: Extract<CompanyConnectionDecision, { kind: 'blocked' }>['reason']) {
    super(reason);
    this.name = 'CompanyConnectionFlowBlockedError';
    this.reason = reason;
  }
}

export function resolveCompanyConnectionDecision(
  lookupState: CompanyLookupState,
  existingOrganizationId: string | null,
): CompanyConnectionDecision {
  switch (lookupState) {
    case 'idle':
      return { kind: 'blocked', reason: 'lookup_required' };
    case 'loading':
      return { kind: 'blocked', reason: 'lookup_in_progress' };
    case 'ambiguous':
      return { kind: 'blocked', reason: 'lookup_ambiguous' };
    case 'failed':
      return { kind: 'blocked', reason: 'lookup_failed' };
    case 'found':
      return existingOrganizationId
        ? { kind: 'existing_organization', targetOrganizationId: existingOrganizationId }
        : { kind: 'blocked', reason: 'lookup_failed' };
    case 'not_found':
      return existingOrganizationId
        ? { kind: 'blocked', reason: 'lookup_failed' }
        : { kind: 'external_invitation' };
  }
}

export async function executeCompanyConnectionFlow(
  input: CompanyConnectionFlowInput,
  actions: CompanyConnectionFlowActions,
): Promise<'connection_request' | 'external_invitation'> {
  const decision = resolveCompanyConnectionDecision(
    input.lookupState,
    input.existingOrganizationId,
  );

  if (decision.kind === 'blocked') {
    throw new CompanyConnectionFlowBlockedError(decision.reason);
  }

  if (decision.kind === 'existing_organization') {
    await actions.requestConnection(decision.targetOrganizationId, input.message?.trim() || undefined);
    return 'connection_request';
  }

  await actions.createExternalInvitation();
  return 'external_invitation';
}

const INTERNAL_ERROR_MESSAGES: ReadonlyArray<readonly [string, string]> = [
  ['ORGANIZATION_ALREADY_EXISTS', 'Esta empresa já possui cadastro no Hub.IA.'],
  ['ORGANIZATION_CNPJ_AMBIGUOUS', 'Encontramos mais de um cadastro para este CNPJ. Entre em contato com o suporte da Hub.IA.'],
  ['CONNECTION_ALREADY_EXISTS', 'Já existe uma solicitação ou parceria ativa com esta empresa.'],
  ['CONNECTION_SELF_FORBIDDEN', 'Não é possível solicitar conexão com a própria empresa.'],
  ['CONNECTION_TARGET_INVALID', 'A empresa selecionada não está disponível para conexão.'],
  ['INVALID_TARGET', 'A empresa selecionada não está disponível para conexão.'],
  ['CONNECTION_REQUEST_FORBIDDEN', 'Seu perfil não possui permissão para solicitar esta conexão.'],
  ['CONNECTION_RESPONSE_FORBIDDEN', 'Seu perfil não possui permissão para responder a esta solicitação.'],
  ['CONNECTION_REVIEW_FORBIDDEN', 'Seu perfil não possui permissão para revisar esta solicitação.'],
  ['IDENTITY_NOT_AUTHORIZED', 'Não foi possível confirmar sua identidade organizacional. Entre novamente e tente outra vez.'],
  ['INVALID_TENANT', 'Não foi possível confirmar sua identidade organizacional. Entre novamente e tente outra vez.'],
  ['FORBIDDEN', 'Você não possui permissão para realizar esta operação.'],
  ['INVITATION_ALREADY_PENDING', 'Já existe um convite pendente para esta empresa.'],
  ['INVITATION_ALREADY_EXISTS', 'Já existe um convite para esta empresa.'],
  ['ONBOARDING_INVITE_EXPIRED', 'Este convite expirou. Solicite um novo convite.'],
  ['INVITATION_EXPIRED', 'Este convite expirou. Solicite um novo convite.'],
  ['ONBOARDING_INVITE_ALREADY_USED', 'Este convite já foi utilizado.'],
  ['INVITATION_ALREADY_USED', 'Este convite já foi utilizado.'],
];

export function getUserFacingConnectionError(
  error: unknown,
  fallback = 'Não foi possível concluir a operação. Tente novamente.',
): string {
  const candidate = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown } | null;
  const diagnostic = [candidate?.code, candidate?.message, candidate?.details, candidate?.hint]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toUpperCase();

  const match = INTERNAL_ERROR_MESSAGES.find(([code]) => diagnostic.includes(code));
  return match?.[1] || fallback;
}

export function getCompanyLookupBlockedMessage(error: CompanyConnectionFlowBlockedError): string {
  switch (error.reason) {
    case 'lookup_in_progress':
      return 'Aguarde a conclusão da consulta da empresa.';
    case 'lookup_ambiguous':
      return 'Encontramos mais de um cadastro para este CNPJ. Entre em contato com o suporte da Hub.IA.';
    case 'lookup_failed':
      return 'Não foi possível confirmar se a empresa já possui cadastro. Tente consultar novamente.';
    case 'lookup_required':
      return 'Consulte um CNPJ válido antes de continuar.';
  }
}
