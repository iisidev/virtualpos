export type AgentAccessMode = 'VIP_FULL_AGENT' | 'CORPORATE_CREDIT_ONLY' | 'UNLINKED';

/**
 * Determines whether a client's classification ("Tipificación de Cliente") grants VIP privileges.
 * Matches standalone or phrase-level "VIP" (e.g. "VIP", "Cliente VIP") while rejecting explicit negations.
 */
export function isVipClassification(classification?: string | null): boolean {
  const normalized = (classification || '').trim().toUpperCase();
  if (!normalized) return false;
  if (normalized === 'VIP') return true;
  return /\bVIP\b/.test(normalized) && !/\bNO[\s_-]*VIP\b/.test(normalized);
}

export function resolveAgentAccessMode(linked: boolean, classification?: string | null): AgentAccessMode {
  if (!linked) return 'UNLINKED';
  return isVipClassification(classification) ? 'VIP_FULL_AGENT' : 'CORPORATE_CREDIT_ONLY';
}
