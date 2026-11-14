import { Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { AdminService } from '../../core/services/admin.service';
import {
  ClientProfile,
  Company,
  CatalogItem,
  CatalogCategory,
  CreateClientPayload,
  UpdateClientPayload,
} from '../../core/models';
import { getApiBaseUrl } from '../../core/config/api.config';
import { StatusBannerComponent } from '../../shared/status-banner.component';

@Component({
  selector: 'app-clients-list',
  standalone: true,
  imports: [CommonModule, FormsModule, StatusBannerComponent],
  template: `
    <div class="clients-page">
      <!-- Bento Header -->
      <div class="page-header bento-card">
        <div>
          <h1><i class="users icon" aria-hidden="true"></i> Directorio de Clientes y Líneas de Crédito</h1>
          <p>Control de perfiles de colaboradores, saldos, límites asignados y bloqueos preventivos</p>
        </div>

        <button type="button" class="ui-btn primary-btn" (click)="openClientModal()">
          <i class="user plus icon" aria-hidden="true"></i> Registrar Nuevo Cliente
        </button>
      </div>

      <app-status-banner
        [message]="feedbackMessage"
        [type]="feedbackType"
        (dismiss)="feedbackMessage = ''"
      ></app-status-banner>

      <!-- Filters Ribbon (12 Cols) -->
      <div class="bento-card filter-card">
        <div class="filter-group flex-2">
          <label for="client-search">Búsqueda Rápida:</label>
          <div class="search-input-wrap">
            <i class="search icon" aria-hidden="true"></i>
            <input
              id="client-search"
              type="text"
              class="ui-input"
              [(ngModel)]="searchTerm"
              (input)="loadClients()"
              placeholder="Cédula, carnet, teléfono o nombre..."
            />
          </div>
        </div>

        <div class="filter-group flex-1">
          <label for="client-filter-company">Empresa Empleadora:</label>
          <select id="client-filter-company" class="ui dropdown select-box" [(ngModel)]="filterCompany" (change)="loadClients()">
            <option value="">Todas las Empresas</option>
            <option *ngFor="let c of companies" [value]="c.id">{{ c.name }}</option>
          </select>
        </div>

        <div class="filter-group flex-1">
          <label for="client-filter-class">Clasificación:</label>
          <select id="client-filter-class" class="ui dropdown select-box" [(ngModel)]="filterClassification" (change)="loadClients()">
            <option value="">Todas</option>
            <option value="PLANTA">PLANTA</option>
            <option value="CONFIANZA">CONFIANZA</option>
            <option value="VIP">VIP</option>
            <option value="TEMPORAL">TEMPORAL</option>
          </select>
        </div>

        <div class="filter-group flex-1">
          <label for="client-filter-status">Estado Crediticio:</label>
          <select id="client-filter-status" class="ui dropdown select-box" [(ngModel)]="filterStatus" (change)="loadClients()">
            <option value="">Todos</option>
            <option value="ACTIVE">ACTIVO</option>
            <option value="FROZEN">CONGELADO</option>
            <option value="BLOCKED">BLOQUEADO</option>
          </select>
        </div>
      </div>

      <!-- Clients Bento Table -->
      <div class="bento-card table-card">
        <div *ngIf="loadingClients && clients.length === 0" class="ui-state-box" role="status">
          <i class="spinner loading icon" aria-hidden="true"></i>
          <span>Cargando directorio de clientes...</span>
        </div>

        <div *ngIf="errorClients && clients.length === 0" class="ui-banner error" role="alert">
          <span class="ui-banner-msg">
            <i class="exclamation triangle icon" aria-hidden="true"></i> {{ errorClients }}
          </span>
          <button type="button" class="ui-btn primary-btn" (click)="loadClients()">Reintentar</button>
        </div>

        <div *ngIf="!errorClients && (clients.length > 0 || !loadingClients)" class="table-responsive">
          <table class="ui-table">
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Cédula / Carnet</th>
                <th>Empresa Empleadora</th>
                <th>Cargo / Nivel</th>
                <th class="text-right">Salario</th>
                <th class="text-right">Límite Autorizado</th>
                <th class="text-right">Consumido</th>
                <th class="text-right">Disponible</th>
                <th>Estado</th>
                <th class="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let c of clients">
                <td>
                  <strong>{{ c.full_name }}</strong>
                  <div class="sub-text ui-mono">
                    <i class="whatsapp icon wa-inline-icon" aria-hidden="true"></i> {{ c.whatsapp_phone }}
                  </div>
                </td>
                <td>
                  <div class="ui-mono">{{ c.national_id }}</div>
                  <span class="carnet-pill ui-mono">{{ c.employee_code }}</span>
                </td>
                <td>{{ c.employer_name }}</td>
                <td>
                  <div>{{ c.job_title }}</div>
                  <span class="class-pill">{{ c.classification }} ({{ c.grade_level }})</span>
                </td>
                <td class="ui-amount-cell">
                  <span class="salary-tag">{{ c.salary }}</span>
                </td>
                <td class="ui-amount-cell"><strong>C$ {{ formatNumber(c.approved_limit) }}</strong></td>
                <td class="ui-amount-cell">C$ {{ formatNumber(c.used_balance) }}</td>
                <td class="ui-amount-cell">
                  <strong
                    [class.ui-credit-danger]="c.status_color_class === 'red'"
                    [class.ui-credit-warning]="c.status_color_class === 'amber'"
                    [class.ui-credit-ok]="c.status_color_class !== 'red' && c.status_color_class !== 'amber'"
                  >
                    C$ {{ formatNumber(c.available_balance) }}
                  </strong>
                </td>
                <td>
                  <span
                    class="badge-status"
                    [ngClass]="{
                      active: c.credit_status === 'ACTIVE' && c.status_color_class !== 'amber',
                      amber: c.status_color_class === 'amber',
                      blocked: c.credit_status !== 'ACTIVE'
                    }"
                  >
                    {{ c.credit_status }}
                  </span>
                </td>
                <td class="text-right">
                  <button
                    type="button"
                    class="icon-btn"
                    (click)="openClientModal(c)"
                    title="Editar Perfil"
                    [attr.aria-label]="'Editar perfil de ' + c.full_name"
                  >
                    <i class="edit outline icon" aria-hidden="true"></i>
                  </button>
                  <button
                    type="button"
                    *ngIf="c.credit_status === 'ACTIVE'"
                    class="icon-btn danger"
                    (click)="toggleStatus(c, 'BLOCKED')"
                    title="Bloquear Línea de Crédito"
                    [attr.aria-label]="'Bloquear línea de crédito de ' + c.full_name"
                  >
                    <i class="lock icon" aria-hidden="true"></i>
                  </button>
                  <button
                    type="button"
                    *ngIf="c.credit_status !== 'ACTIVE'"
                    class="icon-btn success"
                    (click)="toggleStatus(c, 'ACTIVE')"
                    title="Reactivar Línea de Crédito"
                    [attr.aria-label]="'Reactivar línea de crédito de ' + c.full_name"
                  >
                    <i class="unlock icon" aria-hidden="true"></i>
                  </button>
                </td>
              </tr>
              <tr *ngIf="clients.length === 0">
                <td colspan="10" class="empty-state">
                  <div>No se encontraron clientes con los filtros indicados.</div>
                  <button
                    *ngIf="hasActiveFilters()"
                    type="button"
                    class="ui-btn secondary-btn empty-reset-btn"
                    (click)="clearFilters()"
                  >
                    Limpiar filtros
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- MODAL: CREAR / EDITAR CLIENTE -->
      <div
        *ngIf="showModal"
        class="modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-modal-title"
        (click)="!saving && closeModal()"
      >
        <div class="bento-card modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2 id="client-modal-title">{{ editingClientId ? 'Editar Perfil de Cliente' : 'Registrar Nuevo Cliente / Colaborador' }}</h2>
            <button type="button" class="close-btn" aria-label="Cerrar ventana" (click)="closeModal()">&times;</button>
          </div>

          <div *ngIf="modalError" class="ui-banner error modal-error-banner" role="alert">
            <span class="ui-banner-msg">
              <i class="exclamation circle icon" aria-hidden="true"></i> {{ modalError }}
            </span>
          </div>

          <form (ngSubmit)="saveClient()" class="modal-form">
            <!-- Row 1: Identification -->
            <div class="form-row">
              <div class="form-group flex-1">
                <label for="client-national-id">Cédula de Identidad *</label>
                <input
                  id="client-national-id"
                  type="text"
                  class="form-input"
                  [(ngModel)]="clientForm.national_id"
                  name="national_id"
                  placeholder="001-121092-0000X"
                  required
                />
              </div>
              <div class="form-group flex-1">
                <label for="client-employee-code">Código de Carnet / Empleado *</label>
                <input
                  id="client-employee-code"
                  type="text"
                  class="form-input"
                  [(ngModel)]="clientForm.employee_code"
                  name="employee_code"
                  placeholder="EMP-8920"
                  required
                />
              </div>
            </div>

            <!-- Row 2: Names -->
            <div class="form-row">
              <div class="form-group flex-1">
                <label for="client-first-name">Nombres *</label>
                <input
                  id="client-first-name"
                  type="text"
                  class="form-input"
                  [(ngModel)]="clientForm.first_name"
                  name="first_name"
                  placeholder="Primer y segundo nombre"
                  required
                />
              </div>
              <div class="form-group flex-1">
                <label for="client-last-name">Apellidos *</label>
                <input
                  id="client-last-name"
                  type="text"
                  class="form-input"
                  [(ngModel)]="clientForm.last_name"
                  name="last_name"
                  placeholder="Primer y segundo apellido"
                  required
                />
              </div>
            </div>

            <!-- Row 3: Company & Job -->
            <div class="form-row">
              <div class="form-group flex-1">
                <label for="client-employer-company">Empresa Empleadora *</label>
                <select id="client-employer-company" class="form-input" [(ngModel)]="clientForm.employer_company_id" name="employer_company_id" required>
                  <option value="" disabled>Seleccione empresa...</option>
                  <option *ngFor="let c of companies" [value]="c.id">
                    {{ c.name }} ({{ c.code }})
                  </option>
                </select>
              </div>

              <div class="form-group flex-1">
                <label for="client-job-title">Cargo / Puesto *</label>
                <select id="client-job-title" class="form-input" [(ngModel)]="clientForm.job_title" name="job_title" required>
                  <option value="" disabled>Seleccione cargo...</option>
                  <option *ngFor="let j of jobTitles" [value]="j.name">{{ j.name }}</option>
                </select>
              </div>
            </div>

            <!-- Row 4: Grade & Classification -->
            <div class="form-row">
              <div class="form-group flex-1">
                <label for="client-grade-level">Grado Salarial</label>
                <select id="client-grade-level" class="form-input" [(ngModel)]="clientForm.grade_level" name="grade_level">
                  <option *ngFor="let g of gradeLevels" [value]="g.code">{{ g.name }}</option>
                </select>
              </div>

              <div class="form-group flex-1">
                <label for="client-classification">Tipificación de Cliente</label>
                <select id="client-classification" class="form-input" [(ngModel)]="clientForm.classification" name="classification">
                  <option value="PLANTA">PLANTA</option>
                  <option value="CONFIANZA">CONFIANZA</option>
                  <option value="VIP">VIP</option>
                  <option value="TEMPORAL">TEMPORAL</option>
                </select>
              </div>
            </div>

            <!-- Row 5: Financials & WhatsApp -->
            <div class="form-row">
              <div class="form-group flex-1">
                <label for="client-approved-limit">Límite de Crédito Aprobado (C$) *</label>
                <input
                  id="client-approved-limit"
                  type="number"
                  step="0.01"
                  min="0"
                  class="form-input text-bold"
                  [(ngModel)]="clientForm.approved_limit"
                  name="approved_limit"
                  placeholder="5000.00"
                  required
                />
              </div>

              <div class="form-group flex-1">
                <label for="client-salary">Salario Mensual Bruto (C$)</label>
                <input
                  id="client-salary"
                  type="number"
                  step="0.01"
                  min="0"
                  class="form-input"
                  [(ngModel)]="clientForm.salary"
                  name="salary"
                  placeholder="25000.00"
                />
              </div>
            </div>

            <!-- Row 6: Phone & Birthdate -->
            <div class="form-row">
              <div class="form-group flex-1">
                <label for="client-whatsapp-phone">Teléfono WhatsApp (E.164) *</label>
                <input
                  id="client-whatsapp-phone"
                  type="text"
                  class="form-input"
                  [(ngModel)]="clientForm.whatsapp_phone"
                  name="whatsapp_phone"
                  placeholder="50588888888"
                  required
                />
              </div>

              <div class="form-group flex-1">
                <label for="client-birth-date">Fecha de Nacimiento (YYYY-MM-DD)</label>
                <input
                  id="client-birth-date"
                  type="date"
                  class="form-input"
                  [(ngModel)]="clientForm.birth_date"
                  name="birth_date"
                />
              </div>
            </div>

            <div class="modal-actions">
              <button type="button" class="ui-btn secondary-btn" (click)="closeModal()" [disabled]="saving">
                Cancelar
              </button>
              <button type="submit" class="ui-btn primary-btn" [disabled]="saving">
                {{ saving ? 'Guardando...' : (editingClientId ? 'Actualizar Cliente' : 'Guardar Cliente') }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- MODAL: CAMBIO DE ESTADO -->
      <div
        *ngIf="pendingStatusChange"
        class="modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-status-modal-title"
        (click)="!updatingStatus && closeStatusModal()"
      >
        <div class="bento-card modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2 id="client-status-modal-title">
              {{ pendingStatusChange.nextStatus === 'BLOCKED' ? 'Bloquear Línea de Crédito' : 'Reactivar Línea de Crédito' }}
            </h2>
            <button type="button" class="close-btn" aria-label="Cerrar ventana" (click)="closeStatusModal()">&times;</button>
          </div>

          <form (ngSubmit)="confirmStatusChange()" class="modal-form">
            <p class="sub-text">
              Colaborador: <strong>{{ pendingStatusChange.client.full_name }}</strong>
              ({{ pendingStatusChange.client.national_id }})
            </p>

            <div class="form-group">
              <label for="client-status-reason">Motivo del cambio de estado *</label>
              <textarea
                id="client-status-reason"
                rows="3"
                class="form-input"
                [(ngModel)]="statusReason"
                name="statusReason"
                placeholder="Detalle la razón operativa o de riesgo..."
                required
              ></textarea>
            </div>

            <div *ngIf="statusError" class="ui-banner error" role="alert">
              <span class="ui-banner-msg">
                <i class="exclamation circle icon" aria-hidden="true"></i> {{ statusError }}
              </span>
            </div>

            <div class="modal-actions">
              <button type="button" class="ui-btn secondary-btn" (click)="closeStatusModal()" [disabled]="updatingStatus">
                Cancelar
              </button>
              <button
                type="submit"
                class="ui-btn primary-btn"
                [disabled]="updatingStatus || !statusReason.trim()"
              >
                {{ updatingStatus ? 'Actualizando...' : 'Confirmar Cambio' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styleUrl: './clients-list.component.css',
})
export class ClientsListComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly adminService = inject(AdminService);

  clients: ClientProfile[] = [];
  companies: Company[] = [];
  jobTitles: CatalogItem[] = [];
  gradeLevels: CatalogItem[] = [];

  searchTerm = '';
  filterCompany = '';
  filterClassification = '';
  filterStatus = '';

  loadingClients = false;
  errorClients = '';
  feedbackMessage = '';
  feedbackType: 'success' | 'error' = 'success';

  // Modal
  showModal = false;
  editingClientId: string | null = null;
  saving = false;
  modalError = '';

  pendingStatusChange: { client: ClientProfile; nextStatus: string } | null = null;
  statusReason = '';
  updatingStatus = false;
  statusError = '';

  clientForm: {
    employer_company_id: string;
    employee_code: string;
    national_id: string;
    first_name: string;
    last_name: string;
    job_title: string;
    grade_level: string;
    classification: string;
    salary?: number;
    whatsapp_phone: string;
    birth_date?: string;
    approved_limit: number;
  } = {
    employer_company_id: '',
    employee_code: '',
    national_id: '',
    first_name: '',
    last_name: '',
    job_title: '',
    grade_level: 'GRD-1',
    classification: 'PLANTA',
    salary: undefined,
    whatsapp_phone: '',
    birth_date: '',
    approved_limit: 5000,
  };

  ngOnInit(): void {
    this.loadClients();
    this.loadDropdownData();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.pendingStatusChange && !this.updatingStatus) {
      this.closeStatusModal();
    } else if (this.showModal && !this.saving) {
      this.closeModal();
    }
  }

  hasActiveFilters(): boolean {
    return Boolean(this.searchTerm || this.filterCompany || this.filterClassification || this.filterStatus);
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.filterCompany = '';
    this.filterClassification = '';
    this.filterStatus = '';
    this.loadClients();
  }

  loadDropdownData(): void {
    this.adminService.getCompanies().subscribe({
      next: (data) => (this.companies = data),
    });
    this.adminService.getCatalogs(CatalogCategory.JOB_TITLE).subscribe({
      next: (data) => (this.jobTitles = data),
    });
    this.adminService.getCatalogs(CatalogCategory.GRADE_LEVEL).subscribe({
      next: (data) => (this.gradeLevels = data),
    });
  }

  loadClients(): void {
    const token = this.auth.token();
    const headers = new HttpHeaders({ Authorization: `Bearer ${token || ''}` });

    let url = `${getApiBaseUrl()}/clients?`;
    if (this.searchTerm) url += `search=${encodeURIComponent(this.searchTerm)}&`;
    if (this.filterCompany) url += `employerCompanyId=${encodeURIComponent(this.filterCompany)}&`;
    if (this.filterClassification) url += `classification=${encodeURIComponent(this.filterClassification)}&`;
    if (this.filterStatus) url += `creditStatus=${encodeURIComponent(this.filterStatus)}&`;

    this.loadingClients = true;
    this.errorClients = '';
    this.http.get<ClientProfile[]>(url, { headers }).subscribe({
      next: (data) => {
        this.clients = data;
        this.loadingClients = false;
      },
      error: (err) => {
        this.loadingClients = false;
        this.errorClients = err.error?.message || 'No se pudo cargar el directorio de clientes.';
      },
    });
  }

  openClientModal(client?: ClientProfile): void {
    if (client) {
      this.editingClientId = client.id;
      this.clientForm = {
        employer_company_id: client.employer_company_id,
        employee_code: client.employee_code,
        national_id: client.national_id,
        first_name: client.first_name,
        last_name: client.last_name,
        job_title: client.job_title,
        grade_level: client.grade_level || 'GRD-1',
        classification: client.classification || 'PLANTA',
        salary: undefined,
        whatsapp_phone: client.whatsapp_phone,
        birth_date: client.birth_date || '',
        approved_limit: Number(client.approved_limit) || 0,
      };
    } else {
      this.editingClientId = null;
      this.clientForm = {
        employer_company_id: this.companies.length > 0 ? this.companies[0].id : '',
        employee_code: '',
        national_id: '',
        first_name: '',
        last_name: '',
        job_title: this.jobTitles.length > 0 ? this.jobTitles[0].name : 'EMPLEADO',
        grade_level: this.gradeLevels.length > 0 ? this.gradeLevels[0].code : 'GRD-1',
        classification: 'PLANTA',
        salary: undefined,
        whatsapp_phone: '',
        birth_date: '',
        approved_limit: 5000,
      };
    }
    this.modalError = '';
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingClientId = null;
    this.modalError = '';
  }

  saveClient(): void {
    if (
      !this.clientForm.employer_company_id ||
      !this.clientForm.employee_code ||
      !this.clientForm.national_id ||
      !this.clientForm.first_name ||
      !this.clientForm.last_name ||
      !this.clientForm.whatsapp_phone
    ) {
      this.modalError = 'Por favor complete todos los campos obligatorios (*).';
      return;
    }

    this.saving = true;
    this.modalError = '';
    if (this.editingClientId) {
      const payload: UpdateClientPayload = {
        employer_company_id: this.clientForm.employer_company_id,
        employee_code: this.clientForm.employee_code,
        national_id: this.clientForm.national_id,
        first_name: this.clientForm.first_name,
        last_name: this.clientForm.last_name,
        job_title: this.clientForm.job_title,
        grade_level: this.clientForm.grade_level,
        classification: this.clientForm.classification,
        salary: this.clientForm.salary,
        whatsapp_phone: this.clientForm.whatsapp_phone,
        birth_date: this.clientForm.birth_date,
        approved_limit: this.clientForm.approved_limit,
      };

      this.adminService.updateClient(this.editingClientId, payload).subscribe({
        next: () => {
          this.saving = false;
          this.closeModal();
          this.feedbackType = 'success';
          this.feedbackMessage = 'Perfil de cliente actualizado correctamente.';
          this.loadClients();
        },
        error: (err) => {
          this.saving = false;
          this.modalError = err.error?.message || 'Error al actualizar perfil de cliente';
        },
      });
    } else {
      const payload: CreateClientPayload = {
        employer_company_id: this.clientForm.employer_company_id,
        employee_code: this.clientForm.employee_code,
        national_id: this.clientForm.national_id,
        first_name: this.clientForm.first_name,
        last_name: this.clientForm.last_name,
        job_title: this.clientForm.job_title,
        grade_level: this.clientForm.grade_level,
        classification: this.clientForm.classification,
        salary: this.clientForm.salary,
        whatsapp_phone: this.clientForm.whatsapp_phone,
        birth_date: this.clientForm.birth_date,
        approved_limit: this.clientForm.approved_limit,
      };

      this.adminService.createClient(payload).subscribe({
        next: () => {
          this.saving = false;
          this.closeModal();
          this.feedbackType = 'success';
          this.feedbackMessage = 'Cliente registrado correctamente.';
          this.loadClients();
        },
        error: (err) => {
          this.saving = false;
          this.modalError = err.error?.message || 'Error al registrar cliente';
        },
      });
    }
  }

  toggleStatus(client: ClientProfile, newStatus: string): void {
    this.pendingStatusChange = { client, nextStatus: newStatus };
    this.statusReason = '';
    this.statusError = '';
  }

  closeStatusModal(): void {
    this.pendingStatusChange = null;
    this.statusReason = '';
    this.statusError = '';
  }

  confirmStatusChange(): void {
    if (!this.pendingStatusChange || !this.statusReason.trim()) return;
    const { client, nextStatus } = this.pendingStatusChange;
    const token = this.auth.token();
    const headers = new HttpHeaders({ Authorization: `Bearer ${token || ''}` });

    this.updatingStatus = true;
    this.statusError = '';
    this.http
      .patch(
        `${getApiBaseUrl()}/clients/${client.id}/status`,
        { credit_status: nextStatus, reason: this.statusReason.trim() },
        { headers },
      )
      .subscribe({
        next: () => {
          this.updatingStatus = false;
          this.closeStatusModal();
          this.feedbackType = 'success';
          this.feedbackMessage = `Estado crediticio actualizado a ${nextStatus}.`;
          this.loadClients();
        },
        error: (err) => {
          this.updatingStatus = false;
          this.statusError = err.error?.message || 'Error al actualizar estado';
        },
      });
  }

  formatNumber(val: string | number): string {
    return Number(val).toLocaleString('es-NI', { minimumFractionDigits: 2 });
  }
}
