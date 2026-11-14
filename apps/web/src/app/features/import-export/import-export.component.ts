import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ImportExportService,
  DryRunResult,
  ImportBatchLog,
} from '../../core/services/import-export.service';
import { StatusBannerComponent } from '../../shared/status-banner.component';

@Component({
  selector: 'app-import-export',
  standalone: true,
  imports: [CommonModule, FormsModule, StatusBannerComponent],
  template: `
    <div class="import-page">
      <div class="page-header bento-card">
        <div>
          <h1><i class="file excel outline icon" aria-hidden="true"></i> Importación y Exportación Masiva</h1>
          <p>Motor transaccional con validación previa (Dry-Run) y descarga de plantillas oficiales</p>
        </div>
      </div>

      <app-status-banner
        [message]="feedbackMessage"
        [type]="feedbackType"
        (dismiss)="feedbackMessage = ''"
      ></app-status-banner>

      <div class="bento-grid">
        <!-- STEP 1: DOWNLOAD TEMPLATES (4 COLS) -->
        <div class="bento-card ui-col-4 ui-col-tablet-full">
          <div class="card-title">
            <span class="step-circle">1</span>
            <h2>Descargar Plantillas</h2>
          </div>
          <p class="card-desc">Obtenga los archivos base en Excel con el formato exacto requerido:</p>

          <div class="template-buttons">
            <button
              type="button"
              class="ui fluid basic primary button"
              (click)="download('clients')"
              [disabled]="downloadingType !== null"
            >
              <i class="download icon" aria-hidden="true"></i>
              {{ downloadingType === 'clients' ? 'Descargando...' : 'Plantilla Clientes Nuevos (.xlsx)' }}
            </button>
            <button
              type="button"
              class="ui fluid basic primary button"
              (click)="download('credit_limits')"
              [disabled]="downloadingType !== null"
            >
              <i class="download icon" aria-hidden="true"></i>
              {{ downloadingType === 'credit_limits' ? 'Descargando...' : 'Plantilla Aumento de Límites (.xlsx)' }}
            </button>
            <button
              type="button"
              class="ui fluid basic primary button"
              (click)="download('payments')"
              [disabled]="downloadingType !== null"
            >
              <i class="download icon" aria-hidden="true"></i>
              {{ downloadingType === 'payments' ? 'Descargando...' : 'Plantilla Abonos de Planilla (.xlsx)' }}
            </button>
          </div>
        </div>

        <!-- STEP 2: UPLOAD & DRY-RUN (8 COLS) -->
        <div class="bento-card ui-col-8">
          <div class="card-title">
            <span class="step-circle">2</span>
            <h2>Carga y Previsualización Transaccional (Dry-Run)</h2>
          </div>
          <p class="card-desc">Cargue su archivo para validar formato, duplicados y reglas financieras antes de aplicar a la base de datos:</p>

          <div class="upload-controls">
            <div class="control-field">
              <label for="import-operation-type">Tipo de Operación:</label>
              <select id="import-operation-type" class="ui dropdown select-box" [(ngModel)]="selectedType">
                <option value="CLIENTS">Creación / Actualización de Clientes</option>
                <option value="CREDIT_LIMITS">Ajuste Masivo de Límites</option>
                <option value="PAYMENTS">Aplicación de Pagos / Abonos de Planilla</option>
              </select>
            </div>

            <div class="control-field">
              <span class="field-caption">Simular Lote de Prueba:</span>
              <div class="action-buttons-row">
                <button
                  type="button"
                  class="ui teal button"
                  (click)="loadDemoBatch()"
                  [disabled]="runningDryRun"
                >
                  <i [ngClass]="runningDryRun ? 'spinner loading icon' : 'upload icon'" aria-hidden="true"></i>
                  {{ runningDryRun ? 'Validando Lote...' : 'Cargar Lote de Prueba' }}
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
            <div *ngIf="dryRunResult.error_count > 0" class="ui negative message dry-run-error-alert" role="alert">
              <div class="header">Se encontraron {{ dryRunResult.error_count }} errores:</div>
              <ul class="list">
                <li *ngFor="let err of dryRunResult.errors">
                  Fila {{ err.row }} [{{ err.field }}]: {{ err.message }}
                </li>
              </ul>
            </div>

            <!-- Preview Data Table -->
            <div class="table-responsive preview-table-scroll">
              <table class="ui compact table">
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
                    <td class="ui-mono">{{ row.row }}</td>
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
                    <td><strong class="ui-mono">{{ row.identifier }}</strong></td>
                    <td>{{ row.description }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Commit Button -->
            <div class="commit-bar">
              <button
                type="button"
                class="ui positive large button"
                [disabled]="dryRunResult.error_count > 0 || committing"
                (click)="commitImport()"
              >
                <i class="check circle icon" aria-hidden="true"></i>
                <span *ngIf="!committing">Confirmar y Aplicar Transacción ({{ dryRunResult.valid_rows }} Filas)</span>
                <span *ngIf="committing">Aplicando cambios en BD...</span>
              </button>
            </div>
          </div>
        </div>

        <!-- BATCH LOGS HISTORY (12 COLS) -->
        <div class="bento-card ui-col-12">
          <div class="card-title logs-header">
            <div class="logs-title-group">
              <i class="history icon" aria-hidden="true"></i>
              <h2>Historial de Lotes Importados (Trazabilidad Total)</h2>
            </div>
            <button type="button" class="ui-btn secondary-btn" (click)="loadLogs()" [disabled]="loadingLogs">
              <i class="refresh icon" aria-hidden="true"></i> {{ loadingLogs ? 'Actualizando...' : 'Actualizar' }}
            </button>
          </div>

          <div *ngIf="loadingLogs && batchLogs.length === 0" class="ui-state-box" role="status">
            <i class="spinner loading icon" aria-hidden="true"></i>
            <span>Cargando historial de lotes...</span>
          </div>

          <div *ngIf="logsError && batchLogs.length === 0" class="ui-banner error" role="alert">
            <span class="ui-banner-msg">
              <i class="exclamation triangle icon" aria-hidden="true"></i> {{ logsError }}
            </span>
            <button type="button" class="ui-btn primary-btn" (click)="loadLogs()">Reintentar</button>
          </div>

          <div *ngIf="!logsError && (batchLogs.length > 0 || !loadingLogs)" class="table-responsive logs-table-wrap">
            <table class="ui table">
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
                  <td class="ui-mono">{{ log.created_at | date: 'dd/MM/yyyy HH:mm:ss' }}</td>
                  <td><strong class="ui-mono">{{ log.file_name }}</strong></td>
                  <td>{{ log.import_type }}</td>
                  <td class="ui-mono">{{ log.total_rows }}</td>
                  <td><span class="ui-mono log-ok">{{ log.successful_rows }}</span></td>
                  <td><span class="ui-mono log-err">{{ log.error_rows }}</span></td>
                  <td>{{ log.executed_by?.full_name || 'Admin' }}</td>
                </tr>
                <tr *ngIf="batchLogs.length === 0">
                  <td colspan="7" class="empty-table-cell">
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
  styleUrl: './import-export.component.css',
})
export class ImportExportComponent implements OnInit {
  private readonly importService = inject(ImportExportService);

  selectedType = 'CLIENTS';
  dryRunResult: DryRunResult | null = null;
  currentRows: Array<Record<string, string | number>> = [];
  downloadingType: string | null = null;
  runningDryRun = false;
  committing = false;
  loadingLogs = false;
  logsError = '';
  feedbackMessage = '';
  feedbackType: 'success' | 'error' = 'success';
  batchLogs: ImportBatchLog[] = [];

  ngOnInit(): void {
    this.loadLogs();
  }

  download(type: string): void {
    this.downloadingType = type;
    this.feedbackMessage = '';
    this.importService.downloadTemplate(type).subscribe({
      next: (blob) => {
        this.downloadingType = null;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `plantilla_${type}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        this.downloadingType = null;
        this.feedbackType = 'error';
        this.feedbackMessage = err.error?.message || 'No se pudo descargar la plantilla solicitada.';
      },
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

    this.runningDryRun = true;
    this.feedbackMessage = '';
    this.importService.dryRun(this.selectedType, this.currentRows).subscribe({
      next: (res) => {
        this.runningDryRun = false;
        this.dryRunResult = res;
      },
      error: (err) => {
        this.runningDryRun = false;
        this.feedbackType = 'error';
        this.feedbackMessage = err.error?.message || 'Error al ejecutar Dry-Run';
      },
    });
  }

  commitImport(): void {
    if (!this.dryRunResult || this.dryRunResult.error_count > 0) return;
    this.committing = true;
    this.feedbackMessage = '';

    this.importService
      .commit(this.selectedType, `lote_${this.selectedType.toLowerCase()}_${Date.now()}.xlsx`, this.currentRows)
      .subscribe({
        next: () => {
          this.committing = false;
          this.feedbackType = 'success';
          this.feedbackMessage = 'Importación completada con éxito en el libro mayor.';
          this.dryRunResult = null;
          this.currentRows = [];
          this.loadLogs();
        },
        error: (err) => {
          this.committing = false;
          this.feedbackType = 'error';
          this.feedbackMessage = err.error?.message || 'Error en la transacción de importación';
        },
      });
  }

  loadLogs(): void {
    this.loadingLogs = true;
    this.logsError = '';
    this.importService.getLogs().subscribe({
      next: (logs) => {
        this.batchLogs = logs;
        this.loadingLogs = false;
      },
      error: (err) => {
        this.loadingLogs = false;
        this.logsError = err.error?.message || 'No se pudo cargar el historial de importaciones.';
      },
    });
  }
}

