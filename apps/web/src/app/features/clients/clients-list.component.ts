import { Component, OnInit, inject } from '@angular/core';
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

@Component({
  selector: 'app-clients-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="clients-page">
      <!-- Bento Header -->
      <div class="page-header bento-card">
        <div>
          <h2><i class="users icon"></i> Directorio de Clientes y Líneas de Crédito</h2>
          <p>Control de perfiles de colaboradores, saldos, límites asignados y bloqueos preventivos</p>
        </div>

        <button class="ui-btn primary-btn" (click)="openClientModal()">
          <i class="user plus icon"></i> Registrar Nuevo Cliente
        </button>
      </div>

      <!-- Filters Ribbon (12 Cols) -->
      <div class="bento-card filter-card">
        <div class="filter-group flex-2">
          <label>Búsqueda Rápida:</label>
          <div class="search-input-wrap">
            <i class="search icon"></i>
            <input
              type="text"
              class="ui-input"
              [(ngModel)]="searchTerm"
              (input)="loadClients()"
              placeholder="Cédula, carnet, teléfono o nombre..."
            />
          </div>
        </div>

        <div class="filter-group flex-1">
          <label>Empresa Empleadora:</label>
          <select class="ui dropdown select-box" [(ngModel)]="filterCompany" (change)="loadClients()">
            <option value="">Todas las Empresas</option>
            <option *ngFor="let c of companies" [value]="c.id">{{ c.name }}</option>
          </select>
        </div>

        <div class="filter-group flex-1">
          <label>Clasificación:</label>
          <select class="ui dropdown select-box" [(ngModel)]="filterClassification" (change)="loadClients()">
            <option value="">Todas</option>
            <option value="PLANTA">PLANTA</option>
            <option value="CONFIANZA">CONFIANZA</option>
            <option value="VIP">VIP</option>
            <option value="TEMPORAL">TEMPORAL</option>
          </select>
        </div>

        <div class="filter-group flex-1">
          <label>Estado Crediticio:</label>
          <select class="ui dropdown select-box" [(ngModel)]="filterStatus" (change)="loadClients()">
            <option value="">Todos</option>
            <option value="ACTIVE">ACTIVO</option>
            <option value="FROZEN">CONGELADO</option>
            <option value="BLOCKED">BLOQUEADO</option>
          </select>
        </div>
      </div>

      <!-- Clients Bento Table -->
      <div class="bento-card table-card">
        <div class="table-responsive">
          <table class="ui-table">
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Cédula / Carnet</th>
                <th>Empresa Empleadora</th>
                <th>Cargo / Nivel</th>
                <th>Salario</th>
                <th>Límite Autorizado</th>
                <th>Consumido</th>
                <th>Disponible</th>
                <th>Estado</th>
                <th class="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let c of clients">
                <td>
                  <strong>{{ c.full_name }}</strong>
                  <div class="sub-text"><i class="whatsapp icon" style="color: #10B981;"></i> {{ c.whatsapp_phone }}</div>
                </td>
                <td>
                  <div>{{ c.national_id }}</div>
                  <span class="carnet-pill">{{ c.employee_code }}</span>
                </td>
                <td>{{ c.employer_name }}</td>
                <td>
                  <div>{{ c.job_title }}</div>
                  <span class="class-pill">{{ c.classification }} ({{ c.grade_level }})</span>
                </td>
                <td>
                  <span class="salary-tag">{{ c.salary }}</span>
                </td>
                <td><strong>C$ {{ formatNumber(c.approved_limit) }}</strong></td>
                <td>C$ {{ formatNumber(c.used_balance) }}</td>
                <td>
                  <strong [style.color]="c.status_color_class === 'red' ? '#991B1B' : (c.status_color_class === 'amber' ? '#B45309' : '#047857')">
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
                  <button class="icon-btn" (click)="openClientModal(c)" title="Editar Perfil">
                    <i class="edit outline icon"></i>
                  </button>
                  <button
                    *ngIf="c.credit_status === 'ACTIVE'"
                    class="icon-btn danger"
                    (click)="toggleStatus(c, 'BLOCKED')"
                    title="Bloquear Línea de Crédito"
                  >
                    <i class="lock icon"></i>
                  </button>
                  <button
                    *ngIf="c.credit_status !== 'ACTIVE'"
                    class="icon-btn success"
                    (click)="toggleStatus(c, 'ACTIVE')"
                    title="Reactivar Línea de Crédito"
                  >
                    <i class="unlock icon"></i>
                  </button>
                </td>
              </tr>
              <tr *ngIf="clients.length === 0">
                <td colspan="10" class="empty-state">
                  No se encontraron clientes con los filtros indicados.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- MODAL: CREAR / EDITAR CLIENTE -->
      <div *ngIf="showModal" class="modal-backdrop">
        <div class="bento-card modal-content">
          <div class="modal-header">
            <h3>{{ editingClientId ? 'Editar Perfil de Cliente' : 'Registrar Nuevo Cliente / Colaborador' }}</h3>
            <button class="close-btn" (click)="closeModal()">&times;</button>
          </div>

          <form (ngSubmit)="saveClient()" class="modal-form">
            <!-- Row 1: Identification -->
            <div class="form-row">
              <div class="form-group flex-1">
                <label>Cédula de Identidad *</label>
                <input
                  type="text"
                  class="form-input"
                  [(ngModel)]="clientForm.national_id"
                  name="national_id"
                  placeholder="001-121092-0000X"
                  required
                />
              </div>
              <div class="form-group flex-1">
                <label>Código de Carnet / Empleado *</label>
                <input
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
                <label>Nombres *</label>
                <input
                  type="text"
                  class="form-input"
                  [(ngModel)]="clientForm.first_name"
                  name="first_name"
                  placeholder="Primer y segundo nombre"
                  required
                />
              </div>
              <div class="form-group flex-1">
                <label>Apellidos *</label>
                <input
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
                <label>Empresa Empleadora *</label>
                <select class="form-input" [(ngModel)]="clientForm.employer_company_id" name="employer_company_id" required>
                  <option value="" disabled>Seleccione empresa...</option>
                  <option *ngFor="let c of companies" [value]="c.id">
                    {{ c.name }} ({{ c.code }})
                  </option>
                </select>
              </div>

              <div class="form-group flex-1">
                <label>Cargo / Puesto *</label>
                <select class="form-input" [(ngModel)]="clientForm.job_title" name="job_title" required>
                  <option value="" disabled>Seleccione cargo...</option>
                  <option *ngFor="let j of jobTitles" [value]="j.name">{{ j.name }}</option>
                </select>
              </div>
            </div>

            <!-- Row 4: Grade & Classification -->
            <div class="form-row">
              <div class="form-group flex-1">
                <label>Grado Salarial</label>
                <select class="form-input" [(ngModel)]="clientForm.grade_level" name="grade_level">
                  <option *ngFor="let g of gradeLevels" [value]="g.code">{{ g.name }}</option>
                </select>
              </div>

              <div class="form-group flex-1">
                <label>Tipificación de Cliente</label>
                <select class="form-input" [(ngModel)]="clientForm.classification" name="classification">
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
                <label>Límite de Crédito Aprobado (C$) *</label>
                <input
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
                <label>Salario Mensual Bruto (C$)</label>
                <input
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
                <label>Teléfono WhatsApp (E.164) *</label>
                <input
                  type="text"
                  class="form-input"
                  [(ngModel)]="clientForm.whatsapp_phone"
                  name="whatsapp_phone"
                  placeholder="50588888888"
                  required
                />
              </div>

              <div class="form-group flex-1">
                <label>Fecha de Nacimiento (YYYY-MM-DD)</label>
                <input
                  type="date"
                  class="form-input"
                  [(ngModel)]="clientForm.birth_date"
                  name="birth_date"
                />
              </div>
            </div>

            <div class="modal-actions">
              <button type="button" class="ui-btn secondary-btn" (click)="closeModal()">
                Cancelar
              </button>
              <button type="submit" class="ui-btn primary-btn" [disabled]="saving">
                {{ saving ? 'Guardando...' : (editingClientId ? 'Actualizar Cliente' : 'Guardar Cliente') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .clients-page {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }

      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1rem;
      }

      .page-header h2 {
        margin: 0;
        font-weight: 800;
        color: var(--navy-900);
      }

      .page-header p {
        margin: 0.25rem 0 0;
        color: var(--gray-text);
        font-size: 0.9rem;
      }

      .filter-card {
        display: flex;
        gap: 1.25rem;
        align-items: center;
        flex-wrap: wrap;
        padding: 1rem 1.5rem;
      }

      .filter-group {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }

      .flex-1 {
        flex: 1;
      }

      .flex-2 {
        flex: 2;
      }

      .filter-group label {
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--navy-800);
      }

      .search-input-wrap {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        background: var(--gray-subtle);
        border: 1px solid var(--gray-border);
        border-radius: 0.5rem;
        padding: 0.45rem 0.75rem;
      }

      .search-input-wrap input {
        border: none;
        background: transparent;
        outline: none;
        width: 100%;
        font-size: 0.85rem;
      }

      .select-box {
        padding: 0.55rem 0.75rem;
        border: 1px solid var(--gray-border);
        border-radius: 0.5rem;
        font-size: 0.85rem;
        outline: none;
        background: #ffffff;
      }

      .ui-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85rem;
      }

      .ui-table th {
        text-align: left;
        padding: 0.75rem 1rem;
        font-weight: 700;
        color: var(--navy-800);
        border-bottom: 2px solid var(--gray-border);
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }

      .ui-table td {
        padding: 0.85rem 1rem;
        border-bottom: 1px solid var(--gray-border);
        vertical-align: middle;
      }

      .sub-text {
        font-size: 0.75rem;
        color: var(--gray-text);
        display: flex;
        align-items: center;
        gap: 0.3rem;
        margin-top: 0.2rem;
      }

      .carnet-pill,
      .class-pill {
        display: inline-block;
        font-size: 0.7rem;
        font-weight: 700;
        background: var(--gray-subtle);
        padding: 0.15rem 0.4rem;
        border-radius: 0.25rem;
        color: var(--navy-800);
      }

      .salary-tag {
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.8rem;
        font-weight: 600;
        color: #334155;
      }

      .ui-btn {
        padding: 0.6rem 1.25rem;
        border-radius: 0.5rem;
        font-weight: 700;
        font-size: 0.85rem;
        cursor: pointer;
        border: none;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        transition: all 0.15s;
      }

      .primary-btn {
        background: var(--navy-900);
        color: #ffffff;
      }

      .primary-btn:hover {
        background: var(--navy-800);
      }

      .secondary-btn {
        background: var(--gray-subtle);
        color: var(--navy-800);
      }

      .icon-btn {
        background: transparent;
        border: 1px solid var(--gray-border);
        padding: 0.35rem 0.5rem;
        border-radius: 0.375rem;
        cursor: pointer;
        margin-left: 0.35rem;
        transition: all 0.15s;
      }

      .icon-btn:hover {
        background: var(--gray-subtle);
      }

      .icon-btn.danger {
        color: #991B1B;
      }

      .icon-btn.danger:hover {
        background: #FEE2E2;
      }

      .icon-btn.success {
        color: #065F46;
      }

      .icon-btn.success:hover {
        background: #D1FAE5;
      }

      .text-right {
        text-align: right;
      }

      .empty-state {
        text-align: center;
        padding: 2.5rem;
        color: var(--gray-text);
      }

      .text-bold {
        font-weight: 700;
      }

      /* Modal */
      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.6);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 1.5rem;
      }

      .modal-content {
        width: 100%;
        max-width: 680px;
        background: #ffffff;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
        max-height: 90vh;
        overflow-y: auto;
      }

      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 1rem;
        border-bottom: 1px solid var(--gray-border);
        margin-bottom: 1.25rem;
      }

      .modal-header h3 {
        margin: 0;
        font-weight: 800;
        color: var(--navy-900);
      }

      .close-btn {
        background: transparent;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: var(--gray-text);
      }

      .modal-form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .form-row {
        display: flex;
        gap: 1rem;
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }

      .form-group label {
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--navy-800);
      }

      .form-input {
        padding: 0.6rem 0.75rem;
        border: 1px solid var(--gray-border);
        border-radius: 0.45rem;
        font-size: 0.85rem;
        outline: none;
        width: 100%;
        box-sizing: border-box;
      }

      .form-input:focus {
        border-color: var(--navy-900);
      }

      .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        margin-top: 1.25rem;
        padding-top: 1rem;
        border-top: 1px solid var(--gray-border);
      }
    `,
  ],
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

  // Modal
  showModal = false;
  editingClientId: string | null = null;
  saving = false;

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

    this.http.get<ClientProfile[]>(url, { headers }).subscribe({
      next: (data) => (this.clients = data),
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
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingClientId = null;
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
      alert('Por favor complete todos los campos obligatorios (*)');
      return;
    }

    this.saving = true;
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
          this.loadClients();
        },
        error: (err) => {
          this.saving = false;
          alert(err.error?.message || 'Error al actualizar perfil de cliente');
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
          this.loadClients();
        },
        error: (err) => {
          this.saving = false;
          alert(err.error?.message || 'Error al registrar cliente');
        },
      });
    }
  }

  toggleStatus(client: ClientProfile, newStatus: string): void {
    const reason = prompt(`Ingrese motivo para cambiar estado a ${newStatus}:`);
    if (!reason || !reason.trim()) return;

    const token = this.auth.token();
    const headers = new HttpHeaders({ Authorization: `Bearer ${token || ''}` });

    this.http
      .patch(
        `${getApiBaseUrl()}/clients/${client.id}/status`,
        { credit_status: newStatus, reason: reason.trim() },
        { headers },
      )
      .subscribe({
        next: () => this.loadClients(),
        error: (err) => alert(err.error?.message || 'Error al actualizar estado'),
      });
  }

  formatNumber(val: string | number): string {
    return Number(val).toLocaleString('es-NI', { minimumFractionDigits: 2 });
  }
}
