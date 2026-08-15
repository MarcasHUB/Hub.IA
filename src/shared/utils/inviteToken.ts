const UUID_TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_TOKEN = /^[0-9a-f]{64}$/i;

function normalizeCandidate(value: string): string | null {
  const candidate = value.trim();
  if (HEX_TOKEN.test(candidate) || UUID_TOKEN.test(candidate)) return candidate.toLowerCase();
  return null;
}

export function extractInviteToken(input: string | null): string | null {
  if (!input) return null;

  let decoded = input.trim();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }

  const direct = normalizeCandidate(decoded);
  if (direct) return direct;

  try {
    const url = new URL(decoded, 'https://local.invalid');
    const fromQuery = normalizeCandidate(url.searchParams.get('token') || '');
    if (fromQuery) return fromQuery;
  } catch {
    // A entrada pode ser texto livre de um Safe Link.
  }

  const hexMatch = decoded.match(/(?:^|[^0-9a-f])([0-9a-f]{64})(?:[^0-9a-f]|$)/i);
  if (hexMatch) return hexMatch[1].toLowerCase();

  const uuidMatch = decoded.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  return uuidMatch?.[0].toLowerCase() || null;
}
