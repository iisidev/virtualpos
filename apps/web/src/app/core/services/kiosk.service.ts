import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { KioskDisplayData } from '../models';

@Injectable({
  providedIn: 'root',
})
export class KioskService {
  private readonly baseUrl = 'http://localhost:3000/api/v1/kiosk';

  constructor(private readonly http: HttpClient) {}

  getProfile(query: string): Observable<KioskDisplayData> {
    return this.http.get<KioskDisplayData>(
      `${this.baseUrl}/query/${encodeURIComponent(query)}`,
    );
  }
}
