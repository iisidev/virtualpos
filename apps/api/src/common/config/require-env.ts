/**
 * Reads a mandatory environment variable. There are no fallbacks on purpose:
 * all credentials and connection settings must come from the deployment (.env / Portainer).
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    throw new Error(`Variable de entorno obligatoria no definida: ${name}`);
  }
  return value;
}

