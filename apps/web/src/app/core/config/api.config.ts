/**
 * Dynamic API Base URL resolver:
 * - If running under Angular CLI dev server on port 4200, points to http://<hostname>:22300/api/v1.
 * - In production (Docker/Nginx/Portainer), uses relative '/api/v1' which is proxied by Nginx to the NestJS backend container.
 */
export const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    if (window.location.port === '4200') {
      const host = window.location.hostname || 'localhost';
      return `http://${host}:22300/api/v1`;
    }
  }
  return '/api/v1';
};
