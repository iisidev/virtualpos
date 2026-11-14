export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  CREDIT_MANAGER = 'CREDIT_MANAGER',
  CASHIER = 'CASHIER',
  AUDITOR = 'AUDITOR',
}

export interface User {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  company_id?: string | null;
}

export interface AdminUser {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  company_id?: string | null;
  company_name?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface CreateUserPayload {
  username: string;
  password: string;
  full_name: string;
  role: UserRole;
  company_id?: string | null;
  is_active?: boolean;
}

export interface UpdateUserPayload {
  username?: string;
  password?: string;
  full_name?: string;
  role?: UserRole;
  company_id?: string | null;
  is_active?: boolean;
}

export type CashRegisterStatus = 'OPEN' | 'CLOSED' | 'SUSPENDED';

export interface CashRegister {
  id: string;
  company_id: string;
  terminal_code: string;
  name: string;
  location: string;
  status: CashRegisterStatus;
  created_at?: string;
  company?: Company;
}

export interface CreateCashRegisterPayload {
  company_id: string;
  terminal_code: string;
  name: string;
  location?: string;
  status?: CashRegisterStatus;
}

export interface UpdateCashRegisterPayload {
  company_id?: string;
  terminal_code?: string;
  name?: string;
  location?: string;
  status?: CashRegisterStatus;
}

export interface Company {
  id: string;
  code: string;
  name: string;
  ruc: string;
  address: string;
  phone: string;
  is_employer: boolean;
  is_merchant: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  cash_registers?: CashRegister[];
}

export interface CreateCompanyPayload {
  code: string;
  name: string;
  ruc: string;
  address?: string;
  phone?: string;
  is_employer?: boolean;
  is_merchant?: boolean;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface UpdateCompanyPayload {
  code?: string;
  name?: string;
  ruc?: string;
  address?: string;
  phone?: string;
  is_employer?: boolean;
  is_merchant?: boolean;
  status?: 'ACTIVE' | 'INACTIVE';
}

export enum CatalogCategory {
  JOB_TITLE = 'JOB_TITLE',
  GRADE_LEVEL = 'GRADE_LEVEL',
  CLASSIFICATION = 'CLASSIFICATION',
}

export interface CatalogItem {
  id: string;
  category: CatalogCategory;
  code: string;
  name: string;
  description: string;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCatalogPayload {
  category: CatalogCategory;
  code: string;
  name: string;
  description?: string;
  order_index?: number;
}

export interface UpdateCatalogPayload {
  code?: string;
  name?: string;
  description?: string;
  order_index?: number;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

export interface ClientProfile {
  id: string;
  employer_company_id: string;
  employer_name: string;
  employee_code: string;
  national_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  job_title: string;
  grade_level: string;
  classification: string;
  salary: string;
  whatsapp_phone: string;
  birth_date?: string | null;
  approved_limit: string;
  used_balance: string;
  available_balance: string;
  consumption_percentage: number;
  credit_status: 'ACTIVE' | 'FROZEN' | 'BLOCKED' | 'PENDING_APPROVAL';
  status_color_class: 'emerald' | 'amber' | 'red';
  created_at: string;
}

export interface CreateClientPayload {
  employer_company_id: string;
  employee_code: string;
  national_id: string;
  first_name: string;
  last_name: string;
  job_title: string;
  grade_level?: string;
  classification?: string;
  salary?: number;
  whatsapp_phone: string;
  birth_date?: string;
  approved_limit: number;
  credit_status?: 'ACTIVE' | 'FROZEN' | 'BLOCKED' | 'PENDING_APPROVAL';
}

export interface UpdateClientPayload {
  employer_company_id?: string;
  employee_code?: string;
  national_id?: string;
  first_name?: string;
  last_name?: string;
  job_title?: string;
  grade_level?: string;
  classification?: string;
  salary?: number;
  whatsapp_phone?: string;
  birth_date?: string;
  approved_limit?: number;
  credit_status?: 'ACTIVE' | 'FROZEN' | 'BLOCKED' | 'PENDING_APPROVAL';
}

export interface VoucherDetails {
  transaction_id: string;
  authorization_code: string;
  voucher_number: string;
  external_invoice_number: string;
  created_at: string;
  status: 'APPROVED' | 'VOIDED' | 'REJECTED';
  transaction_type?: 'PURCHASE_CHARGE' | 'PAYMENT_ABONO' | 'VOID_REVERSAL' | 'LIMIT_ADJUSTMENT';
  amount: string;
  currency: string;
  previous_available_balance: string;
  new_available_balance: string;
  client: {
    id: string;
    full_name: string;
    masked_national_id: string;
    employee_code: string;
    employer_name: string;
  };
  merchant: {
    id: string;
    name: string;
    ruc: string;
  };
  terminal: {
    terminal_code: string;
    name: string;
    location: string;
  };
  cashier: {
    id: string;
    full_name: string;
    username: string;
  };
  signature_hash: string;
  verification_qr_payload: string;
  whatsapp_notification?: {
    attempted: boolean;
    ok: boolean;
    phone: string | null;
    error?: string;
  };
}

export interface AvailabilityTicket {
  ticket_type: 'CONSULTA_DISPONIBILIDAD';
  printed_at: string;
  client: {
    full_name: string;
    masked_national_id: string;
    employee_code: string;
    employer_name: string;
  };
  approved_limit: string;
  used_balance: string;
  available_balance: string;
  credit_status: string;
  currency: string;
}

export interface KioskDisplayData {
  client_id: string;
  full_name: string;
  masked_national_id: string;
  employee_code: string;
  employer_name: string;
  job_title: string;
  approved_limit: string;
  available_balance: string;
  credit_status: string;
  status_color_class: 'emerald' | 'amber' | 'red';
  last_purchase: {
    date: string | null;
    amount: string | null;
    merchant_name: string | null;
  } | null;
  whatsapp_qr_url: string;
  auto_reset_seconds: number;
}
