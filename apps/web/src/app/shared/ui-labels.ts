const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Administrador',
  CREDIT_MANAGER: 'Gerente de Crédito',
  CASHIER: 'Cajero POS',
  AUDITOR: 'Auditor',
};

const CREDIT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Activo',
  FROZEN: 'Congelado',
  BLOCKED: 'Bloqueado',
};

const TRANSACTION_STATUS_LABELS: Record<string, string> = {
  APPROVED: 'Aprobado',
  VOIDED: 'Anulado',
};

const REQUEST_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
};

const BATCH_ACTION_LABELS: Record<string, string> = {
  CREATE: 'Nuevo',
  UPDATE: 'Actualización',
  ERROR: 'Error',
};

const COMPANY_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Activa',
  INACTIVE: 'Inactiva',
};

const CATALOG_CATEGORY_LABELS: Record<string, string> = {
  JOB_TITLE: 'Cargo / Puesto',
  GRADE_LEVEL: 'Grado salarial',
  CLASSIFICATION: 'Clasificación',
};

const CHANNEL_LABELS: Record<string, string> = {
  WHATSAPP_BOT: 'WhatsApp Bot',
  WEB_PORTAL: 'Portal Web',
  PORTAL: 'Portal Web',
  ADMIN_PORTAL: 'Portal Admin',
};

export function formatRoleLabel(role?: string | null): string {
  if (!role) return '';
  return ROLE_LABELS[role] ?? role;
}

export function formatCreditStatusLabel(status?: string | null): string {
  if (!status) return '';
  return CREDIT_STATUS_LABELS[status] ?? status;
}

export function formatTransactionStatusLabel(status?: string | null): string {
  if (!status) return '';
  return TRANSACTION_STATUS_LABELS[status] ?? status;
}

export function formatRequestStatusLabel(status?: string | null): string {
  if (!status) return '';
  return REQUEST_STATUS_LABELS[status] ?? status;
}

export function formatBatchActionLabel(action?: string | null): string {
  if (!action) return '';
  return BATCH_ACTION_LABELS[action] ?? action;
}

export function formatCompanyStatusLabel(status?: string | null): string {
  if (!status) return '';
  return COMPANY_STATUS_LABELS[status] ?? status;
}

export function formatCatalogCategoryLabel(category?: string | null): string {
  if (!category) return '';
  return CATALOG_CATEGORY_LABELS[category] ?? category;
}

export function formatChannelLabel(channel?: string | null): string {
  if (!channel) return '';
  return CHANNEL_LABELS[channel] ?? channel;
}
