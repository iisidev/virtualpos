import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { getApiBaseUrl } from '../config/api.config';
import {
  AdminUser,
  CreateUserPayload,
  UpdateUserPayload,
  Company,
  CreateCompanyPayload,
  UpdateCompanyPayload,
  CatalogItem,
  CatalogCategory,
  CreateCatalogPayload,
  UpdateCatalogPayload,
  ClientProfile,
  CreateClientPayload,
  UpdateClientPayload,
} from '../models';

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private getHeaders(): HttpHeaders {
    const token = this.auth.token();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token || ''}`,
    });
  }

  // ================= COMPANY CRUD =================
  getCompanies(): Observable<Company[]> {
    return this.http.get<Company[]>(`${getApiBaseUrl()}/companies`, {
      headers: this.getHeaders(),
    });
  }

  getEmployerCompanies(): Observable<Company[]> {
    return this.http.get<Company[]>(`${getApiBaseUrl()}/companies/employers`, {
      headers: this.getHeaders(),
    });
  }

  getMerchantCompanies(): Observable<Company[]> {
    return this.http.get<Company[]>(`${getApiBaseUrl()}/companies/merchants`, {
      headers: this.getHeaders(),
    });
  }

  createCompany(payload: CreateCompanyPayload): Observable<Company> {
    return this.http.post<Company>(`${getApiBaseUrl()}/companies`, payload, {
      headers: this.getHeaders(),
    });
  }

  updateCompany(id: string, payload: UpdateCompanyPayload): Observable<Company> {
    return this.http.put<Company>(`${getApiBaseUrl()}/companies/${id}`, payload, {
      headers: this.getHeaders(),
    });
  }

  toggleCompanyStatus(id: string): Observable<Company> {
    return this.http.patch<Company>(`${getApiBaseUrl()}/companies/${id}/status`, {}, {
      headers: this.getHeaders(),
    });
  }

  // ================= USER CRUD (RBAC) =================
  getUsers(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(`${getApiBaseUrl()}/users`, {
      headers: this.getHeaders(),
    });
  }

  createUser(payload: CreateUserPayload): Observable<AdminUser> {
    return this.http.post<AdminUser>(`${getApiBaseUrl()}/users`, payload, {
      headers: this.getHeaders(),
    });
  }

  updateUser(id: string, payload: UpdateUserPayload): Observable<AdminUser> {
    return this.http.put<AdminUser>(`${getApiBaseUrl()}/users/${id}`, payload, {
      headers: this.getHeaders(),
    });
  }

  toggleUserStatus(id: string): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`${getApiBaseUrl()}/users/${id}/status`, {}, {
      headers: this.getHeaders(),
    });
  }

  // ================= CATALOG CRUD =================
  getCatalogs(category?: CatalogCategory): Observable<CatalogItem[]> {
    let url = `${getApiBaseUrl()}/catalogs`;
    if (category) {
      url += `?category=${category}`;
    }
    return this.http.get<CatalogItem[]>(url, {
      headers: this.getHeaders(),
    });
  }

  createCatalog(payload: CreateCatalogPayload): Observable<CatalogItem> {
    return this.http.post<CatalogItem>(`${getApiBaseUrl()}/catalogs`, payload, {
      headers: this.getHeaders(),
    });
  }

  updateCatalog(id: string, payload: UpdateCatalogPayload): Observable<CatalogItem> {
    return this.http.put<CatalogItem>(`${getApiBaseUrl()}/catalogs/${id}`, payload, {
      headers: this.getHeaders(),
    });
  }

  toggleCatalogStatus(id: string): Observable<CatalogItem> {
    return this.http.patch<CatalogItem>(`${getApiBaseUrl()}/catalogs/${id}/status`, {}, {
      headers: this.getHeaders(),
    });
  }

  // ================= CLIENT CRUD =================
  createClient(payload: CreateClientPayload): Observable<ClientProfile> {
    return this.http.post<ClientProfile>(`${getApiBaseUrl()}/clients`, payload, {
      headers: this.getHeaders(),
    });
  }

  updateClient(id: string, payload: UpdateClientPayload): Observable<ClientProfile> {
    return this.http.put<ClientProfile>(`${getApiBaseUrl()}/clients/${id}`, payload, {
      headers: this.getHeaders(),
    });
  }
}

