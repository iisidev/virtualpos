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
  PENDING_APPROVAL: 'Pendiente de Aprobación',
};

const CASH_REGISTER_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Abierta',
  CLOSED: 'Cerrada',
  SUSPENDED: 'Suspendida',
};

const TRANSACTION_STATUS_LABELS: Record<string, string> = {
  APPROVED: 'Aprobado',
  VOIDED: 'Anulado',
  REJECTED: 'Rechazado',
};

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  PURCHASE_CHARGE: 'Compra POS',
  PAYMENT_ABONO: 'Abono / Planilla',
  VOID_REVERSAL: 'Anulación',
  LIMIT_ADJUSTMENT: 'Ajuste de Límite',
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

export function formatCashRegisterStatusLabel(status?: string | null): string {
  if (!status) return '';
  return CASH_REGISTER_STATUS_LABELS[status] ?? status;
}

export function formatTransactionTypeLabel(type?: string | null): string {
  if (!type) return '';
  return TRANSACTION_TYPE_LABELS[type] ?? type;
}
