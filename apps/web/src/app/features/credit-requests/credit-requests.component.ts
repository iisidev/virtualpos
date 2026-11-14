import { Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CreditRequestsService,
  CreditRequestItem,
} from '../../core/services/credit-requests.service';
import { AdminService } from '../../core/services/admin.service';
import { ClientProfile, Company } from '../../core/models';
import { StatusBannerComponent } from '../../shared/status-banner.component';
import { formatChannelLabel, formatRequestStatusLabel } from '../../shared/ui-labels';

@Component({
  selector: 'app-credit-requests',
  standalone: true,
  imports: [CommonModule, FormsModule, StatusBannerComponent],
  template: `
    <div class="requests-page">
      <div class="page-header bento-card">
        <div>
          <h1><i class="chartline icon" aria-hidden="true"></i> Aprobaciones de Crédito y Límites</h1>
          <p>Evaluación integral de solicitudes de aumento (WhatsApp / Web) y activación de líneas pendientes</p>
        </div>
        <div class="header-actions">
          <button type="button" class="ui-btn primary-btn" (click)="openCreateModal()">
            <i class="plus icon" aria-hidden="true"></i> Nueva Solicitud
          </button>
          <button type="button" class="ui-btn secondary-btn" (click)="loadAllData()" [disabled]="loading || loadingPendingLines">
            <i class="refresh icon" aria-hidden="true"></i>
            {{ loading ? 'Actualizando...' : 'Actualizar' }}
          </button>
        </div>
      </div>

      <app-status-banner
        [message]="feedbackMessage"
        [type]="feedbackType"
        (dismiss)="feedbackMessage = ''"
      ></app-status-banner>

      <!-- KPI Stats Ribbon -->
      <div class="bento-grid stats-grid">
        <div class="bento-card stat-item">
          <span class="stat-label">Solicitudes Pendientes</span>
          <span class="stat-value ui-credit-warning">{{ countByStatus('PENDING') }}</span>
        </div>
        <div class="bento-card stat-item">
          <span class="stat-label">Solicitudes Aprobadas</span>
          <span class="stat-value ui-credit-ok">{{ countByStatus('APPROVED') }}</span>
        </div>
        <div class="bento-card stat-item">
          <span class="stat-label">Solicitudes Rechazadas</span>
          <span class="stat-value ui-credit-danger">{{ countByStatus('REJECTED') }}</span>
        </div>
        <div class="bento-card stat-item">
          <span class="stat-label">Líneas por Aprobar</span>
          <span class="stat-value">{{ pendingClients.length }}</span>
        </div>
      </div>

      <!-- View Sub-Tabs + Filters -->
      <div class="bento-card controls-card">
        <div class="view-pills" role="tablist" aria-label="Bandejas de aprobación">
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="activeSection === 'increases'"
            class="subtab-btn"
            [class.active]="activeSection === 'increases'"
            (click)="activeSection = 'increases'"
          >
            <i class="chartline icon" aria-hidden="true"></i>
            Solicitudes de Aumento ({{ requests.length }})
          </button>
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="activeSection === 'pending_lines'"
            class="subtab-btn"
            [class.active]="activeSection === 'pending_lines'"
            (click)="activeSection = 'pending_lines'"
          >
            <i class="user check icon" aria-hidden="true"></i>
            Líneas Pendientes de Aprobación ({{ pendingClients.length }})
          </button>
        </div>

        <div *ngIf="activeSection === 'increases'" class="filter-bar">
          <div class="filter-item flex-2">
            <label for="req-search" class="sr-only">Buscar por nombre, cédula, carnet o motivo</label>
            <input
              id="req-search"
              type="text"
              class="form-input"
              [(ngModel)]="searchTerm"
              (ngModelChange)="onFilterChange()"
              placeholder="Buscar colaborador, cédula, carnet o motivo..."
            />
          </div>
          <div class="filter-item">
            <label for="req-filter-company" class="sr-only">Filtrar por empresa empleadora</label>
            <select
              id="req-filter-company"
              class="form-input"
              [(ngModel)]="filterCompanyId"
              (change)="loadRequests()"
            >
              <option value="">Todas las Empresas</option>
              <option *ngFor="let emp of employerCompanies" [value]="emp.id">
                {{ emp.name }}
              </option>
            </select>
          </div>
          <div class="filter-item">
            <label for="req-filter-status" class="sr-only">Filtrar por estado</label>
            <select
              id="req-filter-status"
              class="form-input"
              [(ngModel)]="filterStatus"
              (change)="loadRequests()"
            >
              <option value="">Todos los Estados</option>
              <option value="PENDING">Pendientes</option>
              <option value="APPROVED">Aprobadas</option>
              <option value="REJECTED">Rechazadas</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Sección 1: Solicitudes de aumento -->
      <div *ngIf="activeSection === 'increases'" class="bento-card">
        <div *ngIf="loading && requests.length === 0" class="ui-state-box" role="status">
          <i class="spinner loading icon" aria-hidden="true"></i>
          <span>Cargando solicitudes de aumento de crédito...</span>
        </div>

        <div *ngIf="errorMessage && requests.length === 0" class="ui-banner error" role="alert">
          <span class="ui-banner-msg">
            <i class="exclamation triangle icon" aria-hidden="true"></i>
            {{ errorMessage }}
          </span>
          <button type="button" class="ui-btn primary-btn" (click)="loadRequests()">Reintentar</button>
        </div>

        <div *ngIf="!loading && !errorMessage && requests.length === 0" class="ui-state-box">
          <i class="inbox icon" aria-hidden="true"></i>
          <span>No hay solicitudes registradas con los filtros actuales.</span>
          <button type="button" class="ui-btn secondary-btn" (click)="resetFilters()">Limpiar filtros</button>
        </div>

        <div *ngIf="requests.length > 0" class="table-responsive">
          <table class="ui selectable table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Colaborador</th>
                <th>Cédula / Carnet</th>
                <th>Empresa</th>
                <th>Canal</th>
                <th class="text-right">Límite Actual</th>
                <th class="text-right">Límite Solicitado</th>
                <th>Motivo Declarado</th>
                <th>Estado</th>
                <th>Resolución</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let req of requests">
                <td class="ui-mono">{{ req.created_at | date: 'dd/MM/yyyy HH:mm' }}</td>
                <td>
                  <strong>{{ req.client?.first_name }} {{ req.client?.last_name }}</strong>
                </td>
                <td>
                  <div class="ui-mono">{{ req.client?.national_id }}</div>
                  <span class="carnet-pill ui-mono">{{ req.client?.employee_code }}</span>
                </td>
                <td>{{ req.client?.employer_company?.name || 'Empresa' }}</td>
                <td>
                  <span class="ui tiny label" [class.green]="req.channel === 'WHATSAPP_BOT'">
                    <i class="whatsapp icon" *ngIf="req.channel === 'WHATSAPP_BOT'" aria-hidden="true"></i>
                    <i class="globe icon" *ngIf="req.channel !== 'WHATSAPP_BOT'" aria-hidden="true"></i>
                    {{ formatChannelLabel(req.channel) }}
                  </span>
                </td>
                <td class="ui-amount-cell">C$ {{ formatNumber(req.current_limit) }}</td>
                <td class="ui-amount-cell">
                  <strong class="requested-limit-value">C$ {{ formatNumber(req.requested_limit) }}</strong>
                </td>
                <td><em>"{{ req.reason }}"</em></td>
                <td>
                  <span
                    class="badge-status"
                    [ngClass]="{
                      active: req.status === 'APPROVED',
                      amber: req.status === 'PENDING',
                      blocked: req.status === 'REJECTED'
                    }"
                  >
                    {{ formatRequestStatusLabel(req.status) }}
                  </span>
                </td>
                <td>
                  <div *ngIf="req.status === 'PENDING'" class="ui tiny buttons">
                    <button type="button" class="ui positive button" (click)="openReviewModal(req, 'APPROVE')">
                      <i class="check icon" aria-hidden="true"></i> Aprobar
                    </button>
                    <div class="or" data-text="o"></div>
                    <button type="button" class="ui negative button" (click)="openReviewModal(req, 'REJECT')">
                      <i class="close icon" aria-hidden="true"></i> Rechazar
                    </button>
                  </div>
                  <div *ngIf="req.status !== 'PENDING'" class="sub-text">
                    <div>Revisado por {{ req.reviewer?.full_name || req.reviewer?.username || 'Oficial' }}</div>
                    <div *ngIf="req.review_notes"><em>{{ req.review_notes }}</em></div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Sección 2: Líneas de crédito nuevas pendientes de aprobación -->
      <div *ngIf="activeSection === 'pending_lines'" class="bento-card">
        <div *ngIf="loadingPendingLines && pendingClients.length === 0" class="ui-state-box" role="status">
          <i class="spinner loading icon" aria-hidden="true"></i>
          <span>Buscando líneas de crédito pendientes de aprobación...</span>
        </div>

        <div *ngIf="!loadingPendingLines && pendingClients.length === 0" class="ui-state-box">
          <i class="check circle outline icon" aria-hidden="true"></i>
          <span>No hay líneas nuevas pendientes de aprobación en este momento.</span>
        </div>

        <div *ngIf="pendingClients.length > 0" class="table-responsive">
          <table class="ui selectable table">
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Cédula / Carnet</th>
                <th>Empresa Empleadora</th>
                <th>Cargo / Clasificación</th>
                <th class="text-right">Límite Propuesto</th>
                <th>Acciones de Comité</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let c of pendingClients">
                <td>
                  <strong>{{ c.full_name }}</strong>
                  <div class="sub-text ui-mono">{{ c.whatsapp_phone }}</div>
                </td>
                <td>
                  <div class="ui-mono">{{ c.national_id }}</div>
                  <span class="carnet-pill ui-mono">{{ c.employee_code }}</span>
                </td>
                <td>{{ c.employer_name }}</td>
                <td>
                  <div>{{ c.job_title }}</div>
                  <span class="carnet-pill">{{ c.classification }} ({{ c.grade_level }})</span>
                </td>
                <td class="ui-amount-cell">
                  <strong class="requested-limit-value">C$ {{ formatNumber(c.approved_limit) }}</strong>
                </td>
                <td>
                  <div class="ui tiny buttons">
                    <button type="button" class="ui positive button" (click)="openLineApprovalModal(c, 'ACTIVE')">
                      <i class="check icon" aria-hidden="true"></i> Aprobar Línea
                    </button>
                    <div class="or" data-text="o"></div>
                    <button type="button" class="ui negative button" (click)="openLineApprovalModal(c, 'BLOCKED')">
                      <i class="close icon" aria-hidden="true"></i> Rechazar
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Modal crear solicitud de aumento -->
      <div
        *ngIf="showCreateModal"
        class="modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-request-title"
        (click)="!creatingRequest && closeCreateModal()"
      >
        <div class="bento-card modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2 id="create-request-title">
              <i class="plus circle icon" aria-hidden="true"></i> Nueva Solicitud de Aumento de Crédito
            </h2>
            <button type="button" class="close-btn" aria-label="Cerrar ventana" (click)="closeCreateModal()">
              &times;
            </button>
          </div>

          <form (ngSubmit)="submitCreateRequest()" class="modal-form">
            <div class="form-group">
              <label for="create-req-client">Colaborador / Cliente *</label>
              <select
                id="create-req-client"
                class="form-input"
                [(ngModel)]="createForm.client_id"
                name="client_id"
                (ngModelChange)="onSelectCreateClient($event)"
                required
              >
                <option value="" disabled>Seleccione colaborador...</option>
                <option *ngFor="let c of availableClientsForRequest" [value]="c.id">
                  {{ c.full_name }} ({{ c.national_id }}) — Límite actual: C$ {{ formatNumber(c.approved_limit) }}
                </option>
              </select>
            </div>

            <div *ngIf="selectedCreateClient" class="sub-text client-preview-strip">
              Empresa: <strong>{{ selectedCreateClient.employer_name }}</strong> &middot;
              Límite actual: <strong class="ui-mono">C$ {{ formatNumber(selectedCreateClient.approved_limit) }}</strong> &middot;
              Disponible: <strong class="ui-mono">C$ {{ formatNumber(selectedCreateClient.available_balance) }}</strong>
            </div>

            <div class="form-group">
              <label for="create-req-limit">Nuevo Límite Solicitado (C$) *</label>
              <input
                id="create-req-limit"
                type="number"
                step="0.01"
                min="1"
                class="form-input ui-mono"
                [(ngModel)]="createForm.requested_limit"
                name="requested_limit"
                required
              />
            </div>

            <div class="form-group">
              <label for="create-req-reason">Motivo / Justificación *</label>
              <textarea
                id="create-req-reason"
                rows="3"
                class="form-input"
                [(ngModel)]="createForm.reason"
                name="reason"
                placeholder="Detalle la razón del aumento de límite..."
                required
              ></textarea>
            </div>

            <div *ngIf="createError" class="ui negative message" role="alert">{{ createError }}</div>

            <div class="modal-actions">
              <button type="button" class="ui-btn secondary-btn" (click)="closeCreateModal()" [disabled]="creatingRequest">
                Cancelar
              </button>
              <button
                type="submit"
                class="ui-btn primary-btn"
                [disabled]="creatingRequest || !createForm.client_id || !createForm.reason.trim()"
              >
                <i class="save icon" *ngIf="!creatingRequest" aria-hidden="true"></i>
                {{ creatingRequest ? 'Registrando...' : 'Registrar Solicitud' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Modal revisar solicitud de aumento -->
      <div
        *ngIf="pendingDecision"
        class="modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-modal-title"
        (click)="!resolving && closeReviewModal()"
      >
        <div class="bento-card modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2 id="review-modal-title">
              <i class="chartline icon" aria-hidden="true"></i>
              {{ pendingDecision.action === 'APPROVE' ? 'Aprobar Solicitud de Crédito' : 'Rechazar Solicitud de Crédito' }}
            </h2>
            <button
              type="button"
              class="close-btn"
              aria-label="Cerrar ventana"
              (click)="closeReviewModal()"
            >
              &times;
            </button>
          </div>

          <form (ngSubmit)="confirmReview()" class="modal-form">
            <p class="sub-text">
              Colaborador:
              <strong>{{ pendingDecision.request.client?.first_name }} {{ pendingDecision.request.client?.last_name }}</strong>
              &middot; Límite actual: <strong class="ui-mono">C$ {{ formatNumber(pendingDecision.request.current_limit) }}</strong>
              &middot; Solicitado: <strong class="ui-mono">C$ {{ formatNumber(pendingDecision.request.requested_limit) }}</strong>
            </p>

            <div class="form-group" *ngIf="pendingDecision.action === 'APPROVE'">
              <label for="credit-approved-limit">Nuevo Límite Final a Aprobar (C$) *</label>
              <input
                id="credit-approved-limit"
                type="number"
                step="0.01"
                min="1"
                class="form-input ui-mono"
                [(ngModel)]="approvedLimitInput"
                name="approvedLimitInput"
                required
              />
            </div>

            <div class="form-group">
              <label for="credit-review-notes">Observaciones o justificación</label>
              <textarea
                id="credit-review-notes"
                rows="3"
                class="form-input"
                [(ngModel)]="reviewNotes"
                name="reviewNotes"
                placeholder="Detalle opcional sobre la decisión (se incluirá en notificación WhatsApp)..."
              ></textarea>
            </div>

            <div *ngIf="reviewError" class="ui negative message" role="alert">{{ reviewError }}</div>

            <div class="modal-actions">
              <button type="button" class="ui-btn secondary-btn" (click)="closeReviewModal()" [disabled]="resolving">
                Cancelar
              </button>
              <button
                type="submit"
                class="ui button"
                [class.positive]="pendingDecision.action === 'APPROVE'"
                [class.negative]="pendingDecision.action === 'REJECT'"
                [disabled]="resolving"
              >
                <i
                  *ngIf="!resolving"
                  class="icon"
                  [class.check]="pendingDecision.action === 'APPROVE'"
                  [class.close]="pendingDecision.action === 'REJECT'"
                  aria-hidden="true"
                ></i>
                {{
                  resolving
                    ? 'Procesando...'
                    : pendingDecision.action === 'APPROVE'
                      ? 'Confirmar Aprobación'
                      : 'Confirmar Rechazo'
                }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Modal aprobación de línea pendiente -->
      <div
        *ngIf="pendingLineApproval"
        class="modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="line-approval-title"
        (click)="!resolvingLine && closeLineApprovalModal()"
      >
        <div class="bento-card modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2 id="line-approval-title">
              {{ pendingLineApproval.nextStatus === 'ACTIVE' ? 'Aprobar Línea de Crédito' : 'Rechazar Alta de Crédito' }}
            </h2>
            <button type="button" class="close-btn" aria-label="Cerrar ventana" (click)="closeLineApprovalModal()">&times;</button>
          </div>

          <form (ngSubmit)="confirmLineApproval()" class="modal-form">
            <p class="sub-text">
              Colaborador: <strong>{{ pendingLineApproval.client.full_name }}</strong>
              &middot; Límite: <strong class="ui-mono">C$ {{ formatNumber(pendingLineApproval.client.approved_limit) }}</strong>
            </p>

            <div class="form-group">
              <label for="line-approval-reason">Justificación del Comité *</label>
              <textarea
                id="line-approval-reason"
                rows="3"
                class="form-input"
                [(ngModel)]="lineApprovalReason"
                name="lineApprovalReason"
                placeholder="Detalle de aprobación o rechazo..."
                required
              ></textarea>
            </div>

            <div *ngIf="lineApprovalError" class="ui negative message" role="alert">{{ lineApprovalError }}</div>

            <div class="modal-actions">
              <button type="button" class="ui-btn secondary-btn" (click)="closeLineApprovalModal()" [disabled]="resolvingLine">
                Cancelar
              </button>
              <button
                type="submit"
                class="ui button"
                [class.positive]="pendingLineApproval.nextStatus === 'ACTIVE'"
                [class.negative]="pendingLineApproval.nextStatus === 'BLOCKED'"
                [disabled]="resolvingLine || !lineApprovalReason.trim()"
              >
                {{
                  resolvingLine
                    ? 'Procesando...'
                    : pendingLineApproval.nextStatus === 'ACTIVE'
                      ? 'Confirmar y Activar'
                      : 'Rechazar / Bloquear'
                }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styleUrl: './credit-requests.component.css',
})
export class CreditRequestsComponent implements OnInit {
  private readonly requestService = inject(CreditRequestsService);
  private readonly adminService = inject(AdminService);
  readonly formatChannelLabel = formatChannelLabel;
  readonly formatRequestStatusLabel = formatRequestStatusLabel;

  activeSection: 'increases' | 'pending_lines' = 'increases';

  requests: CreditRequestItem[] = [];
  pendingClients: ClientProfile[] = [];
  allClients: ClientProfile[] = [];
  employerCompanies: Company[] = [];

  searchTerm = '';
  filterCompanyId = '';
  filterStatus = '';

  loading = false;
  loadingPendingLines = false;
  errorMessage = '';
  feedbackMessage = '';
  feedbackType: 'success' | 'error' | 'info' = 'success';

  pendingDecision: { request: CreditRequestItem; action: 'APPROVE' | 'REJECT' } | null = null;
  approvedLimitInput = 0;
  reviewNotes = '';
  reviewError = '';
  resolving = false;

  showCreateModal = false;
  creatingRequest = false;
  createError = '';
  createForm = {
    client_id: '',
    requested_limit: 0,
    reason: '',
  };

  pendingLineApproval: { client: ClientProfile; nextStatus: 'ACTIVE' | 'BLOCKED' } | null = null;
  lineApprovalReason = '';
  lineApprovalError = '';
  resolvingLine = false;

  private searchTimer: number | undefined;

  ngOnInit(): void {
    this.loadEmployerCompanies();
    this.loadAllData();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.pendingDecision && !this.resolving) {
      this.closeReviewModal();
    } else if (this.showCreateModal && !this.creatingRequest) {
      this.closeCreateModal();
    } else if (this.pendingLineApproval && !this.resolvingLine) {
      this.closeLineApprovalModal();
    }
  }

  get availableClientsForRequest(): ClientProfile[] {
    return this.allClients.filter((c) => c.credit_status !== 'BLOCKED');
  }

  get selectedCreateClient(): ClientProfile | undefined {
    return this.allClients.find((c) => c.id === this.createForm.client_id);
  }

  loadAllData(): void {
    this.loadRequests();
    this.loadPendingLines();
  }

  loadEmployerCompanies(): void {
    this.adminService.getEmployerCompanies().subscribe({
      next: (data) => (this.employerCompanies = data),
    });
  }

  loadRequests(): void {
    this.loading = true;
    this.errorMessage = '';
    this.requestService
      .findAll({
        status: this.filterStatus || undefined,
        employerCompanyId: this.filterCompanyId || undefined,
        search: this.searchTerm.trim() || undefined,
      })
      .subscribe({
        next: (data) => {
          this.requests = data;
          this.loading = false;
        },
        error: (err) => {
          this.loading = false;
          this.errorMessage = err.error?.message || 'No se pudieron cargar las solicitudes de crédito.';
        },
      });
  }

  loadPendingLines(): void {
    this.loadingPendingLines = true;
    this.adminService.getClients({ creditStatus: 'PENDING_APPROVAL' }).subscribe({
      next: (rows) => {
        this.pendingClients = rows;
        this.loadingPendingLines = false;
      },
      error: () => {
        this.loadingPendingLines = false;
      },
    });
  }

  onFilterChange(): void {
    window.clearTimeout(this.searchTimer);
    this.searchTimer = window.setTimeout(() => this.loadRequests(), 250);
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.filterCompanyId = '';
    this.filterStatus = '';
    this.loadRequests();
  }

  countByStatus(status: 'PENDING' | 'APPROVED' | 'REJECTED'): number {
    return this.requests.filter((r) => r.status === status).length;
  }

  openCreateModal(): void {
    this.createError = '';
    this.createForm = { client_id: '', requested_limit: 0, reason: '' };
    this.showCreateModal = true;
    this.adminService.getClients().subscribe({
      next: (clients) => {
        this.allClients = clients;
      },
    });
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.createError = '';
  }

  onSelectCreateClient(clientId: string): void {
    const found = this.allClients.find((c) => c.id === clientId);
    if (found) {
      this.createForm.requested_limit = Math.round(Number(found.approved_limit) * 1.25) || 5000;
    }
  }

  submitCreateRequest(): void {
    if (!this.createForm.client_id || !this.createForm.reason.trim()) return;
    this.creatingRequest = true;
    this.createError = '';

    this.requestService
      .create({
        client_id: this.createForm.client_id,
        requested_limit: Number(this.createForm.requested_limit),
        reason: this.createForm.reason.trim(),
      })
      .subscribe({
        next: () => {
          this.creatingRequest = false;
          this.closeCreateModal();
          this.feedbackType = 'success';
          this.feedbackMessage = 'Solicitud de aumento registrada y lista para evaluación.';
          this.loadRequests();
        },
        error: (err) => {
          this.creatingRequest = false;
          this.createError = err.error?.message || 'No se pudo crear la solicitud de aumento.';
        },
      });
  }

  openReviewModal(request: CreditRequestItem, action: 'APPROVE' | 'REJECT'): void {
    this.pendingDecision = { request, action };
    this.approvedLimitInput = Number(request.requested_limit) || 0;
    this.reviewNotes = '';
    this.reviewError = '';
  }

  closeReviewModal(): void {
    this.pendingDecision = null;
    this.reviewNotes = '';
    this.reviewError = '';
  }

  confirmReview(): void {
    if (!this.pendingDecision) return;
    const { request, action } = this.pendingDecision;
    this.resolving = true;
    this.reviewError = '';
    this.feedbackMessage = '';

    this.requestService
      .review(
        request.id,
        action,
        this.reviewNotes.trim(),
        action === 'APPROVE' ? Number(this.approvedLimitInput) : undefined,
      )
      .subscribe({
        next: (res) => {
          this.resolving = false;
          this.closeReviewModal();
          const wa = res.whatsapp_notification;
          if (action === 'APPROVE') {
            this.feedbackType = 'success';
            this.feedbackMessage = wa?.ok
              ? `Solicitud aprobada, límite actualizado en el libro mayor y cliente notificado por WhatsApp (${wa.phone}).`
              : 'Solicitud aprobada y límite actualizado en el libro mayor.';
          } else {
            this.feedbackType = 'success';
            this.feedbackMessage = wa?.ok
              ? `Solicitud rechazada y cliente notificado por WhatsApp (${wa.phone}).`
              : 'Solicitud rechazada correctamente.';
          }
          this.loadAllData();
        },
        error: (err) => {
          this.resolving = false;
          this.reviewError = err.error?.message || 'Error al procesar la resolución.';
        },
      });
  }

  openLineApprovalModal(client: ClientProfile, nextStatus: 'ACTIVE' | 'BLOCKED'): void {
    this.pendingLineApproval = { client, nextStatus };
    this.lineApprovalReason =
      nextStatus === 'ACTIVE'
        ? 'Línea de crédito aprobada por Comité de Crédito'
        : 'Solicitud de línea de crédito no aprobada';
    this.lineApprovalError = '';
  }

  closeLineApprovalModal(): void {
    this.pendingLineApproval = null;
    this.lineApprovalReason = '';
    this.lineApprovalError = '';
  }

  confirmLineApproval(): void {
    if (!this.pendingLineApproval || !this.lineApprovalReason.trim()) return;
    const { client, nextStatus } = this.pendingLineApproval;
    this.resolvingLine = true;
    this.lineApprovalError = '';

    this.adminService
      .updateClientStatus(client.id, {
        credit_status: nextStatus,
        reason: this.lineApprovalReason.trim(),
      })
      .subscribe({
        next: (res) => {
          this.resolvingLine = false;
          this.closeLineApprovalModal();
          this.feedbackType = 'success';
          if (nextStatus === 'ACTIVE') {
            this.feedbackMessage = res.whatsapp_notification?.ok
              ? `Línea aprobada y activada para ${client.full_name}. Notificado por WhatsApp.`
              : `Línea aprobada y activada para ${client.full_name}.`;
          } else {
            this.feedbackMessage = `Línea rechazada / bloqueada para ${client.full_name}.`;
          }
          this.loadAllData();
        },
        error: (err) => {
          this.resolvingLine = false;
          this.lineApprovalError = err.error?.message || 'No se pudo procesar la resolución de línea.';
        },
      });
  }

  formatNumber(val: string | number): string {
    return Number(val).toLocaleString('es-NI', { minimumFractionDigits: 2 });
  }
}

