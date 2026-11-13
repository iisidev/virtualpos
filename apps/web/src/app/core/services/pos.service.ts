import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import {
  ClientProfile,
  VoucherDetails,
  AvailabilityTicket,
} from '../models';

export interface ChargePayload {
  client_id: string;
  merchant_company_id: string;
  cash_register_id: string;
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
  private readonly baseUrl = 'http://localhost:3000/api/v1';

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

  getRecentTransactions(cashRegisterId?: string): Observable<VoucherDetails[]> {
    const url = cashRegisterId
      ? `${this.baseUrl}/credit/transactions?cashRegisterId=${cashRegisterId}`
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
}
