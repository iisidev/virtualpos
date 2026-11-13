import {
  Component,
  OnInit,
  ElementRef,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import * as QRCode from 'qrcode';
import { getApiBaseUrl } from '../../core/config/api.config';

interface OpenClawStatus {
  gateway: string;
  version: string;
  status: string;
  session_active: boolean;
  webhook_url: string;
  messages_processed: number;
}

interface SimulatedInteraction {
  from: string;
  message: string;
  reply: string;
  timestamp: Date;
}

@Component({
  selector: 'app-whatsapp-console',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="whatsapp-console-page">
      <div class="page-header bento-card">
        <div>
          <h2><i class="whatsapp icon" style="color: #25D366;"></i> Canal WhatsApp Costo Cero & OpenClaw Gateway</h2>
          <p>Supervisión en vivo del conector OpenClaw, enlace de cuentas por QR y simulador de flujo conversacional</p>
        </div>
      </div>

      <div class="bento-grid" style="margin-top: 1.25rem;">
        <!-- OPENCLAW GATEWAY STATUS (4 COLS) -->
        <div class="bento-card" style="grid-column: span 4;">
          <div class="card-title">
            <i class="server icon"></i>
            <h3>Estado del Gateway OpenClaw</h3>
          </div>
          <p class="card-desc">Conexión activa sin costo de API por mensaje:</p>

          <div class="status-box">
            <div class="status-indicator">
              <span class="pulse-dot"></span>
              <strong>SERVICIO ACTIVO (ONLINE)</strong>
            </div>
            <div class="meta-row">
              <span>Gateway:</span>
              <strong>OpenClaw Enterprise</strong>
            </div>
            <div class="meta-row">
              <span>Puerto Host:</span>
              <strong>22088</strong>
            </div>
            <div class="meta-row">
              <span>Puerto Contenedor:</span>
              <strong>8080 (corpcredit-openclaw)</strong>
            </div>
            <div class="meta-row">
              <span>Destino Webhook:</span>
              <strong style="font-size: 0.75rem; word-break: break-all;">/api/v1/whatsapp/webhook</strong>
            </div>
          </div>

          <div class="features-list" style="margin-top: 1rem;">
            <div class="feature-item"><i class="check circle icon"></i> Envío de Vouchers Térmicos Digitales</div>
            <div class="feature-item"><i class="check circle icon"></i> Consultas Inbound Gratuitas (24h)</div>
            <div class="feature-item"><i class="check circle icon"></i> Clasificación Determinística Instantánea</div>
            <div class="feature-item"><i class="check circle icon"></i> Cero Dependencias de Mocks o IA Externa</div>
          </div>
        </div>

        <!-- QR CORPORATIVO DE ENLACE (4 COLS) -->
        <div class="bento-card" style="grid-column: span 4; text-align: center;">
          <div class="card-title" style="justify-content: center;">
            <i class="qrcode icon"></i>
            <h3>QR Corporativo de Entrada</h3>
          </div>
          <p class="card-desc">Escanee con WhatsApp para iniciar la ventana gratuita de 24 horas:</p>

          <div class="qr-canvas-box">
            <canvas #waQRCanvas></canvas>
          </div>

          <div class="qr-url-text">
            <code>https://wa.me/50588888888?text=INICIAR%20MI%20CREDITO</code>
          </div>

          <button class="ui tiny fluid basic button" style="margin-top: 0.75rem;" (click)="printQR()">
            <i class="print icon"></i> Imprimir Cartel para Empresas
          </button>
        </div>

        <!-- SIMULADOR INTERACTIVO EN VIVO (4 COLS) -->
        <div class="bento-card" style="grid-column: span 4;">
          <div class="card-title">
            <i class="terminal icon"></i>
            <h3>Simulador de Interacción</h3>
          </div>
          <p class="card-desc">Pruebe las respuestas del canal en tiempo real:</p>

          <div class="sim-form">
            <div class="field-group">
              <label>Teléfono del Empleado:</label>
              <select class="ui dropdown select-box" [(ngModel)]="simPhone">
                <option value="50588881234">50588881234 (Juan Pérez - Activo)</option>
                <option value="50588882345">50588882345 (María González - Ámbar)</option>
                <option value="50588884567">50588884567 (Sandra López - Bloqueado)</option>
                <option value="50588889999">50588889999 (Nuevo / No vinculado)</option>
              </select>
            </div>

            <div class="field-group">
              <label>Mensaje del Cliente:</label>
              <div class="quick-options-row">
                <button type="button" class="opt-btn" (click)="setMsg('1')">1️⃣ Aprobado</button>
                <button type="button" class="opt-btn" (click)="setMsg('2')">2️⃣ Disponible</button>
                <button type="button" class="opt-btn" (click)="setMsg('3')">3️⃣ Factura</button>
                <button type="button" class="opt-btn" (click)="setMsg('4')">4️⃣ Historial</button>
                <button type="button" class="opt-btn" (click)="setMsg('5')">5️⃣ Aumento</button>
              </div>

              <input
                type="text"
                class="ui-input"
                [(ngModel)]="simMessage"
                (keydown.enter)="sendSimulatedMessage()"
                placeholder="Escriba opción o pregunta..."
                style="margin-top: 0.5rem;"
              />
            </div>

            <button
              class="ui fluid primary button"
              style="margin-top: 0.75rem;"
              [disabled]="loading"
              (click)="sendSimulatedMessage()"
            >
              <i class="paper plane icon"></i> Enviar Mensaje a Webhook
            </button>
          </div>
        </div>

        <!-- TERMINAL DE RESPUESTA Y BITÁCORA EN TIEMPO REAL (12 COLS) -->
        <div class="bento-card" style="grid-column: span 12;">
          <div class="card-title">
            <i class="comments icon"></i>
            <h3>Bitácora de Conversaciones y Respuestas Inmediatas</h3>
          </div>

          <div class="interactions-feed" *ngIf="interactions.length > 0">
            <div class="interaction-bubble" *ngFor="let it of interactions">
              <div class="bubble-header">
                <span><i class="user icon"></i> Cliente: <strong>{{ it.from }}</strong></span>
                <span class="time">{{ it.timestamp | date: 'HH:mm:ss' }}</span>
              </div>
              <div class="client-msg">
                <strong>Mensaje Enviado:</strong> "{{ it.message }}"
              </div>
              <div class="backend-reply">
                <div class="reply-badge">Respuesta Generada por Sistema:</div>
                <pre>{{ it.reply }}</pre>
              </div>
            </div>
          </div>

          <div *ngIf="interactions.length === 0" style="text-align: center; color: var(--gray-text); padding: 2rem;">
            No se han registrado interacciones en esta sesión. Use el simulador de arriba para probar el flujo.
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .whatsapp-console-page {
        display: flex;
        flex-direction: column;
      }

      .page-header h2 {
        margin: 0;
        font-weight: 800;
      }

      .page-header p {
        margin: 0.25rem 0 0;
        color: var(--gray-text);
      }

      .card-title {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        margin-bottom: 0.4rem;
      }

      .card-title h3 {
        margin: 0;
        font-weight: 800;
        font-size: 1.1rem;
      }

      .card-desc {
        color: var(--gray-text);
        font-size: 0.8rem;
        margin-bottom: 1rem;
      }

      .status-box {
        background: var(--gray-subtle);
        border: 1px solid var(--gray-border);
        border-radius: 0.75rem;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .status-indicator {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: #047857;
        font-size: 0.85rem;
        font-weight: 700;
        margin-bottom: 0.25rem;
      }

      .pulse-dot {
        width: 10px;
        height: 10px;
        background-color: var(--emerald-main);
        border-radius: 50%;
        display: inline-block;
        box-shadow: 0 0 8px var(--emerald-main);
      }

      .meta-row {
        display: flex;
        justify-content: space-between;
        font-size: 0.8rem;
        color: var(--navy-800);
      }

      .features-list {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        font-size: 0.8rem;
        color: var(--gray-text);
      }

      .feature-item i.icon {
        color: var(--emerald-main);
      }

      .qr-canvas-box {
        background: #FFFFFF;
        padding: 1rem;
        display: inline-block;
        border: 2px dashed #CBD5E1;
        border-radius: 0.75rem;
      }

      .qr-canvas-box canvas {
        width: 150px !important;
        height: 150px !important;
        display: block;
      }

      .qr-url-text {
        margin-top: 0.75rem;
        font-size: 0.75rem;
        color: var(--gray-text);
        word-break: break-all;
      }

      .sim-form {
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
      }

      .field-group {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }

      .field-group label {
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--navy-800);
      }

      .select-box,
      .ui-input {
        padding: 0.6rem 0.75rem;
        border: 1px solid var(--gray-border);
        border-radius: 0.5rem;
        font-size: 0.85rem;
        outline: none;
      }

      .quick-options-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
      }

      .opt-btn {
        background: var(--gray-subtle);
        border: 1px solid var(--gray-border);
        border-radius: 0.35rem;
        padding: 0.25rem 0.5rem;
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
      }

      .opt-btn:hover {
        background: #E2E8F0;
      }

      .interactions-feed {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .interaction-bubble {
        background: var(--gray-subtle);
        border: 1px solid var(--gray-border);
        border-radius: 0.75rem;
        padding: 1.25rem;
      }

      .bubble-header {
        display: flex;
        justify-content: space-between;
        font-size: 0.85rem;
        margin-bottom: 0.5rem;
      }

      .bubble-header .time {
        color: var(--gray-text);
        font-size: 0.75rem;
      }

      .client-msg {
        font-size: 0.9rem;
        color: var(--navy-900);
        margin-bottom: 0.75rem;
      }

      .backend-reply {
        background: #FFFFFF;
        border: 1px solid #E2E8F0;
        border-left: 4px solid var(--emerald-main);
        border-radius: 0.5rem;
        padding: 0.85rem;
      }

      .reply-badge {
        font-size: 0.7rem;
        font-weight: 800;
        color: var(--emerald-text);
        text-transform: uppercase;
        margin-bottom: 0.35rem;
      }

      .backend-reply pre {
        margin: 0;
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-size: 0.85rem;
        white-space: pre-wrap;
        color: var(--navy-900);
        line-height: 1.4;
      }
    `,
  ],
})
export class WhatsappConsoleComponent implements OnInit {
  @ViewChild('waQRCanvas') waQRCanvas?: ElementRef<HTMLCanvasElement>;

  private readonly http = inject(HttpClient);

  simPhone = '50588881234';
  simMessage = '2';
  loading = false;
  interactions: SimulatedInteraction[] = [];

  ngOnInit(): void {
    setTimeout(() => this.renderEntryQR(), 100);
  }

  setMsg(text: string): void {
    this.simMessage = text;
  }

  renderEntryQR(): void {
    if (this.waQRCanvas?.nativeElement) {
      QRCode.toCanvas(
        this.waQRCanvas.nativeElement,
        'https://wa.me/50588888888?text=INICIAR%20MI%20CREDITO',
        { width: 150, margin: 1 },
      );
    }
  }

  printQR(): void {
    window.print();
  }

  sendSimulatedMessage(): void {
    if (!this.simMessage.trim()) return;
    this.loading = true;

    const payload = {
      from: this.simPhone,
      message: this.simMessage.trim(),
    };

    const webhookEndpoint = `${getApiBaseUrl()}/whatsapp/webhook`;

    this.http.post<{ status: string; reply?: string }>(webhookEndpoint, payload).subscribe({
      next: (res) => {
        this.loading = false;
        this.interactions.unshift({
          from: this.simPhone,
          message: payload.message,
          reply: res.reply || 'Menú interactivo enviado por WhatsApp',
          timestamp: new Date(),
        });
      },
      error: (err) => {
        this.loading = false;
        alert(err.error?.message || 'Error al comunicarse con webhook');
      },
    });
  }
}
