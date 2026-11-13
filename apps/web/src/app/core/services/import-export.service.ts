import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { getApiBaseUrl } from '../config/api.config';

export interface DryRunResult {
  import_type: string;
  total_rows: number;
  valid_rows: number;
  new_count: number;
  update_count: number;
  error_count: number;
  errors: Array<{ row: number; field: string; message: string }>;
  preview_data: Array<{
    row: number;
    action: 'CREATE' | 'UPDATE' | 'ERROR';
    identifier: string;
    description: string;
    details: Record<string, string | number>;
  }>;
}

export interface ImportBatchLog {
  id: string;
  file_name: string;
  import_type: string;
  total_rows: number;
  successful_rows: number;
  error_rows: number;
  created_at: string;
  executed_by?: { full_name: string; username: string };
}

@Injectable({
  providedIn: 'root',
})
export class ImportExportService {
  private readonly baseUrl = `${getApiBaseUrl()}/import-export`;

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
  ) {}

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.auth.token() || ''}`,
    });
  }

  downloadTemplate(type: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/templates/${type.toUpperCase()}`, {
      headers: this.getHeaders(),
      responseType: 'blob',
    });
  }

  dryRun(type: string, rows: Array<Record<string, string | number>>): Observable<DryRunResult> {
    return this.http.post<DryRunResult>(
      `${this.baseUrl}/dry-run`,
      { type: type.toUpperCase(), rows },
      { headers: this.getHeaders() },
    );
  }

  commit(
    type: string,
    fileName: string,
    rows: Array<Record<string, string | number>>,
  ): Observable<ImportBatchLog> {
    return this.http.post<ImportBatchLog>(
      `${this.baseUrl}/commit`,
      { type: type.toUpperCase(), file_name: fileName, rows },
      { headers: this.getHeaders() },
    );
  }

  getLogs(): Observable<ImportBatchLog[]> {
    return this.http.get<ImportBatchLog[]>(`${this.baseUrl}/logs`, {
      headers: this.getHeaders(),
    });
  }
}

