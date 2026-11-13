import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CreditRequestsService,
  CreditRequestItem,
} from '../../core/services/credit-requests.service';

@Component({
  selector: 'app-credit-requests',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="requests-page">
      <div class="page-header bento-card">
        <div>
          <h2><i class="chart line icon"></i> Solicitudes de Aumento de Crédito</h2>
          <p>Bandeja de solicitudes recibidas vía WhatsApp Bot y Portal Web para evaluación</p>
        </div>
      </div>

      <div class="bento-card" style="margin-top: 1.25rem;">
        <div class="table-responsive">
          <table class="ui very basic selectable table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Colaborador</th>
                <th>Cédula / Carnet</th>
                <th>Empresa</th>
                <th>Canal</th>
                <th>Límite Actual</th>
                <th>Límite Solicitado</th>
                <th>Motivo Declarado</th>
                <th>Estado</th>
                <th>Resolución</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let req of requests">
                <td>{{ req.created_at | date: 'dd/MM/yyyy HH:mm' }}</td>
                <td>
                  <strong>{{ req.client?.first_name }} {{ req.client?.last_name }}</strong>
                </td>
                <td>
                  <div>{{ req.client?.national_id }}</div>
                  <span class="carnet-pill">{{ req.client?.employee_code }}</span>
                </td>
                <td>{{ req.client?.employer_company?.name || 'Empresa' }}</td>
                <td>
                  <span class="ui tiny label" [class.green]="req.channel === 'WHATSAPP_BOT'">
                    <i class="whatsapp icon" *ngIf="req.channel === 'WHATSAPP_BOT'"></i>
                    {{ req.channel }}
                  </span>
                </td>
                <td>C$ {{ formatNumber(req.current_limit) }}</td>
                <td><strong class="ui blue text">C$ {{ formatNumber(req.requested_limit) }}</strong></td>
                <td><em>"{{ req.reason }}"</em></td>
                <td>
                  <span
                    class="badge-status"
                    [ngClass]="{
                      active: req.status === 'APPROVED',
                      amber: req.status === 'PENDING',
                      blocked: req.status === 'REJECTED'
                    }"
                  >
                    {{ req.status }}
                  </span>
                </td>
                <td>
                  <div *ngIf="req.status === 'PENDING'" class="ui tiny buttons">
                    <button class="ui positive button" (click)="resolve(req, 'APPROVE')">
                      Aprobar
                    </button>
                    <div class="or" data-text="o"></div>
                    <button class="ui negative button" (click)="resolve(req, 'REJECT')">
                      Rechazar
                    </button>
                  </div>
                  <span *ngIf="req.status !== 'PENDING'" class="sub-text">
                    Revisado por {{ req.reviewer?.username || 'Oficial' }}
                  </span>
                </td>
              </tr>
              <tr *ngIf="requests.length === 0">
                <td colspan="10" style="text-align: center; color: var(--gray-text); padding: 2rem;">
                  No hay solicitudes registradas en la bandeja.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .requests-page {
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

      .carnet-pill {
        display: inline-block;
        font-size: 0.7rem;
        font-weight: 700;
        background: var(--gray-subtle);
        padding: 0.15rem 0.4rem;
        border-radius: 0.25rem;
      }

      .sub-text {
        font-size: 0.75rem;
        color: var(--gray-text);
      }
    `,
  ],
})
export class CreditRequestsComponent implements OnInit {
  private readonly requestService = inject(CreditRequestsService);

  requests: CreditRequestItem[] = [];

  ngOnInit(): void {
    this.loadRequests();
  }

  loadRequests(): void {
    this.requestService.findAll().subscribe({
      next: (data) => (this.requests = data),
    });
  }

  resolve(req: CreditRequestItem, action: 'APPROVE' | 'REJECT'): void {
    const actionText = action === 'APPROVE' ? 'Aprobar' : 'Rechazar';
    const notes = prompt(`Observaciones o justificación para ${actionText} la solicitud:`) || '';

    this.requestService.review(req.id, action, notes).subscribe({
      next: () => {
        alert(`Solicitud ${action === 'APPROVE' ? 'aprobada y límite actualizado en el libro mayor' : 'rechazada'}.`);
        this.loadRequests();
      },
      error: (err) => alert(err.error?.message || 'Error al procesar la resolución'),
    });
  }

  formatNumber(val: string | number): string {
    return Number(val).toLocaleString('es-NI', { minimumFractionDigits: 2 });
  }
}
