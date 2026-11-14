import { Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CreditRequestsService,
  CreditRequestItem,
} from '../../core/services/credit-requests.service';
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
          <h1><i class="chartline icon" aria-hidden="true"></i> Solicitudes de Aumento de Crédito</h1>
          <p>Bandeja de solicitudes recibidas vía WhatsApp Bot y Portal Web para evaluación</p>
        </div>
        <button type="button" class="ui-btn secondary-btn" (click)="loadRequests()" [disabled]="loading">
          <i class="refresh icon" aria-hidden="true"></i>
          {{ loading ? 'Actualizando...' : 'Actualizar' }}
        </button>
      </div>

      <app-status-banner
        [message]="feedbackMessage"
        [type]="feedbackType"
        (dismiss)="feedbackMessage = ''"
      ></app-status-banner>

      <div class="bento-card">
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
          <span>No hay solicitudes registradas en la bandeja actualmente.</span>
          <button type="button" class="ui-btn secondary-btn" (click)="loadRequests()">Verificar nuevamente</button>
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
                  <span *ngIf="req.status !== 'PENDING'" class="sub-text">
                    Revisado por {{ req.reviewer?.username || 'Oficial' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div
        *ngIf="pendingDecision"
        class="modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-modal-title"
        (click)="closeReviewModal()"
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
              &middot; Monto solicitado: <strong class="ui-mono">C$ {{ formatNumber(pendingDecision.request.requested_limit) }}</strong>
            </p>

            <div class="form-group">
              <label for="credit-review-notes">Observaciones o justificación</label>
              <textarea
                id="credit-review-notes"
                rows="3"
                class="form-input"
                [(ngModel)]="reviewNotes"
                name="reviewNotes"
                placeholder="Detalle opcional sobre la decisión..."
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
    </div>
  `,
  styleUrl: './credit-requests.component.css',
})
export class CreditRequestsComponent implements OnInit {
  private readonly requestService = inject(CreditRequestsService);
  readonly formatChannelLabel = formatChannelLabel;
  readonly formatRequestStatusLabel = formatRequestStatusLabel;

  requests: CreditRequestItem[] = [];
  loading = false;
  errorMessage = '';
  feedbackMessage = '';
  feedbackType: 'success' | 'error' = 'success';

  pendingDecision: { request: CreditRequestItem; action: 'APPROVE' | 'REJECT' } | null = null;
  reviewNotes = '';
  reviewError = '';
  resolving = false;

  ngOnInit(): void {
    this.loadRequests();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.pendingDecision && !this.resolving) {
      this.closeReviewModal();
    }
  }

  loadRequests(): void {
    this.loading = true;
    this.errorMessage = '';
    this.requestService.findAll().subscribe({
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

  openReviewModal(request: CreditRequestItem, action: 'APPROVE' | 'REJECT'): void {
    this.pendingDecision = { request, action };
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

    this.requestService.review(request.id, action, this.reviewNotes.trim()).subscribe({
      next: () => {
        this.resolving = false;
        this.closeReviewModal();
        this.feedbackType = 'success';
        this.feedbackMessage =
          action === 'APPROVE'
            ? 'Solicitud aprobada y límite actualizado en el libro mayor.'
            : 'Solicitud rechazada correctamente.';
        this.loadRequests();
      },
      error: (err) => {
        this.resolving = false;
        this.reviewError = err.error?.message || 'Error al procesar la resolución.';
      },
    });
  }

  formatNumber(val: string | number): string {
    return Number(val).toLocaleString('es-NI', { minimumFractionDigits: 2 });
  }
}

