import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Subscription, interval, switchMap, takeWhile } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { AdminService } from '../../core/services/admin.service';
import { getApiBaseUrl } from '../../core/config/api.config';
import { ClientProfile, Company } from '../../core/models';
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
    <div class="bento-card ui-col-12">
      <div class="card-title">
        <i class="paper plane icon" aria-hidden="true"></i>
        <h2>Notificar clientes por WhatsApp (OpenClaw)</h2>
      </div>
      <p class="card-desc">
        Envía un saludo de bienvenida con el menú de consultas (crédito aprobado, crédito disponible, últimos
        movimientos y solicitudes de crédito) usando el WhatsApp conectado en OpenClaw.
      </p>

      <div class="notify-preview" *ngIf="preview">
        <strong>Mensaje que recibirá el cliente:</strong>
        <pre>{{ preview }}</pre>
      </div>

      <div class="notify-modes">
        <label class="mode-option">
          <input type="radio" name="notifyMode" value="one" [(ngModel)]="mode" (change)="confirmingBulk = false" />
          Un cliente
        </label>
        <label class="mode-option">
          <input type="radio" name="notifyMode" value="all" [(ngModel)]="mode" (change)="confirmingBulk = false" />
          Todos los clientes activos
        </label>
      </div>

      <div *ngIf="mode === 'one'" class="notify-row">
        <input
          type="text"
          class="ui-input"
          [(ngModel)]="search"
          (keyup.enter)="loadClients()"
          aria-label="Buscar cliente por nombre, cédula o carnet"
          placeholder="Buscar por nombre, cédula o carnet y presionar Enter"
        />
        <button type="button" class="ui-btn secondary-btn" (click)="loadClients()" [disabled]="loadingClients">
          <i class="search icon" aria-hidden="true"></i>
          {{ loadingClients ? 'Buscando...' : 'Buscar' }}
        </button>
        <select class="ui-input client-select" [(ngModel)]="selectedClientId" aria-label="Seleccionar cliente">
          <option value="">-- Seleccione un cliente --</option>
          <option *ngFor="let c of clients" [value]="c.id">
            {{ c.full_name }} · {{ c.employee_code }} · {{ c.employer_name || 'Sin empresa' }} · {{ c.whatsapp_phone }} ({{ formatCreditStatusLabel(c.credit_status) }})
          </option>
        </select>
        <button
          type="button"
          class="ui-btn primary-btn"
          [disabled]="!selectedClientId || sending"
          (click)="sendOne()"
        >
          <i class="paper plane icon" aria-hidden="true"></i>
          {{ sending ? 'Enviando...' : 'Enviar bienvenida' }}
        </button>
      </div>
      <p *ngIf="mode === 'one' && clientsLoaded && clients.length === 0" class="notify-hint">
        No se encontraron clientes con número de WhatsApp registrado para esa búsqueda.
      </p>

      <div *ngIf="mode === 'all'" class="notify-row">
        <select
          class="ui-input"
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
          class="ui-btn primary-btn"
          [disabled]="sending || job?.status === 'RUNNING'"
          (click)="confirmingBulk = true"
        >
          <i class="bullhorn icon" aria-hidden="true"></i>
          Enviar a todos los activos con WhatsApp
        </button>
        <div *ngIf="confirmingBulk" class="bulk-confirm-bar" role="region" aria-label="Confirmar envío masivo">
          <span>¿Confirmar envío a todos los clientes activos de <strong>{{ selectedScopeLabel }}</strong>?</span>
          <button type="button" class="ui-btn secondary-btn" (click)="confirmingBulk = false" [disabled]="sending">
            Cancelar
          </button>
          <button type="button" class="ui-btn primary-btn" (click)="sendAll()" [disabled]="sending">
            <i class="check icon" aria-hidden="true"></i>
            Confirmar envío
          </button>
        </div>
      </div>
      <p *ngIf="mode === 'all'" class="notify-hint">
        Los mensajes se envían uno por uno con una pausa entre cada uno para no saturar la cuenta de WhatsApp.
      </p>

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

      <div *ngIf="job" class="notify-job">
        <div>
          Estado: <strong>{{ job.status === 'RUNNING' ? 'Enviando...' : 'Finalizado' }}</strong> ·
          Procesados {{ job.processed }}/{{ job.total }} · Enviados {{ job.sent }} · Fallidos {{ job.failed }}
        </div>
        <progress [value]="job.processed" [max]="job.total"></progress>
        <ul *ngIf="job.errors.length > 0" class="notify-errors">
          <li *ngFor="let e of job.errors">{{ e.full_name }} ({{ e.phone || 'sin teléfono' }}): {{ e.error }}</li>
        </ul>
      </div>
    </div>
  `,
  styles: [
    `
      .card-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .card-title h2 {
        margin: 0;
        font-size: 1.15rem;
      }
      .card-desc {
        color: var(--gray-text);
        margin: 0.4rem 0 1rem;
      }
      .notify-preview pre {
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 0.5rem;
        padding: 0.75rem 1rem;
        white-space: pre-wrap;
        font-family: inherit;
        margin-top: 0.4rem;
      }
      .notify-modes {
        display: flex;
        gap: 1.5rem;
        margin: 1rem 0;
      }
      .mode-option {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        font-weight: 500;
        cursor: pointer;
      }
      .notify-row {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
        align-items: center;
      }
      .notify-row .ui-input {
        padding: 0.55rem 0.75rem;
        border: 1px solid var(--gray-border);
        border-radius: 0.5rem;
        min-width: 240px;
      }
      .client-select {
        flex: 1 1 320px;
      }
      .bulk-confirm-bar {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        background: #fefce8;
        border: 1px solid #fde047;
        border-radius: 0.5rem;
      }
      .notify-hint {
        font-size: 0.85rem;
        color: var(--gray-text);
        margin-top: 0.65rem;
      }
      .notify-job {
        margin-top: 1rem;
      }
      .notify-job progress {
        width: 100%;
        margin-top: 0.5rem;
      }
      .notify-errors {
        font-size: 0.8rem;
        color: #991b1b;
        margin-top: 0.5rem;
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

  ngOnInit(): void {
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

  loadClients(): void {
    this.loadingClients = true;
    const headers = new HttpHeaders({ Authorization: `Bearer ${this.auth.token() || ''}` });
    let url = `${getApiBaseUrl()}/clients?`;
    if (this.search.trim()) url += `search=${encodeURIComponent(this.search.trim())}&`;
    this.http.get<ClientProfile[]>(url, { headers }).subscribe({
      next: (data) => {
        this.clients = data.filter((c) => (c.whatsapp_phone || '').trim().length > 0);
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
