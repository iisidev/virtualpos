import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  ElementRef,
  ViewChild,
  Output,
  EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as QRCode from 'qrcode';
import { VoucherDetails } from '../../core/models';

@Component({
  selector: 'app-voucher',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="voucher-wrapper" *ngIf="voucher">
      <div class="voucher-actions no-print">
        <button class="ui primary button" (click)="printVoucher()">
          <i class="print icon"></i> Imprimir Voucher (80mm)
        </button>
        <button class="ui basic button" (click)="close.emit()">
          <i class="close icon"></i> Cerrar
        </button>
      </div>

      <!-- Printable Thermal Area (80mm Width) -->
      <div id="thermal-voucher-print-area" class="thermal-receipt">
        <!-- COPY 1: ORIGINAL COMERCIO -->
        <div class="voucher-copy">
          <div class="receipt-header">
            <div class="merchant-name">{{ voucher.merchant.name | uppercase }}</div>
            <div class="receipt-line">RUC: {{ voucher.merchant.ruc }}</div>
            <div class="receipt-line">SISTEMA POS VIRTUAL - CREDITO CORPORATIVO</div>
            <div class="receipt-line bold-title">ORIGINAL: COMERCIO / SOPORTE DE CAJA</div>
          </div>

          <div class="receipt-divider">================================</div>

          <div class="receipt-row">
            <span>FECHA: {{ voucher.created_at | date: 'dd/MM/yyyy' }}</span>
            <span>HORA: {{ voucher.created_at | date: 'HH:mm:ss' }}</span>
          </div>
          <div class="receipt-row">
            <span>TERMINAL: {{ voucher.terminal.terminal_code }}</span>
            <span>CAJERO: {{ voucher.cashier.username | uppercase }}</span>
          </div>
          <div class="receipt-row">
            <span>NO. VOUCHER:</span>
            <strong>{{ voucher.voucher_number }}</strong>
          </div>
          <div class="receipt-row">
            <span>AUTORIZACION:</span>
            <strong class="auth-highlight">{{ voucher.authorization_code }}</strong>
          </div>
          <div class="receipt-row">
            <span>FACTURA ERP:</span>
            <span>{{ voucher.external_invoice_number }}</span>
          </div>

          <div class="receipt-divider">--------------------------------</div>

          <div class="client-box">
            <div class="receipt-line"><strong>CLIENTE:</strong> {{ voucher.client.full_name | uppercase }}</div>
            <div class="receipt-line"><strong>CEDULA:</strong> {{ voucher.client.masked_national_id }}</div>
            <div class="receipt-line"><strong>CARNET:</strong> {{ voucher.client.employee_code }}</div>
            <div class="receipt-line"><strong>EMPLEADOR:</strong> {{ voucher.client.employer_name | uppercase }}</div>
          </div>

          <div class="receipt-divider">================================</div>

          <div class="financial-summary">
            <div class="receipt-row">
              <span>DISPONIBLE ANTERIOR:</span>
              <span>{{ voucher.currency }} {{ formatNumber(voucher.previous_available_balance) }}</span>
            </div>
            <div class="receipt-row bold-amount">
              <span>TOTAL COMPRA:</span>
              <span>- {{ voucher.currency }} {{ formatNumber(voucher.amount) }}</span>
            </div>
            <div class="receipt-row bold-balance">
              <span>NUEVO DISPONIBLE:</span>
              <span>{{ voucher.currency }} {{ formatNumber(voucher.new_available_balance) }}</span>
            </div>
          </div>

          <div class="receipt-divider">================================</div>

          <div class="legal-text">
            POR ESTE PAGARE RECONOZCO DEBER Y ME COMPROMETO A PAGAR INCONDICIONALMENTE
            A LA ORDEN DEL COMERCIO EL IMPORTE TOTAL DE ESTA TRANSACCION, AUTORIZANDO LA
            DEDUCCION CORRESPONDIENTE CONFORME AL CONVENIO DE CREDITO CORPORATIVO.
          </div>

          <div class="signature-area">
            <div class="signature-line"></div>
            <div class="receipt-line">FIRMA DEL CLIENTE / TITULAR</div>
            <div class="receipt-line">CEDULA: {{ voucher.client.masked_national_id }}</div>
          </div>

          <div class="qr-box">
            <canvas #qrCanvasOriginal></canvas>
            <div class="hash-text">SIG: {{ voucher.signature_hash.substring(0, 20) }}...</div>
            <div class="receipt-line">VALIDACION FINANCIERA SEGURA</div>
          </div>
        </div>

        <div class="voucher-copy-separator"></div>

        <!-- COPY 2: COPIA CLIENTE -->
        <div class="voucher-copy">
          <div class="receipt-header">
            <div class="merchant-name">{{ voucher.merchant.name | uppercase }}</div>
            <div class="receipt-line">RUC: {{ voucher.merchant.ruc }}</div>
            <div class="receipt-line">SISTEMA POS VIRTUAL - CREDITO CORPORATIVO</div>
            <div class="receipt-line bold-title">COPIA: CLIENTE</div>
          </div>

          <div class="receipt-divider">================================</div>

          <div class="receipt-row">
            <span>FECHA: {{ voucher.created_at | date: 'dd/MM/yyyy' }}</span>
            <span>HORA: {{ voucher.created_at | date: 'HH:mm:ss' }}</span>
          </div>
          <div class="receipt-row">
            <span>AUTORIZACION:</span>
            <strong class="auth-highlight">{{ voucher.authorization_code }}</strong>
          </div>
          <div class="receipt-row">
            <span>NO. VOUCHER:</span>
            <strong>{{ voucher.voucher_number }}</strong>
          </div>
          <div class="receipt-row">
            <span>FACTURA ERP:</span>
            <span>{{ voucher.external_invoice_number }}</span>
          </div>

          <div class="receipt-divider">--------------------------------</div>

          <div class="client-box">
            <div class="receipt-line"><strong>CLIENTE:</strong> {{ voucher.client.full_name | uppercase }}</div>
            <div class="receipt-line"><strong>EMPLEADOR:</strong> {{ voucher.client.employer_name | uppercase }}</div>
          </div>

          <div class="receipt-divider">================================</div>

          <div class="financial-summary">
            <div class="receipt-row bold-amount">
              <span>MONTO DE COMPRA:</span>
              <span>{{ voucher.currency }} {{ formatNumber(voucher.amount) }}</span>
            </div>
            <div class="receipt-row bold-balance">
              <span>NUEVO DISPONIBLE:</span>
              <span>{{ voucher.currency }} {{ formatNumber(voucher.new_available_balance) }}</span>
            </div>
          </div>

          <div class="receipt-divider">================================</div>

          <div class="qr-box">
            <canvas #qrCanvasCopy></canvas>
            <div class="hash-text">SIG: {{ voucher.signature_hash.substring(0, 20) }}...</div>
            <div class="receipt-line">¡GRACIAS POR SU COMPRA!</div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .voucher-wrapper {
        background: #FFFFFF;
        border-radius: 1rem;
        padding: 1.5rem;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
        max-width: 420px;
        margin: 0 auto;
      }

      .voucher-actions {
        display: flex;
        gap: 0.75rem;
        margin-bottom: 1.25rem;
        justify-content: center;
      }

      .thermal-receipt {
        font-family: 'JetBrains Mono', 'Courier New', monospace;
        font-size: 11px;
        color: #000000;
        background: #FFFFFF;
        padding: 0.5rem;
        border: 1px dashed #CBD5E1;
      }

      .receipt-header {
        text-align: center;
        margin-bottom: 0.5rem;
      }

      .merchant-name {
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0.05em;
      }

      .bold-title {
        font-weight: 800;
        margin-top: 0.35rem;
        text-decoration: underline;
      }

      .receipt-divider {
        text-align: center;
        letter-spacing: 1px;
        margin: 0.35rem 0;
        overflow: hidden;
      }

      .receipt-row {
        display: flex;
        justify-content: space-between;
        margin: 0.15rem 0;
      }

      .receipt-line {
        margin: 0.15rem 0;
      }

      .auth-highlight {
        font-size: 12px;
      }

      .bold-amount {
        font-size: 13px;
        font-weight: 800;
      }

      .bold-balance {
        font-size: 13px;
        font-weight: 800;
        background: #F1F5F9;
        padding: 0.15rem 0.25rem;
      }

      .legal-text {
        font-size: 8.5px;
        text-align: justify;
        line-height: 1.2;
        margin: 0.5rem 0;
      }

      .signature-area {
        margin: 1.5rem 0 1rem;
        text-align: center;
      }

      .signature-line {
        border-top: 1px solid #000000;
        width: 80%;
        margin: 0 auto 0.35rem;
      }

      .qr-box {
        text-align: center;
        margin-top: 0.5rem;
      }

      .qr-box canvas {
        width: 100px !important;
        height: 100px !important;
        margin: 0 auto;
        display: block;
      }

      .hash-text {
        font-size: 8px;
        color: #475569;
        margin-top: 0.25rem;
      }

      .voucher-copy-separator {
        border-bottom: 2px dashed #000000;
        margin: 1.5rem 0;
      }
    `,
  ],
})
export class VoucherComponent implements OnChanges {
  @Input() voucher: VoucherDetails | null = null;
  @Output() close = new EventEmitter<void>();

  @ViewChild('qrCanvasOriginal') qrCanvasOriginal?: ElementRef<HTMLCanvasElement>;
  @ViewChild('qrCanvasCopy') qrCanvasCopy?: ElementRef<HTMLCanvasElement>;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['voucher'] && this.voucher) {
      setTimeout(() => this.renderQRCodes(), 50);
    }
  }

  formatNumber(val: string | number): string {
    return Number(val).toLocaleString('es-NI', { minimumFractionDigits: 2 });
  }

  printVoucher(): void {
    window.print();
  }

  private renderQRCodes(): void {
    if (!this.voucher) return;
    const payload = this.voucher.verification_qr_payload;

    if (this.qrCanvasOriginal?.nativeElement) {
      QRCode.toCanvas(this.qrCanvasOriginal.nativeElement, payload, {
        width: 100,
        margin: 1,
      });
    }
    if (this.qrCanvasCopy?.nativeElement) {
      QRCode.toCanvas(this.qrCanvasCopy.nativeElement, payload, {
        width: 100,
        margin: 1,
      });
    }
  }
}

