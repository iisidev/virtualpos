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

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [CommonModule, FormsModule, VoucherComponent],
  template: `
    <div class="pos-container">
      <!-- Top Action Ribbon with Ergonomic Keyboard Hints -->
      <div class="pos-ribbon bento-card">
        <div class="ribbon-title">
          <i class="cash register icon"></i>
          <span>TERMINAL DE CAJA VIRTUAL</span>
        </div>
        <div class="ribbon-shortcuts">
          <span class="shortcut-item"><span class="key-badge">F2</span> Escanear Cédula / Carnet</span>
          <span class="shortcut-item"><span class="key-badge">F4</span> Procesar Cobro</span>
          <span class="shortcut-item"><span class="key-badge">F8</span> Reimprimir Último Voucher</span>
        </div>
      </div>

      <!-- Bento 12-Column Layout -->
      <div class="bento-grid" style="margin-top: 1.25rem;">
        <!-- SEARCH & SCANNER INPUT CELL (12 COLS) -->
        <div class="bento-card" style="grid-column: span 12; padding: 1.25rem;">
          <div class="scanner-input-group">
            <i class="barcode icon scanner-icon"></i>
            <input
              #scanInput
              type="text"
              class="scanner-input"
              [(ngModel)]="searchQuery"
              (keydown.enter)="onSearchClient()"
              placeholder="Escanear Código de Barras / Cédula / Carnet y presionar ENTER (Atajo: F2)..."
              autocomplete="off"
            />
            <button class="ui primary button scan-btn" (click)="onSearchClient()" [disabled]="searching">
              <i class="search icon"></i> Consultar
            </button>
          </div>
          <div *ngIf="searchError" class="ui negative tiny message" style="margin-top: 0.75rem;">
            {{ searchError }}
          </div>
        </div>

        <!-- CLIENT BENTO CARD (7 COLUMNS) -->
        <div
          class="bento-card"
          [ngClass]="client?.status_color_class || 'emerald'"
          style="grid-column: span 7;"
        >
          <div *ngIf="!client" class="empty-state">
            <i class="id card outline icon empty-icon"></i>
            <h3>Esperando Lectura de Cliente</h3>
            <p>Acerque el carnet con código de barras o digite la cédula para visualizar la línea de crédito.</p>
          </div>

          <div *ngIf="client" class="client-details">
            <div class="client-header">
              <div>
                <span class="client-name">{{ client.full_name }}</span>
                <div class="client-meta">
                  <span><i class="id badge outline icon"></i> {{ client.employee_code }}</span>
                  <span><i class="address card outline icon"></i> {{ client.national_id }}</span>
                  <span><i class="briefcase icon"></i> {{ client.job_title }} ({{ client.classification }})</span>
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
                {{ client.credit_status }}
              </span>
            </div>

            <div class="employer-tag">
              <i class="building outline icon"></i> {{ client.employer_name }}
            </div>

            <!-- Big Available Balance -->
            <div class="balance-card">
              <span class="balance-label">CRÉDITO DISPONIBLE PARA COMPRA:</span>
              <div class="balance-display" [style.color]="client.status_color_class === 'red' ? '#991B1B' : (client.status_color_class === 'amber' ? '#B45309' : '#047857')">
                <span class="balance-currency">C$</span>{{ formatNumber(client.available_balance) }}
              </div>
              <div class="progress-bar-container">
                <div
                  class="progress-bar-fill"
                  [style.width.%]="client.consumption_percentage"
                  [style.background-color]="client.status_color_class === 'red' ? '#EF4444' : (client.status_color_class === 'amber' ? '#F59E0B' : '#10B981')"
                ></div>
              </div>
              <div class="balance-submetrics">
                <span>Límite Autorizado: <strong>C$ {{ formatNumber(client.approved_limit) }}</strong></span>
                <span>Consumido: <strong>C$ {{ formatNumber(client.used_balance) }} ({{ client.consumption_percentage }}%)</strong></span>
              </div>
            </div>

            <!-- Action: Mini-Ticket Availability Inquiry -->
            <div class="client-actions">
              <button class="ui basic tiny button" (click)="printAvailabilityTicket()">
                <i class="ticket alternate icon"></i> Mini-Ticket de Disponibilidad
              </button>
            </div>
          </div>
        </div>

        <!-- CHECKOUT PANEL CELL (5 COLUMNS) -->
        <div class="bento-card checkout-box" style="grid-column: span 5;">
          <div class="checkout-header">
            <h3><i class="shopping cart icon"></i> Cobro de Compra</h3>
            <span class="step-tag">Paso Final</span>
          </div>

          <div *ngIf="checkoutError" class="ui negative message" style="padding: 0.6rem 0.85rem; font-size: 0.85rem;">
            {{ checkoutError }}
          </div>

          <div class="checkout-form">
            <div class="form-field">
              <label>Monto a Cobrar (C$):</label>
              <div class="amount-input-wrapper">
                <span class="currency-symbol">C$</span>
                <input
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
              <label>No. de Factura del ERP / Caja:</label>
              <input
                type="text"
                class="ui-input"
                [(ngModel)]="externalInvoice"
                placeholder="Ej. FACT-2026-9901"
              />
            </div>

            <div class="form-field">
              <label>Observaciones (Opcional):</label>
              <input
                type="text"
                class="ui-input"
                [(ngModel)]="chargeNotes"
                placeholder="Ej. Compra de víveres / artículos de oficina"
              />
            </div>

            <button
              class="process-btn"
              [disabled]="!canProcessCharge() || processing"
              (click)="onProcessCharge()"
            >
              <span *ngIf="!processing">
                <span class="key-badge">F4</span> Procesar Cobro (C$ {{ formatNumber(chargeAmount || 0) }})
              </span>
              <span *ngIf="processing">
                <i class="spinner loading icon"></i> Transando en Ledger...
              </span>
            </button>
          </div>
        </div>

        <!-- RECENT TRANSACTIONS TABLE CELL (12 COLUMNS) -->
        <div class="bento-card" style="grid-column: span 12; padding: 1.5rem;">
          <div class="table-header">
            <h3><i class="history icon"></i> Movimientos Recientes en Esta Caja</h3>
            <button class="ui basic tiny button" (click)="loadRecentTransactions()">
              <i class="refresh icon"></i> Actualizar
            </button>
          </div>

          <div class="table-responsive">
            <table class="ui very basic selectable table">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Autorización</th>
                  <th>Voucher</th>
                  <th>Cliente</th>
                  <th>Factura ERP</th>
                  <th>Monto</th>
                  <th>Disponible Posterior</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let tx of recentTransactions">
                  <td>{{ tx.created_at | date: 'HH:mm:ss' }}</td>
                  <td><strong>{{ tx.authorization_code }}</strong></td>
                  <td>{{ tx.voucher_number }}</td>
                  <td>{{ tx.client.full_name }}</td>
                  <td>{{ tx.external_invoice_number }}</td>
                  <td><strong>C$ {{ formatNumber(tx.amount) }}</strong></td>
                  <td>C$ {{ formatNumber(tx.new_available_balance) }}</td>
                  <td>
                    <span
                      class="badge-status"
                      [ngClass]="{
                        active: tx.status === 'APPROVED',
                        blocked: tx.status === 'VOIDED'
                      }"
                    >
                      {{ tx.status }}
                    </span>
                  </td>
                  <td>
                    <button class="ui mini icon basic button" (click)="viewVoucher(tx)" title="Ver e Imprimir Voucher">
                      <i class="print icon"></i>
                    </button>
                    <button
                      *ngIf="tx.status === 'APPROVED'"
                      class="ui mini icon basic red button"
                      (click)="promptVoid(tx)"
                      title="Anular Transacción"
                    >
                      <i class="ban icon"></i>
                    </button>
                  </td>
                </tr>
                <tr *ngIf="recentTransactions.length === 0">
                  <td colspan="9" style="text-align: center; color: var(--gray-text); padding: 2rem;">
                    No hay transacciones registradas en el turno actual.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- THERMAL VOUCHER MODAL OVERLAY -->
      <div class="modal-overlay" *ngIf="activeVoucher">
        <div class="modal-content">
          <app-voucher [voucher]="activeVoucher" (close)="activeVoucher = null"></app-voucher>
        </div>
      </div>

      <!-- AVAILABILITY TICKET MODAL OVERLAY -->
      <div class="modal-overlay" *ngIf="availabilityTicket">
        <div class="modal-content bento-card" style="max-width: 380px;">
          <div style="text-align: center; margin-bottom: 1rem;">
            <h3><i class="ticket alternate icon"></i> Consulta de Disponibilidad</h3>
            <p style="font-size: 0.85rem; color: var(--gray-text);">Ticket Informativo de Caja</p>
          </div>

          <div style="font-family: 'JetBrains Mono', monospace; font-size: 12px; background: #F8FAFC; padding: 1rem; border-radius: 0.5rem;">
            <div><strong>CLIENTE:</strong> {{ availabilityTicket.client.full_name }}</div>
            <div><strong>CEDULA:</strong> {{ availabilityTicket.client.masked_national_id }}</div>
            <div><strong>EMPRESA:</strong> {{ availabilityTicket.client.employer_name }}</div>
            <hr style="margin: 0.5rem 0; border: none; border-top: 1px dashed #CBD5E1;" />
            <div>LIMITE TOTAL: C$ {{ formatNumber(availabilityTicket.approved_limit) }}</div>
            <div>CONSUMIDO: C$ {{ formatNumber(availabilityTicket.used_balance) }}</div>
            <div style="font-size: 14px; font-weight: 800; color: #047857; margin-top: 0.35rem;">
              DISPONIBLE: C$ {{ formatNumber(availabilityTicket.available_balance) }}
            </div>
          </div>

          <div style="display: flex; gap: 0.5rem; margin-top: 1.25rem;">
            <button class="ui primary fluid button" (click)="windowPrint()">
              <i class="print icon"></i> Imprimir Ticket
            </button>
            <button class="ui basic fluid button" (click)="availabilityTicket = null">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .pos-container {
        display: flex;
        flex-direction: column;
      }

      .pos-ribbon {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.85rem 1.5rem;
        background-color: var(--navy-900);
        color: #FFFFFF;
        border: none;
      }

      .ribbon-title {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        font-weight: 800;
        letter-spacing: 0.05em;
        font-size: 1rem;
      }

      .ribbon-shortcuts {
        display: flex;
        gap: 1.5rem;
      }

      .shortcut-item {
        font-size: 0.8rem;
        color: #CBD5E1;
        display: flex;
        align-items: center;
      }

      .scanner-input-group {
        display: flex;
        align-items: center;
        position: relative;
        gap: 0.75rem;
      }

      .scanner-icon {
        position: absolute;
        left: 1rem;
        font-size: 1.5rem !important;
        color: var(--navy-900);
      }

      .scanner-input {
        flex: 1;
        padding: 0.95rem 1rem 0.95rem 3.25rem;
        font-size: 1.15rem;
        font-weight: 600;
        border: 2px solid #CBD5E1;
        border-radius: 0.85rem;
        outline: none;
        transition: all 0.15s;
        background-color: #FAFAFA;
      }

      .scanner-input:focus {
        border-color: var(--navy-900);
        background-color: #FFFFFF;
        box-shadow: 0 0 0 4px rgba(15, 23, 42, 0.1);
      }

      .scan-btn {
        padding: 0.95rem 1.5rem !important;
        font-size: 1rem !important;
      }

      .empty-state {
        text-align: center;
        padding: 3rem 1.5rem;
        color: var(--gray-text);
      }

      .empty-icon {
        font-size: 3.5rem !important;
        color: #CBD5E1;
        margin-bottom: 1rem;
      }

      .client-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }

      .client-name {
        font-size: 1.4rem;
        font-weight: 800;
        color: var(--navy-950);
      }

      .client-meta {
        display: flex;
        gap: 1rem;
        margin-top: 0.35rem;
        font-size: 0.85rem;
        color: var(--gray-text);
      }

      .employer-tag {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        background: var(--gray-subtle);
        padding: 0.35rem 0.75rem;
        border-radius: 0.5rem;
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--navy-800);
        margin: 0.85rem 0 1.25rem;
      }

      .balance-card {
        background: var(--gray-subtle);
        border: 1px solid var(--gray-border);
        border-radius: 1rem;
        padding: 1.25rem;
      }

      .balance-label {
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--gray-text);
        letter-spacing: 0.05em;
      }

      .progress-bar-container {
        height: 8px;
        background: #E2E8F0;
        border-radius: 9999px;
        margin: 0.85rem 0 0.5rem;
        overflow: hidden;
      }

      .progress-bar-fill {
        height: 100%;
        transition: width 0.3s ease;
      }

      .balance-submetrics {
        display: flex;
        justify-content: space-between;
        font-size: 0.8rem;
        color: var(--gray-text);
      }

      .client-actions {
        margin-top: 1rem;
        display: flex;
        justify-content: flex-end;
      }

      .checkout-box {
        background: #FFFFFF;
        display: flex;
        flex-direction: column;
      }

      .checkout-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid var(--gray-border);
        padding-bottom: 0.85rem;
        margin-bottom: 1.25rem;
      }

      .checkout-header h3 {
        margin: 0;
        font-weight: 800;
        font-size: 1.15rem;
      }

      .step-tag {
        background: var(--emerald-subtle);
        color: var(--emerald-text);
        font-size: 0.7rem;
        font-weight: 700;
        padding: 0.2rem 0.5rem;
        border-radius: 0.25rem;
      }

      .checkout-form {
        display: flex;
        flex-direction: column;
        gap: 1.15rem;
        flex: 1;
      }

      .form-field {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }

      .form-field label {
        font-size: 0.8rem;
        font-weight: 700;
        color: var(--navy-800);
      }

      .amount-input-wrapper {
        position: relative;
        display: flex;
        align-items: center;
      }

      .currency-symbol {
        position: absolute;
        left: 1rem;
        font-size: 1.35rem;
        font-weight: 800;
        color: var(--navy-900);
      }

      .amount-input {
        width: 100%;
        padding: 0.75rem 1rem 0.75rem 3rem;
        font-size: 1.75rem;
        font-weight: 800;
        font-family: inherit;
        border: 2px solid #CBD5E1;
        border-radius: 0.75rem;
        outline: none;
        color: var(--navy-900);
      }

      .amount-input:focus {
        border-color: var(--navy-900);
      }

      .quick-chips {
        display: flex;
        gap: 0.4rem;
        margin-top: 0.4rem;
      }

      .chip-btn {
        background: var(--gray-subtle);
        border: 1px solid var(--gray-border);
        border-radius: 0.375rem;
        padding: 0.25rem 0.5rem;
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
      }

      .chip-btn:hover {
        background: #E2E8F0;
      }

      .ui-input {
        padding: 0.65rem 0.85rem;
        border: 1px solid var(--gray-border);
        border-radius: 0.6rem;
        font-size: 0.9rem;
        font-family: inherit;
        outline: none;
      }

      .process-btn {
        background-color: var(--emerald-main);
        color: #FFFFFF;
        border: none;
        padding: 1rem;
        border-radius: 0.85rem;
        font-size: 1.05rem;
        font-weight: 800;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        margin-top: auto;
        transition: all 0.15s ease;
      }

      .process-btn:hover:not(:disabled) {
        background-color: #059669;
        transform: translateY(-2px);
      }

      .process-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .table-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
      }

      .table-header h3 {
        margin: 0;
        font-weight: 800;
      }

      .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.65);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        padding: 1rem;
      }

      .modal-content {
        max-height: 90vh;
        overflow-y: auto;
      }
    `,
  ],
})
export class PosComponent implements OnInit {
  @ViewChild('scanInput') scanInput?: ElementRef<HTMLInputElement>;

  private readonly posService = inject(PosService);
  private readonly auth = inject(AuthService);

  searchQuery = '001-121092-0000X'; // Default demo client
  client: ClientProfile | null = null;
  searching = false;
  searchError = '';

  chargeAmount: number | null = null;
  externalInvoice = 'FACT-2026-001';
  chargeNotes = '';
  processing = false;
  checkoutError = '';

  recentTransactions: VoucherDetails[] = [];
  activeVoucher: VoucherDetails | null = null;
  availabilityTicket: AvailabilityTicket | null = null;

  ngOnInit(): void {
    this.onSearchClient();
    this.loadRecentTransactions();
  }

  // Global Ergonomic POS Keyboard Shortcuts: F2, F4, F8
  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
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

    const payload = {
      client_id: this.client.id,
      merchant_company_id: this.auth.currentUser()?.company_id || this.client.employer_company_id,
      cash_register_id: 'd9b6e82c-4a3f-42a9-9e81-7f9a12345678', // Default terminal
      amount: Number(this.chargeAmount),
      external_invoice_number: this.externalInvoice.trim(),
      idempotency_key: `pos_charge_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      notes: this.chargeNotes,
    };

    this.posService.checkout(payload).subscribe({
      next: (voucher) => {
        this.processing = false;
        this.activeVoucher = voucher;
        this.chargeAmount = null;
        this.externalInvoice = `FACT-${Date.now().toString().slice(-4)}`;
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
    this.posService.getAvailabilityTicket(this.client.id).subscribe({
      next: (ticket) => {
        this.availabilityTicket = ticket;
      },
    });
  }

  loadRecentTransactions(): void {
    this.posService.getRecentTransactions().subscribe({
      next: (txs) => {
        this.recentTransactions = txs;
      },
    });
  }

  viewVoucher(tx: VoucherDetails): void {
    this.posService.getVoucher(tx.transaction_id || (tx as unknown as { id: string }).id).subscribe({
      next: (v) => {
        this.activeVoucher = v;
      },
    });
  }

  promptVoid(tx: VoucherDetails): void {
    const reason = prompt('Ingrese el motivo obligatorio para la anulación de esta compra:');
    if (!reason || !reason.trim()) return;

    const txId = tx.transaction_id || (tx as unknown as { id: string }).id;
    this.posService.voidTransaction(txId, reason.trim()).subscribe({
      next: () => {
        alert('Transacción anulada exitosamente y saldo restituido en el libro mayor.');
        this.loadRecentTransactions();
        if (this.client) this.onSearchClient();
      },
      error: (err) => {
        alert(err.error?.message || 'No se pudo anular la transacción');
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
