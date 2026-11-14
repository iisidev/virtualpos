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
          <h1>
            <i class="whatsapp icon wa-brand-icon" aria-hidden="true"></i>
            Canal WhatsApp Costo Cero &amp; OpenClaw Gateway
          </h1>
          <p>Configuración del conector OpenClaw, enlace de cuentas por QR y simulador de flujo conversacional</p>
        </div>
      </div>

      <div class="bento-grid">
        <!-- OPENCLAW GATEWAY STATUS (4 COLS) -->
        <div class="bento-card ui-col-4">
          <div class="card-title">
            <i class="server icon" aria-hidden="true"></i>
            <h2>Conector OpenClaw Gateway</h2>
          </div>
          <p class="card-desc">Parámetros locales del servicio sin costo de API por mensaje:</p>

          <div class="status-box">
            <div class="status-indicator">
              <i class="plug icon" aria-hidden="true"></i>
              <strong>CONFIGURACIÓN OPENCLAW (DOCKER)</strong>
            </div>
            <div class="meta-row">
              <span>Gateway Image:</span>
              <strong class="ui-mono meta-mono-small">ghcr.io/openclaw/openclaw:latest</strong>
            </div>
            <div class="meta-row">
              <span>Puerto Host:</span>
              <strong class="ui-mono">22088</strong>
            </div>
            <div class="meta-row">
              <span>Puerto Contenedor:</span>
              <strong class="ui-mono">18789 (openclaw-gateway)</strong>
            </div>
            <div class="meta-row">
              <span>Token Acceso UI:</span>
              <code class="token-code">pos_virtual_claw_token_2026</code>
            </div>
            <div class="meta-row">
              <span>Destino Webhook:</span>
              <strong class="ui-mono meta-mono-small">/api/v1/whatsapp/webhook</strong>
            </div>
          </div>

          <div class="features-list">
            <div class="feature-item">
              <i class="check circle icon" aria-hidden="true"></i>
              Envío de Vouchers Térmicos Digitales
            </div>
            <div class="feature-item">
              <i class="check circle icon" aria-hidden="true"></i>
              Consultas Inbound Gratuitas (24h)
            </div>
            <div class="feature-item">
              <i class="check circle icon" aria-hidden="true"></i>
              Clasificación Determinística Instantánea
            </div>
            <div class="feature-item">
              <i class="check circle icon" aria-hidden="true"></i>
              Cero Dependencias de Mocks o IA Externa
            </div>
          </div>

          <div class="openclaw-actions">
            <a
              [href]="openClawDashboardUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="ui fluid primary button openclaw-link"
            >
              <i class="external alternate icon" aria-hidden="true"></i>
              Abrir Interfaz Web de OpenClaw (:22088)
            </a>
          </div>
        </div>

        <!-- QR CORPORATIVO DE ENLACE (4 COLS) -->
        <div class="bento-card ui-col-4 qr-bento-card">
          <div class="card-title card-title-centered">
            <i class="qrcode icon" aria-hidden="true"></i>
            <h2>QR Corporativo de Entrada</h2>
          </div>
          <p class="card-desc">Escanee con WhatsApp para iniciar la ventana gratuita de 24 horas:</p>

          <div class="qr-canvas-box">
            <canvas
              #waQRCanvas
              role="img"
              aria-label="Código QR para iniciar conversación de WhatsApp Corporativo en POS VIRTUAL"
            ></canvas>
          </div>

          <div class="qr-url-text">
            <code>https://wa.me/50588888888?text=INICIAR%20MI%20CREDITO</code>
          </div>

          <button type="button" class="ui tiny fluid basic button qr-print-btn" (click)="printQR()">
            <i class="print icon" aria-hidden="true"></i> Imprimir Cartel para Empresas
          </button>
        </div>

        <!-- SIMULADOR INTERACTIVO EN VIVO (4 COLS) -->
        <div class="bento-card ui-col-4 ui-col-tablet-full">
          <div class="card-title">
            <i class="terminal icon" aria-hidden="true"></i>
            <h2>Simulador de Interacción</h2>
          </div>
          <p class="card-desc">Pruebe las respuestas del canal en tiempo real:</p>

          <div *ngIf="simError" class="ui-banner error sim-error-banner" role="alert">
            <span class="ui-banner-msg">
              <i class="exclamation circle icon" aria-hidden="true"></i> {{ simError }}
            </span>
          </div>

          <div class="sim-form">
            <div class="field-group">
              <label for="wa-sim-phone">Teléfono del Empleado:</label>
              <select id="wa-sim-phone" class="ui dropdown select-box" [(ngModel)]="simPhone">
                <option value="50588881234">50588881234 (Juan Pérez - Activo)</option>
                <option value="50588882345">50588882345 (María González - Ámbar)</option>
                <option value="50588884567">50588884567 (Sandra López - Bloqueado)</option>
                <option value="50588889999">50588889999 (Nuevo / No vinculado)</option>
              </select>
            </div>

            <div class="field-group">
              <label for="wa-sim-message">Mensaje del Cliente:</label>
              <div class="quick-options-row" role="group" aria-label="Opciones rápidas de prueba">
                <button type="button" class="opt-btn" (click)="setMsg('1')">1. Aprobado</button>
                <button type="button" class="opt-btn" (click)="setMsg('2')">2. Disponible</button>
                <button type="button" class="opt-btn" (click)="setMsg('3')">3. Factura</button>
                <button type="button" class="opt-btn" (click)="setMsg('4')">4. Historial</button>
                <button type="button" class="opt-btn" (click)="setMsg('5')">5. Aumento</button>
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

            <button
              type="button"
              class="ui fluid primary button sim-submit-btn"
              [disabled]="loading"
              (click)="sendSimulatedMessage()"
            >
              <i [ngClass]="loading ? 'spinner loading icon' : 'paper plane icon'" aria-hidden="true"></i>
              {{ loading ? 'Enviando al Webhook...' : 'Enviar Mensaje a Webhook' }}
            </button>
          </div>
        </div>

        <!-- TERMINAL DE RESPUESTA Y BITÁCORA EN TIEMPO REAL (12 COLS) -->
        <div class="bento-card ui-col-12">
          <div class="card-title">
            <i class="comments icon" aria-hidden="true"></i>
            <h2>Bitácora de Conversaciones y Respuestas Inmediatas</h2>
          </div>

          <div class="interactions-feed" *ngIf="interactions.length > 0">
            <div class="interaction-bubble" *ngFor="let it of interactions">
              <div class="bubble-header">
                <span>
                  <i class="user icon" aria-hidden="true"></i>
                  Cliente: <strong class="ui-mono">{{ it.from }}</strong>
                </span>
                <span class="time ui-mono">{{ it.timestamp | date: 'HH:mm:ss' }}</span>
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

          <div *ngIf="interactions.length === 0" class="empty-feed">
            No se han registrado interacciones en esta sesión. Use el simulador de arriba para probar el flujo.
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrl: './whatsapp-console.component.css',
})
export class WhatsappConsoleComponent implements OnInit {
  @ViewChild('waQRCanvas') waQRCanvas?: ElementRef<HTMLCanvasElement>;

  private readonly http = inject(HttpClient);

  simPhone = '50588881234';
  simMessage = '2';
  loading = false;
  simError = '';
  interactions: SimulatedInteraction[] = [];

  get openClawDashboardUrl(): string {
    const host = window.location.hostname || 'localhost';
    return `http://${host}:22088`;
  }

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
    this.simError = '';

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
        this.simError = err.error?.message || 'Error al comunicarse con webhook';
      },
    });
  }
}

