import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import {
  AvailabilityTicket,
  CashRegister,
  CashRegisterStatus,
  ClientProfile,
  Company,
  VoucherDetails,
} from '../models';
import { getApiBaseUrl } from '../config/api.config';

export interface ChargePayload {
  client_id: string;
  merchant_company_id?: string;
  cash_register_id?: string;
  amount: number;
  external_invoice_number: string;
  idempotency_key: string;
  pin?: string;
  notes?: string;
}

@Injectable({
  providedIn: 'root',
})
export class PosService {
  private readonly baseUrl = getApiBaseUrl();

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
  ) {}

  private getHeaders(): HttpHeaders {
    const token = this.auth.token();
    return new HttpHeaders({
      Authorization: `Bearer ${token || ''}`,
    });
  }

  scanClient(query: string): Observable<ClientProfile> {
    return this.http.get<ClientProfile>(
      `${this.baseUrl}/pos/scan/${encodeURIComponent(query)}`,
      { headers: this.getHeaders() },
    );
  }

  getAvailabilityTicket(clientId: string): Observable<AvailabilityTicket> {
    return this.http.get<AvailabilityTicket>(
      `${this.baseUrl}/pos/availability-ticket/${clientId}`,
      { headers: this.getHeaders() },
    );
  }

  checkout(payload: ChargePayload): Observable<VoucherDetails> {
    return this.http.post<VoucherDetails>(
      `${this.baseUrl}/pos/checkout`,
      payload,
      { headers: this.getHeaders() },
    );
  }

  getVoucher(transactionId: string): Observable<VoucherDetails> {
    return this.http.get<VoucherDetails>(
      `${this.baseUrl}/credit/transactions/${transactionId}/voucher`,
      { headers: this.getHeaders() },
    );
  }

  getRecentTransactions(filters?: {
    cashRegisterId?: string;
    merchantCompanyId?: string;
    limit?: number;
  }): Observable<VoucherDetails[]> {
    const params = new URLSearchParams();
    if (filters?.cashRegisterId) params.set('cashRegisterId', filters.cashRegisterId);
    if (filters?.merchantCompanyId) params.set('merchantCompanyId', filters.merchantCompanyId);
    if (filters?.limit) params.set('limit', String(filters.limit));
    const qs = params.toString();
    const url = qs
      ? `${this.baseUrl}/credit/transactions?${qs}`
      : `${this.baseUrl}/credit/transactions`;
    return this.http.get<VoucherDetails[]>(url, { headers: this.getHeaders() });
  }

  voidTransaction(transactionId: string, void_reason: string): Observable<VoucherDetails> {
    return this.http.post<VoucherDetails>(
      `${this.baseUrl}/credit/transactions/${transactionId}/void`,
      { void_reason },
      { headers: this.getHeaders() },
    );
  }

  getMerchantCompanies(): Observable<Company[]> {
    return this.http.get<Company[]>(`${this.baseUrl}/companies/merchants`, {
      headers: this.getHeaders(),
    });
  }

  getCashRegisters(companyId?: string, onlyActiveCompanies = true): Observable<CashRegister[]> {
    const params = new URLSearchParams();
    if (companyId) params.set('companyId', companyId);
    if (onlyActiveCompanies) params.set('onlyActiveCompanies', 'true');
    const qs = params.toString();
    const url = qs
      ? `${this.baseUrl}/cash-registers?${qs}`
      : `${this.baseUrl}/cash-registers`;
    return this.http.get<CashRegister[]>(url, { headers: this.getHeaders() });
  }

  updateCashRegisterStatus(id: string, status: CashRegisterStatus): Observable<CashRegister> {
    return this.http.patch<CashRegister>(
      `${this.baseUrl}/cash-registers/${id}/status`,
      { status },
      { headers: this.getHeaders() },
    );
  }
}

