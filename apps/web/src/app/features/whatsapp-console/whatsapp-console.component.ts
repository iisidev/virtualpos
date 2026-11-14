import {
  Component,
  OnInit,
  ElementRef,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import * as QRCode from 'qrcode';
import { getApiBaseUrl } from '../../core/config/api.config';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models';
import { StatusBannerComponent } from '../../shared/status-banner.component';
import { WhatsappNotifyComponent } from './whatsapp-notify.component';

interface WhatsAppChannelConfig {
  bot_number: string | null;
  provider: string;
  openclaw_configured: boolean;
}

interface SimulatedInteraction {
  from: string;
  message: string;
  reply: string;
  timestamp: Date;
}

interface QuickPromptOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-whatsapp-console',
  standalone: true,
  imports: [CommonModule, FormsModule, StatusBannerComponent, WhatsappNotifyComponent],
  template: `
    <div class="whatsapp-console-page">
      <div class="page-header bento-card">
        <div class="header-copy">
          <h1>
            <i class="whatsapp icon wa-brand-icon" aria-hidden="true"></i>
            Canal WhatsApp &amp; OpenClaw Gateway
          </h1>
          <p>Enlace por código QR, notificaciones salientes por OpenClaw y simulador del webhook corporativo</p>
        </div>
        <div class="header-actions">
          <span class="gateway-pill" [class.online]="channelConfig.openclaw_configured">
            <span class="gateway-dot" aria-hidden="true"></span>
            {{ channelConfig.openclaw_configured ? 'OpenClaw Activo' : 'Gateway Local' }}
          </span>
          <a
            [href]="openClawDashboardUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="ui-btn secondary-btn header-openclaw-btn"
          >
            <i class="external alternate icon" aria-hidden="true"></i>
            Abrir OpenClaw
          </a>
        </div>
      </div>

      <div class="bento-grid">
        <!-- Estado de OpenClaw Gateway -->
        <section class="bento-card ui-col-4 console-card" aria-labelledby="gateway-card-title">
          <div class="card-title">
            <i class="server icon" aria-hidden="true"></i>
            <h2 id="gateway-card-title">Conector OpenClaw Gateway</h2>
          </div>
          <p class="card-desc">Parámetros y capacidades del canal conectado a Corp-Credit POS:</p>

          <div class="status-box">
            <div class="status-indicator">
              <i class="plug icon" aria-hidden="true"></i>
              <strong>Configuración OpenClaw (Docker)</strong>
            </div>
            <div class="meta-row">
              <span>Proveedor activo</span>
              <strong class="ui-mono meta-value">{{ channelConfig.provider.toUpperCase() }}</strong>
            </div>
            <div class="meta-row">
              <span>Número bot WhatsApp</span>
              <strong class="ui-mono meta-value">{{ botNumber || 'Sin configurar' }}</strong>
            </div>
            <div class="meta-row">
              <span>Puerto Gateway</span>
              <strong class="ui-mono meta-value">18789 interno</strong>
            </div>
            <div class="meta-row">
              <span>Destino Webhook</span>
              <strong class="ui-mono meta-value">/api/v1/whatsapp/webhook</strong>
            </div>
          </div>

          <ul class="features-list">
            <li class="feature-item">
              <i class="check circle icon" aria-hidden="true"></i>
              <span>Validación VIP vs Corporativo en tiempo real</span>
            </li>
            <li class="feature-item">
              <i class="check circle icon" aria-hidden="true"></i>
              <span>Consultas en vivo de saldo, datos y movimientos</span>
            </li>
            <li class="feature-item">
              <i class="check circle icon" aria-hidden="true"></i>
              <span>Registro directo de solicitudes de aumento</span>
            </li>
            <li class="feature-item">
              <i class="check circle icon" aria-hidden="true"></i>
              <span>Alertas automáticas al cobrar en POS</span>
            </li>
          </ul>

          <div class="card-footer-actions">
            <a
              [href]="openClawDashboardUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="ui-btn primary-btn btn-block openclaw-link"
            >
              <i class="external alternate icon" aria-hidden="true"></i>
              Abrir Interfaz Web de OpenClaw
            </a>
          </div>
        </section>

        <!-- Código QR corporativo de enlace -->
        <section class="bento-card ui-col-4 console-card qr-bento-card" aria-labelledby="qr-card-title">
          <div class="card-title card-title-centered">
            <i class="qrcode icon" aria-hidden="true"></i>
            <h2 id="qr-card-title">QR Corporativo de Entrada</h2>
          </div>
          <p class="card-desc">Escanee con WhatsApp para iniciar consulta o vinculación:</p>

          <div class="qr-number-field">
            <label for="wa-bot-number">Número del bot (código país + número)</label>
            <input
              id="wa-bot-number"
              type="text"
              class="ui-input ui-mono"
              [(ngModel)]="botNumber"
              (ngModelChange)="renderEntryQR()"
              placeholder="Ej. 13074853808 o 50588888888"
            />
          </div>

          <div class="qr-canvas-box" *ngIf="waMeUrl; else missingBotNumber">
            <canvas
              #waQRCanvas
              width="160"
              height="160"
              role="img"
              aria-label="Código QR para iniciar conversación de WhatsApp Corporativo en POS VIRTUAL"
            ></canvas>
          </div>
          <ng-template #missingBotNumber>
            <div class="qr-empty-box">
              <i class="qrcode icon" aria-hidden="true"></i>
              <span>Defina <code>WHATSAPP_BOT_NUMBER</code> o ingrese un número válido arriba para generar el QR.</span>
            </div>
          </ng-template>

          <div class="qr-url-text" *ngIf="waMeUrl">
            <code>{{ waMeUrl }}</code>
          </div>

          <div class="card-footer-actions qr-actions">
            <button
              type="button"
              class="ui-btn secondary-btn"
              [disabled]="!waMeUrl"
              (click)="copyQrUrl()"
            >
              <i [ngClass]="copiedLink ? 'check icon' : 'copy outline icon'" aria-hidden="true"></i>
              {{ copiedLink ? '¡Enlace copiado!' : 'Copiar enlace' }}
            </button>
            <button
              type="button"
              class="ui-btn primary-btn"
              [disabled]="!waMeUrl"
              (click)="printQR()"
            >
              <i class="print icon" aria-hidden="true"></i>
              Imprimir cartel
            </button>
          </div>
        </section>

        <!-- Simulador interactivo en vivo -->
        <section class="bento-card ui-col-4 ui-col-tablet-full console-card" aria-labelledby="sim-card-title">
          <div class="card-title">
            <i class="terminal icon" aria-hidden="true"></i>
            <h2 id="sim-card-title">Simulador de Webhook</h2>
          </div>
          <p class="card-desc">Pruebe las respuestas determinísticas del webhook local:</p>

          <app-status-banner
            [message]="simError"
            type="error"
            (dismiss)="simError = ''"
          ></app-status-banner>

          <div class="sim-form">
            <div class="field-group">
              <label for="wa-sim-preset">Clientes de prueba</label>
              <select
                id="wa-sim-preset"
                class="ui-input select-box"
                [(ngModel)]="selectedPreset"
                (ngModelChange)="onPresetSelected($event)"
              >
                <option value="50588881234">50588881234 · Juan Pérez (Activo)</option>
                <option value="50588882345">50588882345 · María González (Ámbar)</option>
                <option value="50588884567">50588884567 · Sandra López (Bloqueado)</option>
                <option value="50588889999">50588889999 · Nuevo / No vinculado</option>
                <option value="custom">Otro número personalizado...</option>
              </select>
            </div>

            <div class="field-group">
              <label for="wa-sim-phone">Teléfono remitente</label>
              <input
                id="wa-sim-phone"
                type="text"
                class="ui-input ui-mono"
                [(ngModel)]="simPhone"
                (ngModelChange)="syncPresetFromPhone($event)"
                placeholder="Ej. 50587531402"
              />
            </div>

            <div class="field-group">
              <label for="wa-sim-message">Mensaje del cliente</label>
              <div class="quick-options-grid" role="group" aria-label="Opciones rápidas de prueba">
                <button
                  *ngFor="let opt of quickOptions"
                  type="button"
                  class="opt-btn"
                  [class.active]="simMessage.trim() === opt.value"
                  (click)="setMsg(opt.value)"
                >
                  {{ opt.label }}
                </button>
              </div>

              <input
                id="wa-sim-message"
                type="text"
                class="ui-input sim-input"
                [(ngModel)]="simMessage"
                (keydown.enter)="sendSimulatedMessage()"
                placeholder="Escriba opción o pregunta..."
              />
            </div>
          </div>

          <div class="card-footer-actions">
            <button
              type="button"
              class="ui-btn primary-btn btn-block"
              [disabled]="loading || !simPhone.trim() || !simMessage.trim()"
              (click)="sendSimulatedMessage()"
            >
              <i [ngClass]="loading ? 'spinner loading icon' : 'paper plane icon'" aria-hidden="true"></i>
              {{ loading ? 'Enviando al Webhook...' : 'Enviar Mensaje al Webhook' }}
            </button>
          </div>
        </section>

        <app-whatsapp-notify *ngIf="canSendNotifications"></app-whatsapp-notify>

        <!-- Bitácora de respuestas en tiempo real -->
        <section class="bento-card ui-col-12" aria-labelledby="feed-card-title">
          <div class="feed-header">
            <div class="card-title">
              <i class="comments icon" aria-hidden="true"></i>
              <h2 id="feed-card-title">Bitácora del Simulador en esta Sesión</h2>
            </div>
            <button
              *ngIf="interactions.length > 0"
              type="button"
              class="ui-btn secondary-btn"
              (click)="interactions = []"
            >
              <i class="trash alternate outline icon" aria-hidden="true"></i>
              Limpiar bitácora
            </button>
          </div>

          <div class="interactions-feed" *ngIf="interactions.length > 0">
            <div class="interaction-bubble" *ngFor="let it of interactions">
              <div class="bubble-header">
                <span class="client-tag">
                  <i class="user icon" aria-hidden="true"></i>
                  Remitente: <strong class="ui-mono">{{ it.from }}</strong>
                </span>
                <span class="time ui-mono">{{ it.timestamp | date: 'HH:mm:ss' }}</span>
              </div>
              <div class="client-msg">
                <strong>Mensaje enviado:</strong> "{{ it.message }}"
              </div>
              <div class="backend-reply">
                <div class="reply-badge">Respuesta del sistema</div>
                <pre>{{ it.reply }}</pre>
              </div>
            </div>
          </div>

          <div *ngIf="interactions.length === 0" class="ui-state-box">
            <i class="comments outline icon" aria-hidden="true"></i>
            <span>No se han registrado interacciones en esta sesión. Use el simulador para probar respuestas.</span>
          </div>
        </section>
      </div>
    </div>
  `,
  styleUrl: './whatsapp-console.component.css',
})
export class WhatsappConsoleComponent implements OnInit {
  @ViewChild('waQRCanvas') waQRCanvas?: ElementRef<HTMLCanvasElement>;

  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  readonly quickOptions: QuickPromptOption[] = [
    { value: '1', label: '1. Aprobado' },
    { value: '2', label: '2. Disponible' },
    { value: '3', label: '3. Última' },
    { value: '4', label: '4. Historial' },
    { value: '5', label: '5. Aumento' },
  ];

  channelConfig: WhatsAppChannelConfig = {
    bot_number: null,
    provider: 'openclaw',
    openclaw_configured: false,
  };
  botNumber = '';
  copiedLink = false;

  selectedPreset = '50588881234';
  simPhone = '50588881234';
  simMessage = '2';
  loading = false;
  simError = '';
  interactions: SimulatedInteraction[] = [];

  get canSendNotifications(): boolean {
    return this.auth.hasRole(UserRole.SUPER_ADMIN, UserRole.CREDIT_MANAGER);
  }

  get openClawDashboardUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const host = window.location.hostname || 'localhost';
    return `${protocol}//${host}:22088`;
  }

  get normalizedBotDigits(): string {
    return (this.botNumber || '').replace(/\D/g, '');
  }

  get waMeUrl(): string {
    const digits = this.normalizedBotDigits;
    if (digits.length < 8) return '';
    return `https://wa.me/${digits}?text=INICIAR%20MI%20CREDITO`;
  }

  ngOnInit(): void {
    this.loadChannelConfig();
  }

  loadChannelConfig(): void {
    const headers = new HttpHeaders({ Authorization: `Bearer ${this.auth.token() || ''}` });
    this.http.get<WhatsAppChannelConfig>(`${getApiBaseUrl()}/whatsapp/config`, { headers }).subscribe({
      next: (cfg) => {
        this.channelConfig = cfg;
        if (cfg.bot_number && !this.botNumber) {
          this.botNumber = cfg.bot_number;
        }
        setTimeout(() => this.renderEntryQR(), 0);
      },
      error: () => {
        setTimeout(() => this.renderEntryQR(), 0);
      },
    });
  }

  renderEntryQR(): void {
    const url = this.waMeUrl;
    if (!url) return;
    setTimeout(() => {
      const canvas = this.waQRCanvas?.nativeElement;
      if (!canvas) return;
      QRCode.toCanvas(canvas, url, { width: 160, margin: 1 });
    }, 0);
  }

  copyQrUrl(): void {
    if (!this.waMeUrl) return;
    const markCopied = () => {
      this.copiedLink = true;
      setTimeout(() => (this.copiedLink = false), 2000);
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(this.waMeUrl).then(markCopied).catch(() => this.copyViaTextarea(markCopied));
      return;
    }
    this.copyViaTextarea(markCopied);
  }

  private copyViaTextarea(onDone: () => void): void {
    const textarea = document.createElement('textarea');
    textarea.value = this.waMeUrl;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      if (document.execCommand('copy')) onDone();
    } finally {
      document.body.removeChild(textarea);
    }
  }

  printQR(): void {
    const canvas = this.waQRCanvas?.nativeElement;
    if (!canvas || !this.waMeUrl) return;
    const qrDataUrl = canvas.toDataURL('image/png');
    const popup = window.open('', '_blank', 'width=720,height=900');
    if (!popup) {
      this.simError = 'El navegador bloqueó la ventana de impresión. Permita ventanas emergentes para imprimir el cartel.';
      return;
    }
    const safeUrl = this.waMeUrl.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    popup.document.write(`<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Cartel WhatsApp Corp-Credit POS</title>
    <style>
      body { font-family: system-ui, -apple-system, sans-serif; color: #18181b; margin: 0; padding: 36px; text-align: center; }
      .poster { max-width: 540px; margin: 0 auto; border: 2px solid #d5dce3; border-radius: 16px; padding: 32px; }
      h1 { margin: 0 0 8px; font-size: 24px; }
      p { color: #58616d; margin: 0 0 24px; }
      img { width: 240px; height: 240px; border: 2px dashed #7c8694; border-radius: 12px; padding: 12px; }
      ul { text-align: left; max-width: 360px; margin: 20px auto; padding-left: 20px; line-height: 1.7; }
      code { display: block; margin-top: 16px; font-size: 12px; color: #58616d; word-break: break-all; }
      @media print { body { padding: 12mm; } }
    </style>
  </head>
  <body>
    <div class="poster">
      <h1>Crédito Corporativo por WhatsApp</h1>
      <p>Escanee este código QR desde su teléfono para consultar y gestionar su línea Corp-Credit.</p>
      <img src="${qrDataUrl}" alt="Código QR WhatsApp Corp-Credit" />
      <ul>
        <li>1️⃣ Crédito aprobado</li>
        <li>2️⃣ Crédito disponible</li>
        <li>3️⃣ Últimos movimientos</li>
        <li>4️⃣ Solicitar aumento de crédito</li>
      </ul>
      <code>${safeUrl}</code>
    </div>
    <script>window.onload = function () { window.print(); };</script>
  </body>
</html>`);
    popup.document.close();
  }

  onPresetSelected(value: string): void {
    if (value !== 'custom') {
      this.simPhone = value;
    }
  }

  syncPresetFromPhone(phone: string): void {
    const presets = ['50588881234', '50588882345', '50588884567', '50588889999'];
    this.selectedPreset = presets.includes(phone.trim()) ? phone.trim() : 'custom';
  }

  setMsg(text: string): void {
    this.simMessage = text;
  }

  sendSimulatedMessage(): void {
    if (!this.simMessage.trim() || !this.simPhone.trim()) return;
    this.loading = true;
    this.simError = '';

    const payload = {
      from: this.simPhone.trim(),
      message: this.simMessage.trim(),
    };

    const webhookEndpoint = `${getApiBaseUrl()}/whatsapp/webhook`;

    this.http.post<{ status: string; reply?: string }>(webhookEndpoint, payload).subscribe({
      next: (res) => {
        this.loading = false;
        this.interactions.unshift({
          from: payload.from,
          message: payload.message,
          reply: res.reply || 'Menú interactivo enviado por WhatsApp',
          timestamp: new Date(),
        });
      },
      error: (err) => {
        this.loading = false;
        this.simError = err.error?.message || 'Error al comunicarse con webhook';
      },
    });
  }
}
