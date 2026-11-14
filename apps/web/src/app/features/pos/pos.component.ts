import {
  Component,
  OnInit,
  HostListener,
  ViewChild,
  ElementRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PosService } from '../../core/services/pos.service';
import { AuthService } from '../../core/services/auth.service';
import {
  ClientProfile,
  VoucherDetails,
  AvailabilityTicket,
} from '../../core/models';
import { VoucherComponent } from '../voucher/voucher.component';
import { StatusBannerComponent } from '../../shared/status-banner.component';
import {
  formatCreditStatusLabel,
  formatTransactionStatusLabel,
} from '../../shared/ui-labels';

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [CommonModule, FormsModule, VoucherComponent, StatusBannerComponent],
  template: `
    <div class="pos-container">
      <!-- Cinta superior de terminal y atajos de teclado -->
      <div class="pos-ribbon bento-card">
        <div class="ribbon-title">
          <i class="cash register icon" aria-hidden="true"></i>
          <h1>Terminal de caja: {{ activeTerminal?.terminal_code || 'POS-CAJA-01' }}{{ activeTerminal?.name ? ' - ' + activeTerminal.name : '' }}</h1>
        </div>
        <div class="ribbon-shortcuts">
          <span class="shortcut-item"><span class="key-badge">F2</span> Escanear Cédula / Carnet</span>
          <span class="shortcut-item"><span class="key-badge">F4</span> Procesar Cobro</span>
          <span class="shortcut-item"><span class="key-badge">F8</span> Reimprimir Último Voucher</span>
        </div>
      </div>

      <app-status-banner
        [message]="feedbackMessage"
        [type]="feedbackType"
        (dismiss)="feedbackMessage = ''"
      ></app-status-banner>

      <!-- Cuadrícula principal (12 columnas) -->
      <div class="bento-grid">
        <!-- Búsqueda de cliente por escáner o cédula -->
        <div class="bento-card pos-search-card ui-col-12">
          <div class="scanner-input-group">
            <div class="scanner-field">
              <i class="barcode icon scanner-icon" aria-hidden="true"></i>
              <input
                #scanInput
                type="text"
                class="scanner-input ui-mono"
                aria-label="Escanear Código de Barras, Cédula o Carnet"
                [(ngModel)]="searchQuery"
                (keydown.enter)="onSearchClient()"
                placeholder="Escanear Código de Barras / Cédula / Carnet y presionar ENTER (Atajo: F2)..."
                autocomplete="off"
              />
            </div>
            <button
              type="button"
              class="ui button scan-btn"
              [class.primary]="!client"
              [class.basic]="!!client"
              (click)="onSearchClient()"
              [disabled]="searching"
            >
              <i class="search icon" aria-hidden="true"></i> Consultar
            </button>
          </div>
          <div *ngIf="searchError" class="ui negative tiny message pos-inline-alert" role="alert">
            {{ searchError }}
          </div>
        </div>

        <!-- Tarjeta de cliente y saldo disponible -->
        <div
          class="bento-card pos-client-card ui-col-7"
          [ngClass]="client?.status_color_class || 'emerald'"
        >
          <div *ngIf="searching && !client" class="ui-state-box" role="status" aria-live="polite">
            <i class="spinner loading icon" aria-hidden="true"></i>
            <span>Consultando saldo del cliente...</span>
          </div>

          <div *ngIf="!searching && !client" class="empty-state">
            <i class="id card outline icon empty-icon" aria-hidden="true"></i>
            <h2>Esperando Lectura de Cliente</h2>
            <p>Acerque el carnet con código de barras o digite la cédula para visualizar la línea de crédito.</p>
          </div>

          <div *ngIf="client" class="client-details">
            <div class="client-header">
              <div>
                <span class="client-name">{{ client.full_name }}</span>
                <div class="client-meta">
                  <span class="ui-mono"><i class="id badge outline icon" aria-hidden="true"></i> {{ client.employee_code }}</span>
                  <span class="ui-mono"><i class="address card outline icon" aria-hidden="true"></i> {{ client.national_id }}</span>
                  <span><i class="briefcase icon" aria-hidden="true"></i> {{ client.job_title }} ({{ client.classification }})</span>
                </div>
              </div>

              <span
                class="badge-status"
                [ngClass]="{
                  active: client.credit_status === 'ACTIVE' && client.status_color_class !== 'amber',
                  amber: client.status_color_class === 'amber',
                  blocked: client.credit_status !== 'ACTIVE'
                }"
              >
                {{ formatCreditStatusLabel(client.credit_status) }}
              </span>
            </div>

            <div class="employer-tag">
              <i class="building outline icon" aria-hidden="true"></i> {{ client.employer_name }}
            </div>

            <!-- Big Available Balance -->
            <div class="balance-card">
              <span class="balance-label">Crédito disponible para compra</span>
              <div
                class="balance-display"
                [class.ui-credit-warning]="client.status_color_class === 'amber'"
                [class.ui-credit-danger]="client.status_color_class === 'red'"
              >
                <span class="balance-currency">C$</span>{{ formatNumber(client.available_balance) }}
              </div>
              <div class="progress-bar-container">
                <div
                  class="progress-bar-fill"
                  [style.width.%]="client.consumption_percentage"
                  [class.ui-credit-warning]="client.status_color_class === 'amber'"
                  [class.ui-credit-danger]="client.status_color_class === 'red'"
                ></div>
              </div>
              <div class="balance-submetrics">
                <span>Límite Autorizado: <strong class="ui-mono">C$ {{ formatNumber(client.approved_limit) }}</strong></span>
                <span>Consumido: <strong class="ui-mono">C$ {{ formatNumber(client.used_balance) }} ({{ client.consumption_percentage }}%)</strong></span>
              </div>
            </div>

            <!-- Action: Mini-Ticket Availability Inquiry -->
            <div class="client-actions">
              <button type="button" class="ui basic tiny button" (click)="printAvailabilityTicket()">
                <i class="ticket alternate icon" aria-hidden="true"></i> Mini-Ticket de Disponibilidad
              </button>
            </div>
          </div>
        </div>

        <!-- CHECKOUT PANEL CELL (5 COLUMNS) -->
        <div class="bento-card checkout-box ui-col-5">
          <div class="checkout-header">
            <h2><i class="shopping cart icon" aria-hidden="true"></i> Cobro de Compra</h2>
            <span class="step-tag">Paso Final</span>
          </div>

          <div *ngIf="checkoutError" class="ui negative message pos-inline-alert" role="alert">
            {{ checkoutError }}
          </div>

          <div class="checkout-form">
            <div class="form-field">
              <label for="pos-charge-amount">Monto a Cobrar (C$):</label>
              <div class="amount-input-wrapper">
                <span class="currency-symbol">C$</span>
                <input
                  id="pos-charge-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  class="amount-input"
                  [(ngModel)]="chargeAmount"
                  placeholder="0.00"
                />
              </div>

              <!-- Quick Denomination Chips -->
              <div class="quick-chips" *ngIf="client">
                <button type="button" class="chip-btn" (click)="addAmount(500)">+ C$ 500</button>
                <button type="button" class="chip-btn" (click)="addAmount(1000)">+ C$ 1,000</button>
                <button type="button" class="chip-btn" (click)="addAmount(2000)">+ C$ 2,000</button>
                <button type="button" class="chip-btn" (click)="chargeAmount = toNumber(client.available_balance)">Todo</button>
              </div>
            </div>

            <div class="form-field">
              <label for="pos-external-invoice">No. de Factura del ERP / Caja:</label>
              <input
                id="pos-external-invoice"
                type="text"
                class="ui-input ui-mono"
                [(ngModel)]="externalInvoice"
                placeholder="Ej. FACT-2026-9901"
              />
            </div>

            <div class="form-field">
              <label for="pos-charge-notes">Observaciones (Opcional):</label>
              <input
                id="pos-charge-notes"
                type="text"
                class="ui-input"
                [(ngModel)]="chargeNotes"
                placeholder="Ej. Compra de víveres / artículos de oficina"
              />
            </div>

            <button
              type="button"
              class="process-btn"
              [disabled]="!canProcessCharge() || processing"
              (click)="onProcessCharge()"
            >
              <span *ngIf="!processing">
                <i class="check circle icon" aria-hidden="true"></i>
                <span class="key-badge">F4</span> Procesar Cobro (<span class="ui-mono">C$ {{ formatNumber(chargeAmount || 0) }}</span>)
              </span>
              <span *ngIf="processing">
                <i class="spinner loading icon" aria-hidden="true"></i> Transando en Ledger...
              </span>
            </button>
          </div>
        </div>

        <!-- Historial reciente de movimientos -->
        <div class="bento-card pos-transactions-card ui-col-12">
          <div class="table-header">
            <h2><i class="history icon" aria-hidden="true"></i> Movimientos Recientes en Esta Caja</h2>
            <button type="button" class="ui basic tiny button" (click)="loadRecentTransactions()" [disabled]="loadingRecent">
              <i class="refresh icon" aria-hidden="true"></i> {{ loadingRecent ? 'Actualizando...' : 'Actualizar' }}
            </button>
          </div>

          <div *ngIf="recentError" class="ui-banner error pos-table-alert" role="alert">
            <span class="ui-banner-msg">
              <i class="exclamation triangle icon" aria-hidden="true"></i> {{ recentError }}
            </span>
            <button type="button" class="ui-btn primary-btn" (click)="loadRecentTransactions()">Reintentar</button>
          </div>

          <div *ngIf="loadingRecent && recentTransactions.length === 0" class="ui-state-box" role="status" aria-live="polite">
            <i class="spinner loading icon" aria-hidden="true"></i>
            <span>Cargando movimientos de la caja...</span>
          </div>

          <div *ngIf="!recentError && (!loadingRecent || recentTransactions.length > 0)" class="table-responsive">
            <table class="ui selectable table">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Autorización</th>
                  <th>Voucher</th>
                  <th>Cliente</th>
                  <th>Factura ERP</th>
                  <th class="ui-amount-cell">Monto</th>
                  <th class="ui-amount-cell">Disponible Posterior</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let tx of recentTransactions">
                  <td class="ui-mono">{{ tx.created_at | date: 'HH:mm:ss' }}</td>
                  <td class="ui-mono"><strong>{{ tx.authorization_code }}</strong></td>
                  <td class="ui-mono">{{ tx.voucher_number }}</td>
                  <td>{{ tx.client.full_name }}</td>
                  <td class="ui-mono">{{ tx.external_invoice_number }}</td>
                  <td class="ui-amount-cell"><strong>C$ {{ formatNumber(tx.amount) }}</strong></td>
                  <td class="ui-amount-cell">C$ {{ formatNumber(tx.new_available_balance) }}</td>
                  <td>
                    <span
                      class="badge-status"
                      [ngClass]="{
                        active: tx.status === 'APPROVED',
                        blocked: tx.status === 'VOIDED'
                      }"
                    >
                      {{ formatTransactionStatusLabel(tx.status) }}
                    </span>
                  </td>
                  <td class="pos-row-actions">
                    <button
                      type="button"
                      class="ui mini icon basic button"
                      (click)="viewVoucher(tx)"
                      aria-label="Ver e Imprimir Voucher"
                      title="Ver e Imprimir Voucher"
                    >
                      <i class="print icon" aria-hidden="true"></i>
                    </button>
                    <button
                      type="button"
                      *ngIf="tx.status === 'APPROVED'"
                      class="ui mini icon basic red button"
                      (click)="promptVoid(tx)"
                      aria-label="Anular Transacción"
                      title="Anular Transacción"
                    >
                      <i class="ban icon" aria-hidden="true"></i>
                    </button>
                  </td>
                </tr>
                <tr *ngIf="recentTransactions.length === 0">
                  <td colspan="9" class="pos-table-empty">
                    No hay transacciones registradas en el turno actual.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Modal de voucher térmico -->
      <div
        class="modal-overlay"
        *ngIf="activeVoucher"
        role="dialog"
        aria-modal="true"
        aria-label="Comprobante térmico de venta"
        (click)="activeVoucher = null"
      >
        <div class="modal-content" (click)="$event.stopPropagation()">
          <app-voucher [voucher]="activeVoucher" (close)="activeVoucher = null"></app-voucher>
        </div>
      </div>

      <!-- Modal de ticket de disponibilidad -->
      <div
        class="modal-overlay"
        *ngIf="availabilityTicket"
        role="dialog"
        aria-modal="true"
        aria-labelledby="availability-modal-title"
        (click)="availabilityTicket = null"
      >
        <div class="modal-content bento-card availability-modal" (click)="$event.stopPropagation()">
          <div class="availability-header">
            <h2 id="availability-modal-title"><i class="ticket alternate icon" aria-hidden="true"></i> Consulta de Disponibilidad</h2>
            <p>Ticket Informativo de Caja</p>
          </div>

          <div class="ticket-preview ui-mono">
            <div><strong>CLIENTE:</strong> {{ availabilityTicket.client.full_name }}</div>
            <div><strong>CEDULA:</strong> {{ availabilityTicket.client.masked_national_id }}</div>
            <div><strong>EMPRESA:</strong> {{ availabilityTicket.client.employer_name }}</div>
            <hr />
            <div>LIMITE TOTAL: C$ {{ formatNumber(availabilityTicket.approved_limit) }}</div>
            <div>CONSUMIDO: C$ {{ formatNumber(availabilityTicket.used_balance) }}</div>
            <div class="ticket-available ui-credit-ok">
              DISPONIBLE: C$ {{ formatNumber(availabilityTicket.available_balance) }}
            </div>
          </div>

          <div class="availability-actions">
            <button type="button" class="ui primary fluid button" (click)="windowPrint()">
              <i class="print icon" aria-hidden="true"></i> Imprimir Ticket
            </button>
            <button type="button" class="ui basic fluid button" (click)="availabilityTicket = null">
              Cerrar
            </button>
          </div>
        </div>
      </div>

      <!-- Modal de anulación de transacción -->
      <div
        class="modal-overlay"
        *ngIf="pendingVoidTx"
        role="dialog"
        aria-modal="true"
        aria-labelledby="void-modal-title"
        (click)="closeVoidModal()"
      >
        <div class="modal-content bento-card availability-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2 id="void-modal-title">Anular Transacción</h2>
            <button type="button" class="close-btn" aria-label="Cerrar ventana" (click)="closeVoidModal()">&times;</button>
          </div>
          <form (ngSubmit)="confirmVoid()" class="modal-form">
            <p class="pos-void-summary">
              Voucher <strong class="ui-mono">{{ pendingVoidTx.voucher_number }}</strong> &middot; Monto
              <strong class="ui-mono">C$ {{ formatNumber(pendingVoidTx.amount) }}</strong>
            </p>
            <div class="form-group">
              <label for="pos-void-reason">Motivo obligatorio de anulación *</label>
              <textarea
                id="pos-void-reason"
                rows="3"
                class="form-input"
                [(ngModel)]="voidReason"
                name="voidReason"
                placeholder="Ej. Error de digitación o devolución de producto"
                required
              ></textarea>
            </div>
            <div *ngIf="voidError" class="ui negative message" role="alert">{{ voidError }}</div>
            <div class="modal-actions">
              <button type="button" class="ui-btn secondary-btn" (click)="closeVoidModal()" [disabled]="voiding">
                Cancelar
              </button>
              <button type="submit" class="ui negative button" [disabled]="voiding || !voidReason.trim()">
                <i class="ban icon" *ngIf="!voiding" aria-hidden="true"></i>
                {{ voiding ? 'Anulando...' : 'Confirmar Anulación' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styleUrl: './pos.component.css',
})
export class PosComponent implements OnInit {
  @ViewChild('scanInput') scanInput?: ElementRef<HTMLInputElement>;

  private readonly posService = inject(PosService);
  private readonly auth = inject(AuthService);
  readonly formatCreditStatusLabel = formatCreditStatusLabel;
  readonly formatTransactionStatusLabel = formatTransactionStatusLabel;

  searchQuery = '001-121092-0000X'; // Default demo client
  client: ClientProfile | null = null;
  searching = false;
  searchError = '';

  activeTerminal: any = null;

  chargeAmount: number | null = null;
  externalInvoice = 'FACT-2026-001';
  chargeNotes = '';
  processing = false;
  checkoutError = '';

  recentTransactions: VoucherDetails[] = [];
  loadingRecent = false;
  recentError = '';
  activeVoucher: VoucherDetails | null = null;
  availabilityTicket: AvailabilityTicket | null = null;

  pendingVoidTx: VoucherDetails | null = null;
  voidReason = '';
  voiding = false;
  voidError = '';

  feedbackMessage = '';
  feedbackType: 'success' | 'error' | 'info' = 'success';

  ngOnInit(): void {
    this.loadActiveTerminal();
    this.onSearchClient();
    this.loadRecentTransactions();
  }

  loadActiveTerminal(): void {
    this.posService.getCashRegisters().subscribe({
      next: (registers) => {
        if (registers && registers.length > 0) {
          this.activeTerminal = registers[0];
        }
      },
      error: (err) => {
        console.warn('Terminal de caja no cargada automáticamente:', err);
      },
    });
  }

  // Global Ergonomic POS Keyboard Shortcuts: F2, F4, F8, Escape
  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (this.pendingVoidTx && !this.voiding) {
        this.closeVoidModal();
      } else if (this.activeVoucher) {
        this.activeVoucher = null;
      } else if (this.availabilityTicket) {
        this.availabilityTicket = null;
      }
      return;
    }

    if (event.key === 'F2') {
      event.preventDefault();
      this.scanInput?.nativeElement.focus();
      this.scanInput?.nativeElement.select();
    } else if (event.key === 'F4') {
      event.preventDefault();
      if (this.canProcessCharge()) {
        this.onProcessCharge();
      }
    } else if (event.key === 'F8') {
      event.preventDefault();
      if (this.recentTransactions.length > 0) {
        this.viewVoucher(this.recentTransactions[0]);
      }
    }
  }

  onSearchClient(): void {
    if (!this.searchQuery.trim()) return;
    this.searching = true;
    this.searchError = '';

    this.posService.scanClient(this.searchQuery.trim()).subscribe({
      next: (data) => {
        this.client = data;
        this.searching = false;
      },
      error: (err) => {
        this.searching = false;
        this.searchError = err.error?.message || 'Cliente no encontrado';
      },
    });
  }

  addAmount(val: number): void {
    this.chargeAmount = (this.chargeAmount || 0) + val;
  }

  canProcessCharge(): boolean {
    if (!this.client || this.client.credit_status !== 'ACTIVE') return false;
    if (!this.chargeAmount || this.chargeAmount <= 0) return false;
    if (this.chargeAmount > Number(this.client.available_balance)) return false;
    if (!this.externalInvoice.trim()) return false;
    return true;
  }

  onProcessCharge(): void {
    if (!this.client || !this.canProcessCharge()) return;
    this.processing = true;
    this.checkoutError = '';

    const payload: any = {
      client_id: this.client.id,
      amount: Number(this.chargeAmount),
      external_invoice_number: this.externalInvoice.trim(),
      idempotency_key: `pos_charge_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      notes: this.chargeNotes,
    };

    if (this.activeTerminal?.id) {
      payload.cash_register_id = this.activeTerminal.id;
      payload.merchant_company_id =
        this.activeTerminal.company_id ||
        this.auth.currentUser()?.company_id ||
        this.client.employer_company_id;
    } else if (this.auth.currentUser()?.company_id) {
      payload.merchant_company_id = this.auth.currentUser()?.company_id;
    }

    this.posService.checkout(payload).subscribe({
      next: (voucher) => {
        this.processing = false;
        this.activeVoucher = voucher;
        this.chargeAmount = null;
        this.externalInvoice = `FACT-${Date.now().toString().slice(-4)}`;
        const wa = voucher.whatsapp_notification;
        if (wa?.ok) {
          this.feedbackType = 'success';
          this.feedbackMessage = `Cobro autorizado (${voucher.voucher_number}). Notificación enviada por WhatsApp a ${wa.phone}.`;
        } else if (wa?.attempted) {
          this.feedbackType = 'info';
          this.feedbackMessage = `Cobro autorizado (${voucher.voucher_number}), pero falló la notificación por WhatsApp: ${wa.error || 'OpenClaw no disponible'}.`;
        } else if (wa) {
          this.feedbackType = 'info';
          this.feedbackMessage = `Cobro autorizado (${voucher.voucher_number}). ${wa.error || 'Cliente sin WhatsApp registrado'}.`;
        }
        // Refresh client balances & transactions
        this.onSearchClient();
        this.loadRecentTransactions();
      },
      error: (err) => {
        this.processing = false;
        this.checkoutError = err.error?.message || 'Error al procesar cobro en el libro mayor';
      },
    });
  }

  printAvailabilityTicket(): void {
    if (!this.client) return;
    this.feedbackMessage = '';
    this.posService.getAvailabilityTicket(this.client.id).subscribe({
      next: (ticket) => {
        this.availabilityTicket = ticket;
      },
      error: (err) => {
        this.feedbackType = 'error';
        this.feedbackMessage = err.error?.message || 'No se pudo generar el ticket de disponibilidad';
      },
    });
  }

  loadRecentTransactions(): void {
    this.loadingRecent = true;
    this.recentError = '';
    this.posService.getRecentTransactions().subscribe({
      next: (txs) => {
        this.recentTransactions = txs;
        this.loadingRecent = false;
      },
      error: (err) => {
        this.loadingRecent = false;
        this.recentError = err.error?.message || 'No se pudieron cargar los movimientos recientes.';
      },
    });
  }

  viewVoucher(tx: VoucherDetails): void {
    this.feedbackMessage = '';
    this.posService.getVoucher(tx.transaction_id || (tx as unknown as { id: string }).id).subscribe({
      next: (v) => {
        this.activeVoucher = v;
      },
      error: (err) => {
        this.feedbackType = 'error';
        this.feedbackMessage = err.error?.message || 'No se pudo recuperar el comprobante de venta.';
      },
    });
  }

  promptVoid(tx: VoucherDetails): void {
    this.pendingVoidTx = tx;
    this.voidReason = '';
    this.voidError = '';
  }

  closeVoidModal(): void {
    this.pendingVoidTx = null;
    this.voidReason = '';
    this.voidError = '';
  }

  confirmVoid(): void {
    if (!this.pendingVoidTx || !this.voidReason.trim()) return;
    const txId = this.pendingVoidTx.transaction_id || (this.pendingVoidTx as unknown as { id: string }).id;
    this.voiding = true;
    this.voidError = '';

    this.posService.voidTransaction(txId, this.voidReason.trim()).subscribe({
      next: () => {
        this.voiding = false;
        this.closeVoidModal();
        this.feedbackType = 'success';
        this.feedbackMessage = 'Transacción anulada exitosamente y saldo restituido en el libro mayor.';
        this.loadRecentTransactions();
        if (this.client) this.onSearchClient();
      },
      error: (err) => {
        this.voiding = false;
        this.voidError = err.error?.message || 'No se pudo anular la transacción';
      },
    });
  }

  windowPrint(): void {
    window.print();
  }

  formatNumber(val: string | number): string {
    return Number(val).toLocaleString('es-NI', { minimumFractionDigits: 2 });
  }

  toNumber(val: string): number {
    return Number(val) || 0;
  }
}
