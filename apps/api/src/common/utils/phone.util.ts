/**
 * Extracts phone digits from raw values, WhatsApp JIDs (`50587531402:12@s.whatsapp.net`),
 * or channel-prefixed targets (`whatsapp:+50587531402`).
 */
export function extractPhoneDigits(raw: string): string {
  const withoutPrefix = (raw || '').trim().replace(/^whatsapp:/i, '');
  const userPart = withoutPrefix.split('@')[0].split(':')[0];
  return userPart.replace(/\D/g, '');
}

/**
 * Normalizes a stored or input phone number into E.164 format (`+<digits>`).
 * Local 8-digit numbers require `defaultCountryCode`; longer numbers are treated
 * as already containing a country code. Returns null if invalid or incomplete.
 */
export function toWhatsAppE164(raw: string, defaultCountryCode?: string): string | null {
  const digits = extractPhoneDigits(raw);
  if (digits.length < 8) return null;

  if (digits.length <= 8) {
    const cc = (defaultCountryCode || '').replace(/\D/g, '');
    return cc ? `+${cc}${digits}` : null;
  }

  return `+${digits}`;
}

