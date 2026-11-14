import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Subscription, interval, switchMap, takeWhile } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { AdminService } from '../../core/services/admin.service';
import { getApiBaseUrl } from '../../core/config/api.config';
import { ClientProfile, Company, UserRole } from '../../core/models';
import { StatusBannerComponent } from '../../shared/status-banner.component';
import { formatCreditStatusLabel } from '../../shared/ui-labels';
import {
  NotificationBulkJob,
  NotificationSendResult,
  WhatsappNotificationsService,
} from '../../core/services/whatsapp-notifications.service';

@Component({
  selector: 'app-whatsapp-notify',
  standalone: true,
  imports: [CommonModule, FormsModule, StatusBannerComponent],
  template: `
    <div class="bento-card notify-card" *ngIf="canSendNotifications">
      <div class="notify-header">
        <div class="card-title">
          <i class="paper plane icon" aria-hidden="true"></i>
          <h2>Notificar clientes por WhatsApp (OpenClaw)</h2>
        </div>
        <span class="notify-badge">
          <i class="check circle icon" aria-hidden="true"></i> Envío saliente activo
        </span>
      </div>

      <p class="card-desc">
        Envía un saludo de bienvenida con el menú de consultas (crédito aprobado, crédito disponible, últimos
        movimientos y solicitudes de crédito) usando el WhatsApp conectado en OpenClaw.
      </p>

      <div class="notify-preview" *ngIf="preview">
        <div class="preview-label">
          <i class="whatsapp icon" aria-hidden="true"></i>
          <strong>Vista previa del mensaje que recibirá el cliente</strong>
        </div>
        <pre>{{ preview }}</pre>
      </div>

      <div class="notify-modes" role="tablist" aria-label="Modo de notificación">
        <button
          type="button"
          role="tab"
          class="mode-tab-btn"
          [class.active]="mode === 'one'"
          [attr.aria-selected]="mode === 'one'"
          (click)="setMode('one')"
        >
          <i class="user icon" aria-hidden="true"></i> Un cliente
        </button>
        <button
          type="button"
          role="tab"
          class="mode-tab-btn"
          [class.active]="mode === 'all'"
          [attr.aria-selected]="mode === 'all'"
          (click)="setMode('all')"
        >
          <i class="users icon" aria-hidden="true"></i> Todos los clientes activos
        </button>
      </div>

      <div *ngIf="mode === 'one'" class="notify-panel">
        <div class="notify-search-group">
          <input
            type="text"
            class="ui-input search-input"
            [(ngModel)]="search"
            (keyup.enter)="loadClients()"
            aria-label="Buscar cliente por nombre, cédula o carnet"
            placeholder="Buscar por nombre, cédula o carnet..."
          />
          <button type="button" class="ui-btn secondary-btn search-btn" (click)="loadClients()" [disabled]="loadingClients">
            <i [ngClass]="loadingClients ? 'spinner loading icon' : 'search icon'" aria-hidden="true"></i>
            {{ loadingClients ? 'Buscando...' : 'Buscar' }}
          </button>
        </div>

        <div class="notify-action-group">
          <select class="ui-input client-select" [(ngModel)]="selectedClientId" aria-label="Seleccionar cliente">
            <option value="">-- Seleccione un cliente ({{ clients.length }} disponibles) --</option>
            <option *ngFor="let c of clients" [value]="c.id">
              {{ c.full_name }} · {{ c.employee_code }} · {{ c.whatsapp_phone }} · {{ formatCreditStatusLabel(c.credit_status) }}
            </option>
          </select>
          <button
            type="button"
            class="ui-btn primary-btn send-btn"
            [disabled]="!selectedClientId || sending"
            (click)="sendOne()"
          >
            <i [ngClass]="sending ? 'spinner loading icon' : 'paper plane icon'" aria-hidden="true"></i>
            {{ sending ? 'Enviando...' : 'Enviar bienvenida' }}
          </button>
        </div>

        <p *ngIf="clientsLoaded && clients.length === 0" class="notify-hint">
          No se encontraron clientes con número de WhatsApp registrado para esa búsqueda.
        </p>
      </div>

      <div *ngIf="mode === 'all'" class="notify-panel">
        <div class="notify-action-group">
          <select
            class="ui-input client-select"
            [(ngModel)]="employerId"
            (change)="confirmingBulk = false"
            aria-label="Filtrar por empresa empleadora"
          >
            <option value="">Todas las empresas</option>
            <option *ngFor="let e of employers" [value]="e.id">{{ e.name }}</option>
          </select>
          <button
            *ngIf="!confirmingBulk"
            type="button"
            class="ui-btn primary-btn send-btn"
            [disabled]="sending || job?.status === 'RUNNING'"
            (click)="confirmingBulk = true"
          >
            <i class="bullhorn icon" aria-hidden="true"></i>
            Enviar a todos los activos
          </button>
        </div>

        <div *ngIf="confirmingBulk" class="bulk-confirm-bar" role="region" aria-label="Confirmar envío masivo">
          <span class="bulk-confirm-text">
            <i class="exclamation triangle icon" aria-hidden="true"></i>
            ¿Confirmar envío a todos los clientes activos de <strong>{{ selectedScopeLabel }}</strong>?
          </span>
          <div class="bulk-confirm-actions">
            <button type="button" class="ui-btn secondary-btn" (click)="confirmingBulk = false" [disabled]="sending">
              Cancelar
            </button>
            <button type="button" class="ui-btn primary-btn" (click)="sendAll()" [disabled]="sending">
              <i class="check icon" aria-hidden="true"></i>
              Confirmar envío
            </button>
          </div>
        </div>

        <p class="notify-hint">
          Los mensajes se envían de forma escalonada con una pausa entre cada cliente para proteger la sesión de WhatsApp.
        </p>
      </div>

      <app-status-banner
        [message]="errorMsg"
        type="error"
        (dismiss)="errorMsg = ''"
      ></app-status-banner>

      <app-status-banner
        *ngIf="oneResult"
        [message]="oneResultMessage"
        [type]="oneResult.ok ? 'success' : 'error'"
        (dismiss)="oneResult = null"
      ></app-status-banner>

      <div *ngIf="job" class="notify-job" aria-live="polite">
        <div class="job-summary">
          <span class="job-status-pill" [class.done]="job.status === 'COMPLETED'">
            {{ job.status === 'RUNNING' ? 'Enviando...' : 'Finalizado' }}
          </span>
          <div class="job-counters ui-mono">
            <span>Procesados: <strong>{{ job.processed }}/{{ job.total }}</strong></span>
            <span class="ui-credit-ok">Enviados: <strong>{{ job.sent }}</strong></span>
            <span [class.ui-credit-danger]="job.failed > 0">Fallidos: <strong>{{ job.failed }}</strong></span>
          </div>
        </div>
        <div class="notify-progress-track" role="progressbar" [attr.aria-valuenow]="job.processed" [attr.aria-valuemax]="job.total">
          <div class="notify-progress-fill" [style.width.%]="progressPercent"></div>
        </div>
        <ul *ngIf="job.errors.length > 0" class="notify-errors">
          <li *ngFor="let e of job.errors">{{ e.full_name }} ({{ e.phone || 'sin teléfono' }}): {{ e.error }}</li>
        </ul>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        grid-column: 1 / -1;
        min-width: 0;
      }

      .notify-card {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .notify-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 10px;
      }

      .card-title {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }

      .card-title > i.icon {
        margin: 0;
        color: var(--text-secondary);
        flex-shrink: 0;
      }

      .card-title h2 {
        margin: 0;
        font-size: 17px;
        font-weight: 700;
        color: var(--text-primary);
      }

      .notify-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: var(--ui-small-size);
        font-weight: 600;
        background: var(--emerald-subtle);
        border: 1px solid var(--success-border);
        color: var(--emerald-text);
      }

      .notify-badge > i.icon {
        margin: 0;
      }

      .card-desc {
        color: var(--text-muted);
        font-size: var(--ui-control-size);
        margin: 0;
      }

      .notify-preview {
        background: var(--emerald-subtle);
        border: 1px solid var(--success-border);
        border-radius: 10px;
        padding: 12px 14px;
      }

      .preview-label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: var(--ui-small-size);
        color: var(--emerald-text);
        margin-bottom: 8px;
      }

      .preview-label > i.icon {
        margin: 0;
      }

      .notify-preview pre {
        margin: 0;
        padding: 10px 12px;
        background: var(--white-card);
        border: 1px solid var(--success-border);
        border-radius: 8px;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        font-family: var(--font-body);
        font-size: var(--ui-control-size);
        line-height: 1.5;
        color: var(--text-primary);
      }

      .notify-modes {
        display: inline-flex;
        flex-wrap: wrap;
        align-self: flex-start;
        gap: 6px;
        padding: 4px;
        background: var(--surface-balance);
        border: 1px solid var(--balance-border);
        border-radius: 10px;
        max-width: 100%;
      }

      .mode-tab-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-height: 40px;
        padding: 8px 14px;
        border: none;
        border-radius: 7px;
        background: transparent;
        color: var(--text-secondary);
        font-family: var(--font-body);
        font-size: var(--ui-control-size);
        font-weight: 600;
        cursor: pointer;
        transition:
          background-color 160ms,
          color 160ms;
      }

      .mode-tab-btn > i.icon {
        margin: 0;
      }

      .mode-tab-btn:hover {
        background: var(--scrim-surface-hover);
        color: var(--text-primary);
      }

      .mode-tab-btn.active {
        background: var(--white-card);
        color: var(--text-primary);
        box-shadow: var(--shadow-control);
      }

      .mode-tab-btn.active > i.icon {
        color: var(--action-surface);
      }

      .notify-panel {
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-width: 0;
      }

      .notify-search-group,
      .notify-action-group {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: stretch;
        min-width: 0;
      }

      .notify-panel .ui-input {
        min-height: 42px;
        padding: 9px 12px;
        border: 1px solid var(--input-border);
        border-radius: var(--radius-control);
        font-size: var(--ui-control-size);
        min-width: 0;
      }

      .search-input {
        flex: 1 1 240px;
      }

      .client-select {
        flex: 1 1 300px;
        width: 100%;
        text-overflow: ellipsis;
      }

      .search-btn,
      .send-btn {
        flex-shrink: 0;
        white-space: nowrap;
      }

      .bulk-confirm-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 12px;
        padding: 12px 14px;
        background: var(--amber-subtle);
        border: 1px solid var(--warning-border);
        border-radius: 10px;
        color: var(--amber-text);
        font-size: var(--ui-control-size);
      }

      .bulk-confirm-text {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }

      .bulk-confirm-text > i.icon {
        margin: 0;
        flex-shrink: 0;
      }

      .bulk-confirm-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .notify-hint {
        font-size: var(--ui-small-size);
        color: var(--text-muted);
        margin: 0;
      }

      .notify-job {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 14px;
        background: var(--surface-balance);
        border: 1px solid var(--balance-border);
        border-radius: 10px;
      }

      .job-summary {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 10px;
      }

      .job-status-pill {
        display: inline-flex;
        align-items: center;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: var(--ui-small-size);
        font-weight: 700;
        background: var(--amber-subtle);
        color: var(--amber-text);
        border: 1px solid var(--warning-border);
      }

      .job-status-pill.done {
        background: var(--emerald-subtle);
        color: var(--emerald-text);
        border-color: var(--success-border);
      }

      .job-counters {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        font-size: var(--ui-small-size);
        color: var(--text-secondary);
      }

      .notify-progress-track {
        width: 100%;
        height: 10px;
        background: var(--balance-progress-track);
        border-radius: 999px;
        overflow: hidden;
      }

      .notify-progress-fill {
        height: 100%;
        background: var(--emerald-main);
        border-radius: 999px;
        transition: width 220ms ease;
      }

      .notify-errors {
        font-size: var(--ui-small-size);
        color: var(--red-main);
        margin: 0;
        padding-left: 18px;
        overflow-wrap: anywhere;
      }

      @container workspace (max-width: 760px) {
        .notify-modes {
          width: 100%;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .mode-tab-btn {
          min-height: 44px;
          padding: 8px 10px;
        }

        .search-btn,
        .send-btn,
        .bulk-confirm-actions,
        .bulk-confirm-actions .ui-btn {
          width: 100%;
        }

        .search-input,
        .client-select {
          flex-basis: 100%;
        }
      }
    `,
  ],
})
export class WhatsappNotifyComponent implements OnInit, OnDestroy {
  private readonly notifications = inject(WhatsappNotificationsService);
  private readonly admin = inject(AdminService);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  readonly formatCreditStatusLabel = formatCreditStatusLabel;

  mode: 'one' | 'all' = 'one';
  preview = '';
  search = '';
  clients: ClientProfile[] = [];
  clientsLoaded = false;
  loadingClients = false;
  employers: Company[] = [];
  selectedClientId = '';
  employerId = '';
  confirmingBulk = false;
  sending = false;
  errorMsg = '';
  oneResult: NotificationSendResult | null = null;
  job: NotificationBulkJob | null = null;
  private pollSub?: Subscription;

  get canSendNotifications(): boolean {
    return this.auth.hasRole(UserRole.SUPER_ADMIN, UserRole.CREDIT_MANAGER);
  }

  get selectedScopeLabel(): string {
    return this.employerId
      ? this.employers.find((e) => e.id === this.employerId)?.name ?? 'la empresa seleccionada'
      : 'todas las empresas';
  }

  get oneResultMessage(): string {
    if (!this.oneResult) return '';
    const phone = this.oneResult.phone || 'sin teléfono válido';
    return `${this.oneResult.full_name} (${phone}): ${
      this.oneResult.ok ? 'mensaje de bienvenida enviado correctamente.' : this.oneResult.error
    }`;
  }

  get progressPercent(): number {
    if (!this.job || this.job.total <= 0) return 0;
    return Math.min(100, Math.round((this.job.processed / this.job.total) * 100));
  }

  ngOnInit(): void {
    if (!this.canSendNotifications) return;

    this.notifications.getPreview().subscribe({
      next: (r) => (this.preview = r.message),
      error: (err) => (this.errorMsg = err.error?.message || 'No se pudo cargar la vista previa del mensaje.'),
    });
    this.admin.getEmployerCompanies().subscribe({
      next: (c) => (this.employers = c),
    });
    this.loadClients();
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
  }

  setMode(nextMode: 'one' | 'all'): void {
    this.mode = nextMode;
    this.confirmingBulk = false;
  }

  loadClients(): void {
    if (!this.canSendNotifications) return;
    this.loadingClients = true;
    const headers = new HttpHeaders({ Authorization: `Bearer ${this.auth.token() || ''}` });
    let url = `${getApiBaseUrl()}/clients?`;
    if (this.search.trim()) url += `search=${encodeURIComponent(this.search.trim())}&`;
    this.http.get<ClientProfile[]>(url, { headers }).subscribe({
      next: (data) => {
        this.clients = data.filter((c) => (c.whatsapp_phone || '').trim().length > 0);
        if (this.clients.length === 1) {
          this.selectedClientId = this.clients[0].id;
        } else if (this.selectedClientId && !this.clients.some((c) => c.id === this.selectedClientId)) {
          this.selectedClientId = '';
        }
        this.clientsLoaded = true;
        this.loadingClients = false;
      },
      error: (err) => {
        this.errorMsg = err.error?.message || 'No se pudo cargar la lista de clientes.';
        this.loadingClients = false;
      },
    });
  }

  sendOne(): void {
    this.reset();
    this.sending = true;
    this.notifications.sendToClient(this.selectedClientId).subscribe({
      next: (r) => {
        this.oneResult = r;
        this.sending = false;
      },
      error: (err) => {
        this.errorMsg = err.error?.message || 'No se pudo enviar el mensaje.';
        this.sending = false;
      },
    });
  }

  sendAll(): void {
    this.confirmingBulk = false;
    this.reset();
    this.sending = true;
    this.notifications.sendBulk(this.employerId || undefined).subscribe({
      next: (job) => {
        this.job = job;
        this.sending = false;
        this.pollJob(job.id);
      },
      error: (err) => {
        this.errorMsg = err.error?.message || 'No se pudo iniciar el envío masivo.';
        this.sending = false;
      },
    });
  }

  private pollJob(jobId: string): void {
    this.pollSub?.unsubscribe();
    this.pollSub = interval(2000)
      .pipe(
        switchMap(() => this.notifications.getJob(jobId)),
        takeWhile((j) => j.status === 'RUNNING', true),
      )
      .subscribe({
        next: (j) => (this.job = j),
        error: (err) => (this.errorMsg = err.error?.message || 'No se pudo consultar el progreso.'),
      });
  }

  private reset(): void {
    this.errorMsg = '';
    this.oneResult = null;
    this.job = null;
    this.pollSub?.unsubscribe();
  }
}
