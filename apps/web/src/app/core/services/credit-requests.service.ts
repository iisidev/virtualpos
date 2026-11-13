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
    first_name: string;
    last_name: string;
    national_id: string;
    employee_code: string;
    employer_company?: { name: string };
  };
  reviewer?: {
    full_name: string;
    username: string;
  };
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

  findAll(status?: string): Observable<CreditRequestItem[]> {
    const url = status ? `${this.baseUrl}?status=${status}` : this.baseUrl;
    return this.http.get<CreditRequestItem[]>(url, { headers: this.getHeaders() });
  }

  review(id: string, action: 'APPROVE' | 'REJECT', notes: string): Observable<CreditRequestItem> {
    return this.http.patch<CreditRequestItem>(
      `${this.baseUrl}/${id}/review`,
      { action, review_notes: notes },
      { headers: this.getHeaders() },
    );
  }
}

