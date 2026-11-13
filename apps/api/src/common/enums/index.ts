export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  CREDIT_MANAGER = 'CREDIT_MANAGER',
  CASHIER = 'CASHIER',
  AUDITOR = 'AUDITOR',
}

export enum CompanyStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum CashRegisterStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  SUSPENDED = 'SUSPENDED',
}

export enum CreditStatus {
  ACTIVE = 'ACTIVE',
  FROZEN = 'FROZEN',
  BLOCKED = 'BLOCKED',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
}

export enum TransactionType {
  PURCHASE_CHARGE = 'PURCHASE_CHARGE',
  PAYMENT_ABONO = 'PAYMENT_ABONO',
  VOID_REVERSAL = 'VOID_REVERSAL',
  LIMIT_ADJUSTMENT = 'LIMIT_ADJUSTMENT',
}

export enum TransactionStatus {
  APPROVED = 'APPROVED',
  VOIDED = 'VOIDED',
  REJECTED = 'REJECTED',
}

export enum IncreaseRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum ChannelType {
  WHATSAPP_BOT = 'WHATSAPP_BOT',
  WEB_PORTAL = 'WEB_PORTAL',
}

export enum ImportType {
  CLIENTS = 'CLIENTS',
  CREDIT_LIMITS = 'CREDIT_LIMITS',
  PAYMENTS = 'PAYMENTS',
}

