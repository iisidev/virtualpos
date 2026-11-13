import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ImportExportService,
  DryRunResult,
  ImportBatchLog,
} from '../../core/services/import-export.service';

@Component({
  selector: 'app-import-export',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="import-page">
      <div class="page-header bento-card">
        <div>
          <h2><i class="file excel outline icon"></i> Importación y Exportación Masiva</h2>
          <p>Motor transaccional con validación previa (Dry-Run) y descarga de plantillas oficiales</p>
        </div>
      </div>

      <div class="bento-grid" style="margin-top: 1.25rem;">
        <!-- STEP 1: DOWNLOAD TEMPLATES (4 COLS) -->
        <div class="bento-card" style="grid-column: span 4;">
          <div class="card-title">
            <span class="step-circle">1</span>
            <h3>Descargar Plantillas</h3>
          </div>
          <p class="card-desc">Obtenga los archivos base en Excel con el formato exacto requerido:</p>

          <div class="template-buttons">
            <button class="ui fluid basic primary button" (click)="download('clients')">
              <i class="download icon"></i> Plantilla Clientes Nuevos (.xlsx)
            </button>
            <button class="ui fluid basic primary button" (click)="download('credit_limits')">
              <i class="download icon"></i> Plantilla Aumento de Límites (.xlsx)
            </button>
            <button class="ui fluid basic primary button" (click)="download('payments')">
              <i class="download icon"></i> Plantilla Abonos de Planilla (.xlsx)
            </button>
          </div>
        </div>

        <!-- STEP 2: UPLOAD & DRY-RUN (8 COLS) -->
        <div class="bento-card" style="grid-column: span 8;">
          <div class="card-title">
            <span class="step-circle">2</span>
            <h3>Carga y Previsualización Transaccional (Dry-Run)</h3>
          </div>
          <p class="card-desc">Cargue su archivo para validar formato, duplicados y reglas financieras antes de aplicar a la base de datos:</p>

          <div class="upload-controls">
            <div class="control-field">
              <label>Tipo de Operación:</label>
              <select class="ui dropdown select-box" [(ngModel)]="selectedType">
                <option value="CLIENTS">Creación / Actualización de Clientes</option>
                <option value="CREDIT_LIMITS">Ajuste Masivo de Límites</option>
                <option value="PAYMENTS">Aplicación de Pagos / Abonos de Planilla</option>
              </select>
            </div>

            <div class="control-field">
              <label>Seleccionar Archivo (o Simular Lote):</label>
              <div class="action-buttons-row">
                <button class="ui teal button" (click)="loadDemoBatch()">
                  <i class="magic icon"></i> Cargar Lote de Prueba (5 Filas)
                </button>
              </div>
            </div>
          </div>

          <!-- DRY RUN SUMMARY REPORT -->
          <div *ngIf="dryRunResult" class="dry-run-report">
            <div class="metrics-grid">
              <div class="metric-card total">
                <span class="val">{{ dryRunResult.total_rows }}</span>
                <span class="lbl">Filas Totales</span>
              </div>
              <div class="metric-card new">
                <span class="val">{{ dryRunResult.new_count }}</span>
                <span class="lbl">Registros Nuevos</span>
              </div>
              <div class="metric-card update">
                <span class="val">{{ dryRunResult.update_count }}</span>
                <span class="lbl">Actualizaciones</span>
              </div>
              <div class="metric-card error" [class.has-errors]="dryRunResult.error_count > 0">
                <span class="val">{{ dryRunResult.error_count }}</span>
                <span class="lbl">Errores Detectados</span>
              </div>
            </div>

            <!-- Error List Alert -->
            <div *ngIf="dryRunResult.error_count > 0" class="ui negative message" style="margin-top: 1rem;">
              <div class="header">Se encontraron {{ dryRunResult.error_count }} errores:</div>
              <ul class="list">
                <li *ngFor="let err of dryRunResult.errors">
                  Fila {{ err.row }} [{{ err.field }}]: {{ err.message }}
                </li>
              </ul>
            </div>

            <!-- Preview Data Table -->
            <div class="table-responsive" style="margin-top: 1.25rem; max-height: 250px; overflow-y: auto;">
              <table class="ui very compact table">
                <thead>
                  <tr>
                    <th>Fila</th>
                    <th>Acción</th>
                    <th>Identificador</th>
                    <th>Detalle de Operación</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let row of dryRunResult.preview_data">
                    <td>{{ row.row }}</td>
                    <td>
                      <span
                        class="badge-status"
                        [ngClass]="{
                          active: row.action === 'CREATE',
                          amber: row.action === 'UPDATE',
                          blocked: row.action === 'ERROR'
                        }"
                      >
                        {{ row.action }}
                      </span>
                    </td>
                    <td><strong>{{ row.identifier }}</strong></td>
                    <td>{{ row.description }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Commit Button -->
            <div class="commit-bar" style="margin-top: 1.25rem;">
              <button
                class="ui positive large button"
                [disabled]="dryRunResult.error_count > 0 || committing"
                (click)="commitImport()"
              >
                <i class="check circle icon"></i>
                <span *ngIf="!committing">Confirmar y Aplicar Transacción ({{ dryRunResult.valid_rows }} Filas)</span>
                <span *ngIf="committing">Aplicando cambios en BD...</span>
              </button>
            </div>
          </div>
        </div>

        <!-- BATCH LOGS HISTORY (12 COLS) -->
        <div class="bento-card" style="grid-column: span 12;">
          <div class="card-title">
            <i class="history icon"></i>
            <h3>Historial de Lotes Importados (Trazabilidad Total)</h3>
          </div>

          <div class="table-responsive" style="margin-top: 1rem;">
            <table class="ui very basic table">
              <thead>
                <tr>
                  <th>Fecha y Hora</th>
                  <th>Archivo</th>
                  <th>Tipo</th>
                  <th>Filas Procesadas</th>
                  <th>Exitosas</th>
                  <th>Con Error</th>
                  <th>Usuario</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let log of batchLogs">
                  <td>{{ log.created_at | date: 'dd/MM/yyyy HH:mm:ss' }}</td>
                  <td><strong>{{ log.file_name }}</strong></td>
                  <td>{{ log.import_type }}</td>
                  <td>{{ log.total_rows }}</td>
                  <td><span class="ui green text">{{ log.successful_rows }}</span></td>
                  <td><span class="ui red text">{{ log.error_rows }}</span></td>
                  <td>{{ log.executed_by?.full_name || 'Admin' }}</td>
                </tr>
                <tr *ngIf="batchLogs.length === 0">
                  <td colspan="7" style="text-align: center; color: var(--gray-text); padding: 1.5rem;">
                    No se registran importaciones previas en la bitácora.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .import-page {
        display: flex;
        flex-direction: column;
      }

      .page-header {
        padding: 1.25rem 1.5rem;
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
        gap: 0.75rem;
        margin-bottom: 0.5rem;
      }

      .card-title h3 {
        margin: 0;
        font-weight: 800;
        font-size: 1.15rem;
      }

      .step-circle {
        width: 28px;
        height: 28px;
        background: var(--navy-900);
        color: #FFFFFF;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 0.85rem;
      }

      .card-desc {
        color: var(--gray-text);
        font-size: 0.85rem;
        margin-bottom: 1.25rem;
      }

      .template-buttons {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .upload-controls {
        display: flex;
        gap: 1.5rem;
        align-items: flex-end;
        background: var(--gray-subtle);
        padding: 1.25rem;
        border-radius: 0.75rem;
      }

      .control-field {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        flex: 1;
      }

      .control-field label {
        font-size: 0.8rem;
        font-weight: 700;
        color: var(--navy-800);
      }

      .select-box {
        padding: 0.65rem 0.85rem;
        border: 1px solid var(--gray-border);
        border-radius: 0.5rem;
        font-size: 0.9rem;
        outline: none;
      }

      .metrics-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 1rem;
        margin-top: 1.25rem;
      }

      .metric-card {
        background: var(--gray-subtle);
        padding: 1rem;
        border-radius: 0.75rem;
        border: 1px solid var(--gray-border);
        display: flex;
        flex-direction: column;
        text-align: center;
      }

      .metric-card .val {
        font-size: 1.75rem;
        font-weight: 800;
      }

      .metric-card .lbl {
        font-size: 0.75rem;
        color: var(--gray-text);
        font-weight: 600;
        margin-top: 0.25rem;
      }

      .metric-card.new .val {
        color: var(--emerald-main);
      }

      .metric-card.update .val {
        color: var(--amber-main);
      }

      .metric-card.error.has-errors {
        background: var(--red-subtle);
        border-color: var(--red-border);
      }

      .metric-card.error.has-errors .val {
        color: var(--red-main);
      }

      .commit-bar {
        display: flex;
        justify-content: flex-end;
      }
    `,
  ],
})
export class ImportExportComponent implements OnInit {
  private readonly importService = inject(ImportExportService);

  selectedType = 'CLIENTS';
  dryRunResult: DryRunResult | null = null;
  currentRows: Array<Record<string, string | number>> = [];
  committing = false;
  batchLogs: ImportBatchLog[] = [];

  ngOnInit(): void {
    this.loadLogs();
  }

  download(type: string): void {
    this.importService.downloadTemplate(type).subscribe((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `plantilla_${type}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    });
  }

  loadDemoBatch(): void {
    if (this.selectedType === 'CLIENTS') {
      this.currentRows = [
        {
          CEDULA: '001-140290-0004K',
          CODIGO_CARNET: 'EMP-105',
          NOMBRES: 'Roberto Antonio',
          APELLIDOS: 'Zamora Silva',
          CARGO: 'Supervisor de Producción',
          GRADO: 'G-4',
          CLASIFICACION: 'PLANTA',
          SALARIO: 28000,
          WHATSAPP_PHONE: '50588889901',
          FECHA_NACIMIENTO: '1990-02-14',
          LIMITE_APROBADO: 10000,
        },
        {
          CEDULA: '001-121092-0000X', // Existing demo client -> UPDATE
          CODIGO_CARNET: 'EMP-001',
          NOMBRES: 'Juan Alberto',
          APELLIDOS: 'Pérez Rostrán',
          CARGO: 'Ingeniero de Sistemas Principal',
          GRADO: 'G-6',
          CLASIFICACION: 'VIP',
          SALARIO: 48000,
          WHATSAPP_PHONE: '50588881234',
          FECHA_NACIMIENTO: '1992-10-12',
          LIMITE_APROBADO: 18000,
        },
        {
          CEDULA: '001-180796-0005M',
          CODIGO_CARNET: 'EMP-106',
          NOMBRES: 'Katia Valeska',
          APELLIDOS: 'Morales Cruz',
          CARGO: 'Especialista de Marketing',
          GRADO: 'G-3',
          CLASIFICACION: 'PLANTA',
          SALARIO: 24000,
          WHATSAPP_PHONE: '50588889902',
          FECHA_NACIMIENTO: '1996-07-18',
          LIMITE_APROBADO: 9000,
        },
      ];
    } else if (this.selectedType === 'CREDIT_LIMITS') {
      this.currentRows = [
        {
          CEDULA: '001-121092-0000X',
          NUEVO_LIMITE: 20000,
          MOTIVO_JUSTIFICACION: 'Aumento de límite por antigüedad',
        },
      ];
    } else {
      this.currentRows = [
        {
          CEDULA: '001-121092-0000X',
          MONTO_ABONO: 2000,
          REFERENCIA_PLANILLA: 'NOM-Q1-NOV-2026',
          OBSERVACIONES: 'Abono quincenal deducción nómina',
        },
      ];
    }

    this.importService.dryRun(this.selectedType, this.currentRows).subscribe({
      next: (res) => {
        this.dryRunResult = res;
      },
      error: (err) => {
        alert(err.error?.message || 'Error al ejecutar Dry-Run');
      },
    });
  }

  commitImport(): void {
    if (!this.dryRunResult || this.dryRunResult.error_count > 0) return;
    this.committing = true;

    this.importService
      .commit(this.selectedType, `lote_${this.selectedType.toLowerCase()}_${Date.now()}.xlsx`, this.currentRows)
      .subscribe({
        next: () => {
          this.committing = false;
          alert('¡Importación completada con éxito en el libro mayor!');
          this.dryRunResult = null;
          this.currentRows = [];
          this.loadLogs();
        },
        error: (err) => {
          this.committing = false;
          alert(err.error?.message || 'Error en la transacción de importación');
        },
      });
  }

  loadLogs(): void {
    this.importService.getLogs().subscribe({
      next: (logs) => {
        this.batchLogs = logs;
      },
    });
  }
}
