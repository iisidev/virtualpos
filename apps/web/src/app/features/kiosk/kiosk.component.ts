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
          <i class="tablet alternate icon" aria-hidden="true"></i>
          <div>
            <h1>KIOSCO POS VIRTUAL</h1>
            <p>Consulte su disponibilidad y estado de cuenta al instante</p>
          </div>
        </div>

        <div *ngIf="kioskData" class="countdown-badge" role="status" aria-live="polite">
          <i class="clock outline icon" aria-hidden="true"></i>
          <span>Reinicio en: <strong class="ui-mono">{{ remainingSeconds }}s</strong></span>
        </div>
      </header>

      <main class="kiosk-main">
        <!-- IDLE / SCANNER MODE -->
        <div *ngIf="!kioskData" class="scanner-card bento-card">
          <div class="scanner-hero">
            <div class="icon-radar">
              <i class="id card icon" aria-hidden="true"></i>
            </div>
            <h2>Acerque su Carnet o Cédula al Lector</h2>
            <p>O ingrese su número de identificación en la pantalla táctil:</p>
          </div>

          <div class="kiosk-input-wrapper">
            <label for="kiosk-query" class="sr-only">Número de cédula o carnet</label>
            <input
              #kioskInput
              id="kiosk-query"
              type="text"
              class="kiosk-input"
              [(ngModel)]="query"
              (keydown.enter)="onQuery()"
              placeholder="001-121092-0000X"
              autocomplete="off"
            />
            <button
              type="button"
              class="kiosk-btn"
              (click)="onQuery()"
              [disabled]="loading"
              [attr.aria-label]="loading ? 'Consultando disponibilidad' : null"
            >
              <span *ngIf="!loading">Consultar <i class="arrow right icon" aria-hidden="true"></i></span>
              <span *ngIf="loading">
                <i class="spinner loading icon" aria-hidden="true"></i>
                <span class="sr-only">Consultando...</span>
              </span>
            </button>
          </div>

          <div *ngIf="errorMsg" class="ui negative message kiosk-error-msg" role="alert">
            {{ errorMsg }}
          </div>
        </div>

        <!-- RESULTS MODE (15-SECOND AUTO-RESET BENTO GRID) -->
        <div *ngIf="kioskData" class="kiosk-results bento-grid">
          <!-- Client Profile Bento Cell (7 Cols) -->
          <div class="bento-card ui-col-7" [ngClass]="kioskData.status_color_class">
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
              <div
                class="balance-display"
                [class.ui-credit-warning]="kioskData.status_color_class === 'amber'"
                [class.ui-credit-danger]="kioskData.status_color_class === 'red'"
              >
                <span class="balance-currency">C$</span>{{ formatNumber(kioskData.available_balance) }}
              </div>
              <div class="limit-sub">
                Límite total asignado: <strong class="ui-mono">C$ {{ formatNumber(kioskData.approved_limit) }}</strong>
              </div>
            </div>

            <!-- Last Purchase Box -->
            <div class="last-purchase-box" *ngIf="kioskData.last_purchase">
              <div class="box-title"><i class="shopping bag icon" aria-hidden="true"></i> Último Consumo Registrado:</div>
              <div class="box-content">
                <span>{{ kioskData.last_purchase.merchant_name }}</span>
                <strong class="ui-mono">C$ {{ formatNumber(kioskData.last_purchase.amount || 0) }}</strong>
                <span class="date ui-mono">{{ kioskData.last_purchase.date | date: 'dd/MM/yyyy HH:mm' }}</span>
              </div>
            </div>
          </div>

          <!-- Dynamic WhatsApp QR Cell (5 Cols) -->
          <div class="bento-card ui-col-5 qr-cell">
            <div class="qr-header">
              <i class="whatsapp icon wa-icon" aria-hidden="true"></i>
              <h2>Estado de Cuenta en WhatsApp</h2>
              <p>Escanee con su cámara para recibir su estado de cuenta en su celular sin costo:</p>
            </div>

            <div class="qr-canvas-wrapper">
              <canvas
                #waCanvas
                role="img"
                [attr.aria-label]="'Código QR de WhatsApp para estado de cuenta de ' + kioskData.full_name"
              ></canvas>
            </div>

            <button type="button" class="kiosk-reset-btn" (click)="resetKiosk()">
              <i class="check icon" aria-hidden="true"></i> Finalizar Consulta
            </button>
          </div>
        </div>
      </main>
    </div>
  `,
  styleUrl: './kiosk.component.css',
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

