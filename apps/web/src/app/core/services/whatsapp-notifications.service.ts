import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { getApiBaseUrl } from '../config/api.config';

export interface NotificationSendResult {
  client_id: string;
  full_name: string;
  phone: string | null;
  ok: boolean;
  error?: string;
}

export interface NotificationBulkJob {
  id: string;
  status: 'RUNNING' | 'COMPLETED';
  total: number;
  processed: number;
  sent: number;
  failed: number;
  errors: NotificationSendResult[];
  started_at: string;
  finished_at: string | null;
}

@Injectable({ providedIn: 'root' })
export class WhatsappNotificationsService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private get base(): string {
    return `${getApiBaseUrl()}/notifications/whatsapp`;
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.token() || ''}` });
  }

  getPreview(): Observable<{ message: string }> {
    return this.http.get<{ message: string }>(`${this.base}/welcome/preview`, { headers: this.headers() });
  }

  sendToClient(clientId: string): Observable<NotificationSendResult> {
    return this.http.post<NotificationSendResult>(
      `${this.base}/welcome/client/${clientId}`,
      {},
      { headers: this.headers() },
    );
  }

  sendBulk(employerCompanyId?: string): Observable<NotificationBulkJob> {
    return this.http.post<NotificationBulkJob>(
      `${this.base}/welcome/bulk`,
      employerCompanyId ? { employer_company_id: employerCompanyId } : {},
      { headers: this.headers() },
    );
  }

  getJob(jobId: string): Observable<NotificationBulkJob> {
    return this.http.get<NotificationBulkJob>(`${this.base}/jobs/${jobId}`, { headers: this.headers() });
  }
}

