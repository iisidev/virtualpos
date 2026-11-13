import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as QRCode from 'qrcode';
import { KioskService } from '../../core/services/kiosk.service';
import { KioskDisplayData } from '../../core/models';

@Component({
  selector: 'app-kiosk',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="kiosk-page">
      <!-- Kiosk Header -->
      <header class="kiosk-header">
        <div class="kiosk-brand">
          <i class="tablet alternate icon"></i>
          <div>
            <h1>KIOSCO DE AUTOGESTIÓN DE CRÉDITO</h1>
            <p>Consulte su disponibilidad y estado de cuenta al instante</p>
          </div>
        </div>

        <div *ngIf="kioskData" class="countdown-badge">
          <i class="clock outline icon"></i>
          <span>Reinicio en: <strong>{{ remainingSeconds }}s</strong></span>
        </div>
      </header>

      <!-- IDLE / SCANNER MODE -->
      <div *ngIf="!kioskData" class="scanner-card bento-card">
        <div class="scanner-hero">
          <div class="icon-radar">
            <i class="id card icon"></i>
          </div>
          <h2>Acerque su Carnet o Cédula al Lector</h2>
          <p>O ingrese su número de identificación en la pantalla táctil:</p>
        </div>

        <div class="kiosk-input-wrapper">
          <input
            #kioskInput
            type="text"
            class="kiosk-input"
            [(ngModel)]="query"
            (keydown.enter)="onQuery()"
            placeholder="001-121092-0000X"
            autocomplete="off"
          />
          <button class="kiosk-btn" (click)="onQuery()" [disabled]="loading">
            <span *ngIf="!loading">Consultar <i class="arrow right icon"></i></span>
            <span *ngIf="loading"><i class="spinner loading icon"></i></span>
          </button>
        </div>

        <div *ngIf="errorMsg" class="ui negative message" style="max-width: 500px; margin: 1.5rem auto 0;">
          {{ errorMsg }}
        </div>
      </div>

      <!-- RESULTS MODE (15-SECOND AUTO-RESET BENTO GRID) -->
      <div *ngIf="kioskData" class="kiosk-results bento-grid">
        <!-- Client Profile Bento Cell (7 Cols) -->
        <div class="bento-card" [ngClass]="kioskData.status_color_class" style="grid-column: span 7;">
          <div class="kiosk-client-header">
            <div>
              <span class="client-title">{{ kioskData.full_name }}</span>
              <div class="client-sub">
                <span>{{ kioskData.employer_name }}</span> &bull;
                <span>{{ kioskData.job_title }}</span>
              </div>
            </div>
            <span
              class="badge-status"
              [ngClass]="{
                active: kioskData.credit_status === 'ACTIVE' && kioskData.status_color_class !== 'amber',
                amber: kioskData.status_color_class === 'amber',
                blocked: kioskData.credit_status !== 'ACTIVE'
              }"
            >
              {{ kioskData.credit_status }}
            </span>
          </div>

          <div class="kiosk-balance-box">
            <span class="label">SU CRÉDITO DISPONIBLE:</span>
            <div class="balance-display" [style.color]="kioskData.status_color_class === 'red' ? '#991B1B' : '#047857'">
              <span class="balance-currency">C$</span>{{ formatNumber(kioskData.available_balance) }}
            </div>
            <div class="limit-sub">
              Límite total asignado: <strong>C$ {{ formatNumber(kioskData.approved_limit) }}</strong>
            </div>
          </div>

          <!-- Last Purchase Box -->
          <div class="last-purchase-box" *ngIf="kioskData.last_purchase">
            <div class="box-title"><i class="shopping bag icon"></i> Último Consumo Registrado:</div>
            <div class="box-content">
              <span>{{ kioskData.last_purchase.merchant_name }}</span>
              <strong>C$ {{ formatNumber(kioskData.last_purchase.amount || 0) }}</strong>
              <span class="date">{{ kioskData.last_purchase.date | date: 'dd/MM/yyyy HH:mm' }}</span>
            </div>
          </div>
        </div>

        <!-- Dynamic WhatsApp QR Cell (5 Cols) -->
        <div class="bento-card qr-cell" style="grid-column: span 5;">
          <div class="qr-header">
            <i class="whatsapp icon wa-icon"></i>
            <h3>Estado de Cuenta en WhatsApp</h3>
            <p>Escanee con su cámara para recibir su estado de cuenta en su celular sin costo:</p>
          </div>

          <div class="qr-canvas-wrapper">
            <canvas #waCanvas></canvas>
          </div>

          <button class="kiosk-reset-btn" (click)="resetKiosk()">
            <i class="check icon"></i> Finalizar Consulta
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .kiosk-page {
        min-height: 100vh;
        background: linear-gradient(135deg, #0B1120 0%, #0F172A 50%, #1E293B 100%);
        color: #FFFFFF;
        padding: 2.5rem;
        display: flex;
        flex-direction: column;
      }

      .kiosk-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        padding-bottom: 1.5rem;
        margin-bottom: 2.5rem;
      }

      .kiosk-brand {
        display: flex;
        align-items: center;
        gap: 1.25rem;
      }

      .kiosk-brand i.icon {
        font-size: 2.75rem;
        color: var(--emerald-main);
      }

      .kiosk-brand h1 {
        margin: 0;
        font-size: 1.75rem;
        font-weight: 800;
        letter-spacing: 0.05em;
      }

      .kiosk-brand p {
        margin: 0.25rem 0 0;
        color: #94A3B8;
        font-size: 0.95rem;
      }

      .countdown-badge {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        background: rgba(239, 68, 68, 0.2);
        color: #FCA5A5;
        border: 1px solid rgba(239, 68, 68, 0.4);
        padding: 0.6rem 1.25rem;
        border-radius: 9999px;
        font-size: 1.1rem;
      }

      .scanner-card {
        max-width: 750px;
        margin: auto;
        padding: 3.5rem 2.5rem;
        text-align: center;
        background: rgba(255, 255, 255, 0.98);
        color: var(--navy-900);
      }

      .icon-radar {
        width: 100px;
        height: 100px;
        background: #ECFDF5;
        color: var(--emerald-main);
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 3rem;
        margin-bottom: 1.5rem;
        box-shadow: 0 0 0 15px rgba(16, 185, 129, 0.1);
      }

      .scanner-hero h2 {
        font-size: 1.85rem;
        font-weight: 800;
        margin: 0;
      }

      .scanner-hero p {
        color: var(--gray-text);
        margin: 0.75rem 0 2rem;
        font-size: 1.05rem;
      }

      .kiosk-input-wrapper {
        display: flex;
        gap: 1rem;
        max-width: 550px;
        margin: 0 auto;
      }

      .kiosk-input {
        flex: 1;
        padding: 1.25rem 1.5rem;
        font-size: 1.5rem;
        font-weight: 700;
        border: 2px solid #CBD5E1;
        border-radius: 1rem;
        outline: none;
        text-align: center;
        letter-spacing: 0.05em;
      }

      .kiosk-btn {
        background: var(--emerald-main);
        color: #FFFFFF;
        border: none;
        padding: 1.25rem 2rem;
        border-radius: 1rem;
        font-size: 1.2rem;
        font-weight: 800;
        cursor: pointer;
        transition: background 0.15s;
      }

      .kiosk-btn:hover {
        background: #059669;
      }

      .kiosk-results {
        max-width: 1200px;
        margin: auto;
        width: 100%;
      }

      .kiosk-client-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 1.5rem;
      }

      .client-title {
        font-size: 2rem;
        font-weight: 800;
        color: var(--navy-950);
      }

      .client-sub {
        font-size: 1.1rem;
        color: var(--gray-text);
        margin-top: 0.25rem;
      }

      .kiosk-balance-box {
        background: var(--gray-subtle);
        border: 1px solid var(--gray-border);
        border-radius: 1.25rem;
        padding: 2rem;
        text-align: center;
        margin-bottom: 1.5rem;
      }

      .kiosk-balance-box .label {
        font-size: 0.95rem;
        font-weight: 800;
        color: var(--gray-text);
        letter-spacing: 0.05em;
      }

      .kiosk-balance-box .balance-display {
        font-size: 3.5rem;
        margin: 0.5rem 0;
      }

      .limit-sub {
        font-size: 1.05rem;
        color: var(--gray-text);
      }

      .last-purchase-box {
        background: #FFFFFF;
        border: 1px solid var(--gray-border);
        border-radius: 0.85rem;
        padding: 1rem 1.25rem;
      }

      .box-title {
        font-size: 0.85rem;
        font-weight: 700;
        color: var(--gray-text);
        margin-bottom: 0.5rem;
      }

      .box-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 1rem;
      }

      .box-content .date {
        color: var(--gray-text);
        font-size: 0.85rem;
      }

      .qr-cell {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: 2rem;
      }

      .wa-icon {
        font-size: 2.5rem !important;
        color: #25D366;
        margin-bottom: 0.5rem;
      }

      .qr-header h3 {
        margin: 0;
        font-weight: 800;
      }

      .qr-header p {
        font-size: 0.85rem;
        color: var(--gray-text);
        margin: 0.5rem 0 1rem;
      }

      .qr-canvas-wrapper canvas {
        width: 180px !important;
        height: 180px !important;
        margin: 0 auto;
        display: block;
        border: 4px solid var(--gray-subtle);
        border-radius: 0.75rem;
      }

      .kiosk-reset-btn {
        margin-top: 1.5rem;
        background: var(--navy-900);
        color: #FFFFFF;
        border: none;
        padding: 0.85rem 1.5rem;
        border-radius: 0.75rem;
        font-size: 1rem;
        font-weight: 700;
        cursor: pointer;
        width: 100%;
      }
    `,
  ],
})
export class KioskComponent implements OnInit, OnDestroy {
  @ViewChild('waCanvas') waCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('kioskInput') kioskInput?: ElementRef<HTMLInputElement>;

  private readonly kioskService = inject(KioskService);

  query = '001-121092-0000X';
  kioskData: KioskDisplayData | null = null;
  loading = false;
  errorMsg = '';

  remainingSeconds = 15;
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.clearCountdown();
  }

  onQuery(): void {
    if (!this.query.trim()) return;
    this.loading = true;
    this.errorMsg = '';

    this.kioskService.getProfile(this.query.trim()).subscribe({
      next: (data) => {
        this.loading = false;
        this.kioskData = data;
        this.startCountdown();
        setTimeout(() => this.renderQRCode(data.whatsapp_qr_url), 50);
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err.error?.message || 'Identificación no encontrada en el sistema';
      },
    });
  }

  resetKiosk(): void {
    this.clearCountdown();
    this.kioskData = null;
    this.query = '';
    setTimeout(() => this.kioskInput?.nativeElement.focus(), 100);
  }

  private startCountdown(): void {
    this.clearCountdown();
    this.remainingSeconds = 15;
    this.timerInterval = setInterval(() => {
      this.remainingSeconds--;
      if (this.remainingSeconds <= 0) {
        this.resetKiosk();
      }
    }, 1000);
  }

  private clearCountdown(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private renderQRCode(url: string): void {
    if (this.waCanvas?.nativeElement) {
      QRCode.toCanvas(this.waCanvas.nativeElement, url, {
        width: 180,
        margin: 1,
      });
    }
  }

  formatNumber(val: string | number): string {
    return Number(val).toLocaleString('es-NI', { minimumFractionDigits: 2 });
  }
}

