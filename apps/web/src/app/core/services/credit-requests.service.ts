import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { getApiBaseUrl } from '../config/api.config';

export interface CreditRequestItem {
  id: string;
  client_id: string;
  current_limit: string;
  requested_limit: string;
  reason: string;
  channel: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
  reviewed_at?: string | null;
  review_notes?: string | null;
  client?: {
    id?: string;
    first_name: string;
    last_name: string;
    national_id: string;
    employee_code: string;
    whatsapp_phone?: string;
    employer_company_id?: string;
    employer_company?: { id?: string; name: string };
  };
  reviewer?: {
    full_name: string;
    username: string;
  };
  whatsapp_notification?: {
    attempted: boolean;
    ok: boolean;
    phone: string | null;
    error?: string;
  };
}

export interface CreateCreditRequestPayload {
  client_id: string;
  requested_limit: number;
  reason: string;
}

@Injectable({
  providedIn: 'root',
})
export class CreditRequestsService {
  private readonly baseUrl = `${getApiBaseUrl()}/credit-requests`;

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
  ) {}

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.auth.token() || ''}`,
    });
  }

  findAll(filters?: {
    status?: string;
    employerCompanyId?: string;
    search?: string;
  }): Observable<CreditRequestItem[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.employerCompanyId) params.set('employerCompanyId', filters.employerCompanyId);
    if (filters?.search) params.set('search', filters.search);
    const qs = params.toString();
    const url = qs ? `${this.baseUrl}?${qs}` : this.baseUrl;
    return this.http.get<CreditRequestItem[]>(url, { headers: this.getHeaders() });
  }

  create(payload: CreateCreditRequestPayload): Observable<CreditRequestItem> {
    return this.http.post<CreditRequestItem>(this.baseUrl, payload, {
      headers: this.getHeaders(),
    });
  }

  review(
    id: string,
    action: 'APPROVE' | 'REJECT',
    notes: string,
    approvedLimit?: number,
  ): Observable<CreditRequestItem> {
    const body: { action: 'APPROVE' | 'REJECT'; review_notes: string; approved_limit?: number } = {
      action,
      review_notes: notes,
    };
    if (action === 'APPROVE' && approvedLimit !== undefined && approvedLimit > 0) {
      body.approved_limit = approvedLimit;
    }
    return this.http.patch<CreditRequestItem>(
      `${this.baseUrl}/${id}/review`,
      body,
      { headers: this.getHeaders() },
    );
  }
}

