/**
 * Dynamic API Base URL resolver:
 * - If running under Angular CLI dev server on port 4200, points to http://localhost:3000/api/v1.
 * - If running under Docker/Portainer/Nginx production, uses relative '/api/v1' proxied to backend container.
 */
export const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined' && window.location.port === '4200') {
    return 'http://localhost:3000/api/v1';
  }
  return '/api/v1';
};
