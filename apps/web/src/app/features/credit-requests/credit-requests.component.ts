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
          <h2><i class="chart line icon" aria-hidden="true"></i> Solicitudes de Aumento de Crédito</h2>
          <p>Bandeja de solicitudes recibidas vía WhatsApp Bot y Portal Web para evaluación</p>
        </div>
      </div>

      <div class="bento-card">
        <div class="table-responsive">
          <table class="ui selectable table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Colaborador</th>
                <th>Cédula / Carnet</th>
                <th>Empresa</th>
                <th>Canal</th>
                <th class="text-right">Límite Actual</th>
                <th class="text-right">Límite Solicitado</th>
                <th>Motivo Declarado</th>
                <th>Estado</th>
                <th>Resolución</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let req of requests">
                <td class="ui-mono">{{ req.created_at | date: 'dd/MM/yyyy HH:mm' }}</td>
                <td>
                  <strong>{{ req.client?.first_name }} {{ req.client?.last_name }}</strong>
                </td>
                <td>
                  <div class="ui-mono">{{ req.client?.national_id }}</div>
                  <span class="carnet-pill ui-mono">{{ req.client?.employee_code }}</span>
                </td>
                <td>{{ req.client?.employer_company?.name || 'Empresa' }}</td>
                <td>
                  <span class="ui tiny label" [class.green]="req.channel === 'WHATSAPP_BOT'">
                    <i class="whatsapp icon" *ngIf="req.channel === 'WHATSAPP_BOT'" aria-hidden="true"></i>
                    {{ req.channel }}
                  </span>
                </td>
                <td class="ui-amount-cell">C$ {{ formatNumber(req.current_limit) }}</td>
                <td class="ui-amount-cell">
                  <strong class="requested-limit-value">C$ {{ formatNumber(req.requested_limit) }}</strong>
                </td>
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
                    <button type="button" class="ui positive button" (click)="resolve(req, 'APPROVE')">
                      Aprobar
                    </button>
                    <div class="or" data-text="o"></div>
                    <button type="button" class="ui negative button" (click)="resolve(req, 'REJECT')">
                      Rechazar
                    </button>
                  </div>
                  <span *ngIf="req.status !== 'PENDING'" class="sub-text">
                    Revisado por {{ req.reviewer?.username || 'Oficial' }}
                  </span>
                </td>
              </tr>
              <tr *ngIf="requests.length === 0">
                <td colspan="10" class="empty-table-cell">
                  No hay solicitudes registradas en la bandeja.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styleUrl: './credit-requests.component.css',
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

