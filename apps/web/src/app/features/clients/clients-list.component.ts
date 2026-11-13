import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { ClientProfile } from '../../core/models';
import { getApiBaseUrl } from '../../core/config/api.config';

@Component({
  selector: 'app-clients-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="clients-page">
      <div class="page-header bento-card">
        <div>
          <h2><i class="users icon"></i> Directorio de Clientes y Líneas de Crédito</h2>
          <p>Control de perfiles de colaboradores, saldos, límites asignados y bloqueos preventivos</p>
        </div>
      </div>

      <!-- Filters Ribbon (12 Cols) -->
      <div class="bento-card filter-card" style="margin-top: 1.25rem;">
        <div class="filter-group">
          <label>Búsqueda Rápida:</label>
          <input
            type="text"
            class="ui-input"
            [(ngModel)]="searchTerm"
            (input)="loadClients()"
            placeholder="Cédula, carnet, teléfono o nombre..."
          />
        </div>

        <div class="filter-group">
          <label>Clasificación:</label>
          <select class="ui dropdown select-box" [(ngModel)]="filterClassification" (change)="loadClients()">
            <option value="">Todas</option>
            <option value="VIP">VIP</option>
            <option value="PLANTA">PLANTA</option>
            <option value="EJECUTIVO">EJECUTIVO</option>
            <option value="TEMPORAL">TEMPORAL</option>
          </select>
        </div>

        <div class="filter-group">
          <label>Estado Crediticio:</label>
          <select class="ui dropdown select-box" [(ngModel)]="filterStatus" (change)="loadClients()">
            <option value="">Todos</option>
            <option value="ACTIVE">ACTIVO</option>
            <option value="FROZEN">CONGELADO</option>
            <option value="BLOCKED">BLOQUEADO</option>
          </select>
        </div>
      </div>

      <!-- Clients Bento Table -->
      <div class="bento-card table-card" style="margin-top: 1.25rem;">
        <div class="table-responsive">
          <table class="ui very basic selectable table">
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Cédula / Carnet</th>
                <th>Empresa Empleadora</th>
                <th>Cargo / Nivel</th>
                <th>Salario</th>
                <th>Límite Autorizado</th>
                <th>Consumido</th>
                <th>Disponible</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let c of clients">
                <td>
                  <strong>{{ c.full_name }}</strong>
                  <div class="sub-text">{{ c.whatsapp_phone }}</div>
                </td>
                <td>
                  <div>{{ c.national_id }}</div>
                  <span class="carnet-pill">{{ c.employee_code }}</span>
                </td>
                <td>{{ c.employer_name }}</td>
                <td>
                  <div>{{ c.job_title }}</div>
                  <span class="class-pill">{{ c.classification }} ({{ c.grade_level }})</span>
                </td>
                <td>
                  <span class="salary-tag">{{ c.salary }}</span>
                </td>
                <td><strong>C$ {{ formatNumber(c.approved_limit) }}</strong></td>
                <td>C$ {{ formatNumber(c.used_balance) }}</td>
                <td>
                  <strong [style.color]="c.status_color_class === 'red' ? '#991B1B' : (c.status_color_class === 'amber' ? '#B45309' : '#047857')">
                    C$ {{ formatNumber(c.available_balance) }}
                  </strong>
                </td>
                <td>
                  <span
                    class="badge-status"
                    [ngClass]="{
                      active: c.credit_status === 'ACTIVE' && c.status_color_class !== 'amber',
                      amber: c.status_color_class === 'amber',
                      blocked: c.credit_status !== 'ACTIVE'
                    }"
                  >
                    {{ c.credit_status }}
                  </span>
                </td>
                <td>
                  <button
                    *ngIf="c.credit_status === 'ACTIVE'"
                    class="ui mini basic red button"
                    (click)="toggleStatus(c, 'BLOCKED')"
                  >
                    Bloquear
                  </button>
                  <button
                    *ngIf="c.credit_status !== 'ACTIVE'"
                    class="ui mini basic green button"
                    (click)="toggleStatus(c, 'ACTIVE')"
                  >
                    Activar
                  </button>
                </td>
              </tr>
              <tr *ngIf="clients.length === 0">
                <td colspan="10" style="text-align: center; color: var(--gray-text); padding: 2rem;">
                  No se encontraron clientes con los filtros indicados.
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
      .clients-page {
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

      .filter-card {
        display: flex;
        gap: 1.5rem;
        align-items: center;
        padding: 1rem 1.5rem;
      }

      .filter-group {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        flex: 1;
      }

      .filter-group label {
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--navy-800);
      }

      .ui-input,
      .select-box {
        padding: 0.55rem 0.75rem;
        border: 1px solid var(--gray-border);
        border-radius: 0.5rem;
        font-size: 0.85rem;
        outline: none;
      }

      .sub-text {
        font-size: 0.75rem;
        color: var(--gray-text);
      }

      .carnet-pill,
      .class-pill {
        display: inline-block;
        font-size: 0.7rem;
        font-weight: 700;
        background: var(--gray-subtle);
        padding: 0.15rem 0.4rem;
        border-radius: 0.25rem;
        color: var(--navy-800);
      }

      .salary-tag {
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.8rem;
        font-weight: 600;
        color: #334155;
      }
    `,
  ],
})
export class ClientsListComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  clients: ClientProfile[] = [];
  searchTerm = '';
  filterClassification = '';
  filterStatus = '';

  ngOnInit(): void {
    this.loadClients();
  }

  loadClients(): void {
    const token = this.auth.token();
    const headers = new HttpHeaders({ Authorization: `Bearer ${token || ''}` });

    let url = `${getApiBaseUrl()}/clients?`;
    if (this.searchTerm) url += `search=${encodeURIComponent(this.searchTerm)}&`;
    if (this.filterClassification) url += `classification=${encodeURIComponent(this.filterClassification)}&`;
    if (this.filterStatus) url += `creditStatus=${encodeURIComponent(this.filterStatus)}&`;

    this.http.get<ClientProfile[]>(url, { headers }).subscribe({
      next: (data) => (this.clients = data),
    });
  }

  toggleStatus(client: ClientProfile, newStatus: string): void {
    const reason = prompt(`Ingrese motivo para cambiar estado a ${newStatus}:`);
    if (!reason || !reason.trim()) return;

    const token = this.auth.token();
    const headers = new HttpHeaders({ Authorization: `Bearer ${token || ''}` });

    this.http
      .patch(
        `${getApiBaseUrl()}/clients/${client.id}/status`,
        { credit_status: newStatus, reason: reason.trim() },
        { headers },
      )
      .subscribe({
        next: () => this.loadClients(),
        error: (err) => alert(err.error?.message || 'Error al actualizar estado'),
      });
  }

  formatNumber(val: string | number): string {
    return Number(val).toLocaleString('es-NI', { minimumFractionDigits: 2 });
  }
}

