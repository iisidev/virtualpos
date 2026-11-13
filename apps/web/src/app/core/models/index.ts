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

export interface VoucherDetails {
  transaction_id: string;
  authorization_code: string;
  voucher_number: string;
  external_invoice_number: string;
  created_at: string;
  status: 'APPROVED' | 'VOIDED' | 'REJECTED';
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

