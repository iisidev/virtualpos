import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as ExcelJS from 'exceljs';
import {
  ClientCreditProfile,
  Company,
  ImportBatchLog,
  CreditTransaction,
  AuditLog,
} from '../../database/entities';
import { ImportType, CreditStatus, TransactionType, TransactionStatus } from '../../common/enums';
import { CryptoService } from '../../common/crypto/crypto.service';

export interface DryRunValidationResult {
  import_type: ImportType;
  total_rows: number;
  valid_rows: number;
  new_count: number;
  update_count: number;
  error_count: number;
  errors: Array<{ row: number; field: string; message: string }>;
  preview_data: Array<{
    row: number;
    action: 'CREATE' | 'UPDATE' | 'ERROR';
    identifier: string;
    description: string;
    details: Record<string, string | number>;
  }>;
}

@Injectable()
export class ImportExportService {
  private readonly logger = new Logger(ImportExportService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly cryptoService: CryptoService,
  ) {}

  /**
   * Generates downloadable standard XLSX templates with formatting
   */
  async generateTemplate(type: ImportType): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Corp-Credit POS Virtual';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Plantilla');

    if (type === ImportType.CLIENTS) {
      sheet.columns = [
        { header: 'EMPRESA_CODIGO', key: 'company_code', width: 20 },
        { header: 'CODIGO_CARNET', key: 'employee_code', width: 18 },
        { header: 'CEDULA', key: 'national_id', width: 22 },
        { header: 'NOMBRES', key: 'first_name', width: 22 },
        { header: 'APELLIDOS', key: 'last_name', width: 22 },
        { header: 'CARGO', key: 'job_title', width: 25 },
        { header: 'GRADO', key: 'grade_level', width: 15 },
        { header: 'CLASIFICACION', key: 'classification', width: 18 },
        { header: 'SALARIO', key: 'salary', width: 15 },
        { header: 'WHATSAPP_PHONE', key: 'whatsapp_phone', width: 20 },
        { header: 'FECHA_NACIMIENTO', key: 'birth_date', width: 18 },
        { header: 'LIMITE_APROBADO', key: 'approved_limit', width: 18 },
      ];

      // Sample row
      sheet.addRow({
        company_code: 'EMP-CORP-01',
        employee_code: 'EMP-105',
        national_id: '001-140290-0004K',
        first_name: 'Roberto Antonio',
        last_name: 'Zamora Silva',
        job_title: 'Supervisor de Planta',
        grade_level: 'G-4',
        classification: 'PLANTA',
        salary: 28000,
        whatsapp_phone: '50588889901',
        birth_date: '1990-02-14',
        approved_limit: 10000,
      });
    } else if (type === ImportType.CREDIT_LIMITS) {
      sheet.columns = [
        { header: 'CEDULA', key: 'national_id', width: 22 },
        { header: 'NUEVO_LIMITE', key: 'new_limit', width: 18 },
        { header: 'MOTIVO_JUSTIFICACION', key: 'reason', width: 35 },
      ];

      sheet.addRow({
        national_id: '001-121092-0000X',
        new_limit: 20000,
        reason: 'Aumento semestral por antigüedad y desempeño',
      });
    } else {
      // PAYMENTS / ABONOS
      sheet.columns = [
        { header: 'CEDULA', key: 'national_id', width: 22 },
        { header: 'MONTO_ABONO', key: 'amount', width: 18 },
        { header: 'REFERENCIA_PLANILLA', key: 'reference', width: 25 },
        { header: 'OBSERVACIONES', key: 'notes', width: 30 },
      ];

      sheet.addRow({
        national_id: '001-121092-0000X',
        amount: 3500,
        reference: 'PLANILLA-Q1-NOV-2026',
        notes: 'Deducción quincenal de nómina',
      });
    }

    // Header styling
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' }, // Navy #0F172A
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Dry-Run validation engine: validates raw rows before writing to DB
   */
  async dryRunValidate(
    type: ImportType,
    rows: Array<Record<string, string | number>>,
  ): Promise<DryRunValidationResult> {
    if (!rows || rows.length === 0) {
      throw new BadRequestException('El archivo no contiene filas de datos');
    }

    const errors: Array<{ row: number; field: string; message: string }> = [];
    const previewData: Array<{
      row: number;
      action: 'CREATE' | 'UPDATE' | 'ERROR';
      identifier: string;
      description: string;
      details: Record<string, string | number>;
    }> = [];

    const seenIds = new Set<string>();
    let newCount = 0;
    let updateCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 2; // considering 1-based index and header row
      const cedula = String(r.CEDULA || r.national_id || '').trim();

      if (!cedula) {
        errors.push({ row: rowNum, field: 'CEDULA', message: 'La cédula es obligatoria' });
        previewData.push({
          row: rowNum,
          action: 'ERROR',
          identifier: 'SIN_CEDULA',
          description: 'Cédula ausente',
          details: r,
        });
        continue;
      }

      if (seenIds.has(cedula)) {
        errors.push({ row: rowNum, field: 'CEDULA', message: `Cédula ${cedula} duplicada en el archivo` });
        previewData.push({
          row: rowNum,
          action: 'ERROR',
          identifier: cedula,
          description: 'Registro duplicado en la misma plantilla',
          details: r,
        });
        continue;
      }
      seenIds.add(cedula);

      const existingClient = await this.dataSource.getRepository(ClientCreditProfile).findOne({
        where: { national_id: cedula },
      });

      if (type === ImportType.CLIENTS) {
        const approvedLimit = Number(r.LIMITE_APROBADO || r.approved_limit || 0);
        if (isNaN(approvedLimit) || approvedLimit < 0) {
          errors.push({ row: rowNum, field: 'LIMITE_APROBADO', message: 'Límite debe ser número positivo' });
        }

        if (existingClient) {
          updateCount++;
          previewData.push({
            row: rowNum,
            action: 'UPDATE',
            identifier: cedula,
            description: `Actualizará cliente existente: ${existingClient.first_name} ${existingClient.last_name}`,
            details: r,
          });
        } else {
          newCount++;
          previewData.push({
            row: rowNum,
            action: 'CREATE',
            identifier: cedula,
            description: `Creará nuevo cliente: ${r.NOMBRES || ''} ${r.APELLIDOS || ''}`,
            details: r,
          });
        }
      } else if (type === ImportType.CREDIT_LIMITS) {
        const newLimit = Number(r.NUEVO_LIMITE || r.new_limit || 0);
        if (isNaN(newLimit) || newLimit <= 0) {
          errors.push({ row: rowNum, field: 'NUEVO_LIMITE', message: 'El nuevo límite debe ser mayor a 0' });
        }

        if (!existingClient) {
          errors.push({ row: rowNum, field: 'CEDULA', message: `Cliente con cédula ${cedula} no existe en el sistema` });
          previewData.push({
            row: rowNum,
            action: 'ERROR',
            identifier: cedula,
            description: 'Cliente no encontrado para ajuste de límite',
            details: r,
          });
        } else {
          updateCount++;
          previewData.push({
            row: rowNum,
            action: 'UPDATE',
            identifier: cedula,
            description: `Cambiará límite de C$ ${existingClient.approved_limit} a C$ ${newLimit}`,
            details: r,
          });
        }
      } else {
        // PAYMENTS
        const amount = Number(r.MONTO_ABONO || r.amount || 0);
        if (isNaN(amount) || amount <= 0) {
          errors.push({ row: rowNum, field: 'MONTO_ABONO', message: 'El monto de abono debe ser mayor a 0' });
        }

        if (!existingClient) {
          errors.push({ row: rowNum, field: 'CEDULA', message: `Cliente con cédula ${cedula} no existe en el sistema` });
          previewData.push({
            row: rowNum,
            action: 'ERROR',
            identifier: cedula,
            description: 'Cliente no encontrado para aplicar abono',
            details: r,
          });
        } else {
          updateCount++;
          previewData.push({
            row: rowNum,
            action: 'UPDATE',
            identifier: cedula,
            description: `Aplicará abono de C$ ${amount} al saldo consumido (Actual: C$ ${existingClient.used_balance})`,
            details: r,
          });
        }
      }
    }

    return {
      import_type: type,
      total_rows: rows.length,
      valid_rows: rows.length - errors.length,
      new_count: newCount,
      update_count: updateCount,
      error_count: errors.length,
      errors,
      preview_data: previewData,
    };
  }

  /**
   * Transactional commit: Executes validated mass operations in a single QueryRunner transaction
   */
  async commitImport(
    type: ImportType,
    fileName: string,
    rows: Array<Record<string, string | number>>,
    userId: string,
  ): Promise<ImportBatchLog> {
    const dryRun = await this.dryRunValidate(type, rows);
    if (dryRun.error_count > 0) {
      throw new BadRequestException(
        `No se puede ejecutar la importación: existen ${dryRun.error_count} errores de validación. Corrija el archivo.`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('READ COMMITTED');

    try {
      const defaultCompany = await queryRunner.manager.findOne(Company, {
        where: { is_employer: true },
      });

      if (!defaultCompany) {
        throw new BadRequestException('No hay una empresa empleadora activa configurada');
      }

      for (const row of rows) {
        const cedula = String(row.CEDULA || row.national_id || '').trim();

        if (type === ImportType.CLIENTS) {
          let client = await queryRunner.manager.findOne(ClientCreditProfile, {
            where: { national_id: cedula },
            lock: { mode: 'pessimistic_write' },
          });

          const approved = Number(row.LIMITE_APROBADO || row.approved_limit || 0).toFixed(2);
          const rawSalary = Number(row.SALARIO || row.salary || 0);
          const encryptedSalary = rawSalary > 0 ? this.cryptoService.encrypt(rawSalary.toFixed(2)) : null;

          if (client) {
            client.first_name = String(row.NOMBRES || row.first_name || client.first_name).trim();
            client.last_name = String(row.APELLIDOS || row.last_name || client.last_name).trim();
            client.job_title = String(row.CARGO || row.job_title || client.job_title).trim();
            client.grade_level = String(row.GRADO || row.grade_level || client.grade_level).trim();
            client.classification = String(row.CLASIFICACION || row.classification || client.classification).trim();
            if (encryptedSalary) client.salary_encrypted = encryptedSalary;
            client.whatsapp_phone = String(row.WHATSAPP_PHONE || row.whatsapp_phone || client.whatsapp_phone).trim();
            client.birth_date = String(row.FECHA_NACIMIENTO || row.birth_date || client.birth_date || '').trim() || null;
            await queryRunner.manager.save(ClientCreditProfile, client);
          } else {
            const employeeCode = String(row.CODIGO_CARNET || row.employee_code || `EMP-${Date.now().toString().slice(-4)}`).trim();
            client = queryRunner.manager.create(ClientCreditProfile, {
              employer_company_id: defaultCompany.id,
              employee_code: employeeCode,
              national_id: cedula,
              first_name: String(row.NOMBRES || row.first_name || '').trim(),
              last_name: String(row.APELLIDOS || row.last_name || '').trim(),
              job_title: String(row.CARGO || row.job_title || 'EMPLEADO').trim(),
              grade_level: String(row.GRADO || row.grade_level || 'NIVEL-1').trim(),
              classification: String(row.CLASIFICACION || row.classification || 'PLANTA').trim(),
              salary_encrypted: encryptedSalary,
              whatsapp_phone: String(row.WHATSAPP_PHONE || row.whatsapp_phone || '').trim(),
              birth_date: String(row.FECHA_NACIMIENTO || row.birth_date || '').trim() || null,
              approved_limit: approved,
              used_balance: '0.00',
              available_balance: approved,
              credit_status: CreditStatus.ACTIVE,
              created_by: userId,
            });
            await queryRunner.manager.save(ClientCreditProfile, client);
          }
        } else if (type === ImportType.CREDIT_LIMITS) {
          const client = await queryRunner.manager.findOneOrFail(ClientCreditProfile, {
            where: { national_id: cedula },
            lock: { mode: 'pessimistic_write' },
          });

          const newLimit = Number(row.NUEVO_LIMITE || row.new_limit || 0);
          const used = Number(client.used_balance);
          const newAvailable = (newLimit - used).toFixed(2);

          client.approved_limit = newLimit.toFixed(2);
          client.available_balance = newAvailable;
          await queryRunner.manager.save(ClientCreditProfile, client);
        } else {
          // PAYMENTS
          const client = await queryRunner.manager.findOneOrFail(ClientCreditProfile, {
            where: { national_id: cedula },
            lock: { mode: 'pessimistic_write' },
          });

          const paymentAmt = Number(row.MONTO_ABONO || row.amount || 0);
          const used = Number(client.used_balance);
          const limit = Number(client.approved_limit);

          const newUsed = Math.max(0, used - paymentAmt);
          const newAvail = limit - newUsed;

          client.used_balance = newUsed.toFixed(2);
          client.available_balance = newAvail.toFixed(2);
          await queryRunner.manager.save(ClientCreditProfile, client);
        }
      }

      // Record Import Batch Log
      const batchLog = queryRunner.manager.create(ImportBatchLog, {
        file_name: fileName,
        import_type: type,
        total_rows: rows.length,
        successful_rows: rows.length,
        error_rows: 0,
        errors_summary: JSON.stringify([]),
        diff_summary: JSON.stringify({
          new_count: dryRun.new_count,
          update_count: dryRun.update_count,
        }),
        executed_by_user_id: userId,
      });

      const savedLog = await queryRunner.manager.save(ImportBatchLog, batchLog);
      await queryRunner.commitTransaction();

      return savedLog;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
