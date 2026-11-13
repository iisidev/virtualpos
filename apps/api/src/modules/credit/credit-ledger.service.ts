import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import {
  ClientCreditProfile,
  CreditTransaction,
  AuditLog,
  CashRegister,
} from '../../database/entities';
import {
  CreditStatus,
  TransactionStatus,
  TransactionType,
} from '../../common/enums';
import { CryptoService } from '../../common/crypto/crypto.service';
import { RedisLockService } from './redis-lock.service';
import { ChargeRequestDto } from './dto/charge-request.dto';
import { PaymentRequestDto, VoidRequestDto, AdjustLimitDto } from './dto/other-requests.dto';

export interface VoucherDetails {
  transaction_id: string;
  authorization_code: string;
  voucher_number: string;
  external_invoice_number: string;
  created_at: Date;
  status: TransactionStatus;
  amount: string;
  currency: string;
  previous_available_balance: string;
  new_available_balance: string;
  client: {
    id: string;
    full_name: string;
    masked_national_id: string;
    employee_code: string;
    employer_name: string;
  };
  merchant: {
    id: string;
    name: string;
    ruc: string;
  };
  terminal: {
    terminal_code: string;
    name: string;
    location: string;
  };
  cashier: {
    id: string;
    full_name: string;
    username: string;
  };
  signature_hash: string;
  verification_qr_payload: string;
}

@Injectable()
export class CreditLedgerService {
  private readonly logger = new Logger(CreditLedgerService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly cryptoService: CryptoService,
    private readonly redisLockService: RedisLockService,
  ) {}

  /**
   * Generates a unique bank-style authorization code (e.g. AUTH-849201)
   */
  private generateAuthCode(): string {
    const randomDigits = crypto.randomInt(100000, 999999).toString();
    return `AUTH-${randomDigits}`;
  }

  /**
   * Masks a national ID for privacy on printed receipts (e.g., 001-******-0000X)
   */
  private maskNationalId(nationalId: string): string {
    if (!nationalId || nationalId.length < 8) return nationalId;
    const start = nationalId.substring(0, 4);
    const end = nationalId.substring(nationalId.length - 4);
    return `${start}******${end}`;
  }

  /**
   * Executes a purchase charge with STRICT transactional integrity:
   * 1. Redis distributed lock & Idempotency check
   * 2. QueryRunner pessimistic_write row lock
   * 3. Balance verification
   * 4. Ledger entry creation with SHA-256 audit hash
   */
  async executeCharge(
    dto: ChargeRequestDto,
    cashierUserId: string,
    ipAddress?: string,
  ): Promise<VoucherDetails> {
    // 1. Idempotency Check
    const isNewRequest = await this.redisLockService.registerIdempotency(dto.idempotency_key);
    if (!isNewRequest) {
      const existing = await this.dataSource.getRepository(CreditTransaction).findOne({
        where: { idempotency_key: dto.idempotency_key },
        relations: {
          client: { employer_company: true },
          merchant_company: true,
          cash_register: true,
          cashier_user: true,
        },
      });
      if (existing) {
        return this.mapToVoucherDetails(existing);
      }
    }

    // 2. Distributed Lock
    const lockKey = `client_charge_${dto.client_id}`;
    const acquired = await this.redisLockService.acquireLock(lockKey, 8000);
    if (!acquired) {
      throw new ConflictException('Hay otra transacción financiera en proceso para este cliente. Reintente en un momento.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('READ COMMITTED');

    try {
      // 3. Pessimistic row locking
      const client = await queryRunner.manager.findOne(ClientCreditProfile, {
        where: { id: dto.client_id },
        relations: { employer_company: true },
        lock: { mode: 'pessimistic_write' },
      });

      if (!client) {
        throw new NotFoundException(`Cliente con ID ${dto.client_id} no fue encontrado`);
      }

      if (client.credit_status !== CreditStatus.ACTIVE) {
        throw new BadRequestException(
          `La línea de crédito no está activa para compras. Estado actual: ${client.credit_status}`,
        );
      }

      // Check PIN if defined
      if (client.pin_hash && dto.pin) {
        const pinValid = await bcrypt.compare(dto.pin, client.pin_hash);
        if (!pinValid) {
          throw new BadRequestException('El PIN de autorización ingresado es incorrecto');
        }
      }

      const chargeAmount = Number(dto.amount);
      if (isNaN(chargeAmount) || chargeAmount <= 0) {
        throw new BadRequestException('El monto a cobrar debe ser un número positivo');
      }

      const availableBalance = Number(client.available_balance);
      const usedBalance = Number(client.used_balance);

      if (availableBalance < chargeAmount) {
        throw new BadRequestException(
          `Saldo insuficiente. Disponible: C$ ${availableBalance.toFixed(2)}, Requerido: C$ ${chargeAmount.toFixed(2)}`,
        );
      }

      // Financial Calculation
      const newAvailable = Number((availableBalance - chargeAmount).toFixed(2));
      const newUsed = Number((usedBalance + chargeAmount).toFixed(2));

      client.available_balance = newAvailable.toFixed(2);
      client.used_balance = newUsed.toFixed(2);
      await queryRunner.manager.save(ClientCreditProfile, client);

      // Resolve Cash Register (with fallback to default open register)
      let cashRegister: CashRegister | null = null;
      if (dto.cash_register_id) {
        cashRegister = await queryRunner.manager.findOne(CashRegister, {
          where: { id: dto.cash_register_id },
          relations: { company: true },
        });
      }

      if (!cashRegister) {
        cashRegister = await queryRunner.manager.findOne(CashRegister, {
          relations: { company: true },
        });
      }

      if (!cashRegister) {
        throw new BadRequestException('No existe ninguna terminal de caja registrada en el sistema');
      }

      const merchantCompanyId =
        dto.merchant_company_id || cashRegister.company_id || client.employer_company_id;

      // Voucher counter per cash register
      const count = await queryRunner.manager.count(CreditTransaction, {
        where: { cash_register_id: cashRegister.id },
      });
      const voucherNumber = `VOUCH-${(count + 1).toString().padStart(6, '0')}`;
      const authCode = this.generateAuthCode();
      const now = new Date();

      // SHA-256 Signature Hash
      const signatureHash = this.cryptoService.generateTransactionSignature(
        client.id,
        chargeAmount,
        now,
        authCode,
      );

      // Immutable Ledger Entry
      const transaction = queryRunner.manager.create(CreditTransaction, {
        authorization_code: authCode,
        voucher_number: voucherNumber,
        idempotency_key: dto.idempotency_key,
        client_id: client.id,
        merchant_company_id: merchantCompanyId,
        cash_register_id: cashRegister.id,
        cashier_user_id: cashierUserId,
        external_invoice_number: dto.external_invoice_number.trim(),
        transaction_type: TransactionType.PURCHASE_CHARGE,
        amount: chargeAmount.toFixed(2),
        previous_available_balance: availableBalance.toFixed(2),
        new_available_balance: newAvailable.toFixed(2),
        status: TransactionStatus.APPROVED,
        signature_hash: signatureHash,
        notes: dto.notes || null,
        created_at: now,
      });

      const savedTx = await queryRunner.manager.save(CreditTransaction, transaction);

      // Audit Log
      const auditLog = queryRunner.manager.create(AuditLog, {
        action: 'PURCHASE_CHARGE_COMPLETED',
        entity_type: 'CreditTransaction',
        entity_id: savedTx.id,
        previous_data: JSON.stringify({ available: availableBalance, used: usedBalance }),
        new_data: JSON.stringify({ available: newAvailable, used: newUsed, amount: chargeAmount }),
        performed_by_user_id: cashierUserId,
        ip_address: ipAddress || null,
        created_at: now,
      });
      await queryRunner.manager.save(AuditLog, auditLog);

      await queryRunner.commitTransaction();

      // Fetch full details for the printed voucher response
      const loaded = await this.dataSource.getRepository(CreditTransaction).findOneOrFail({
        where: { id: savedTx.id },
        relations: {
          client: { employer_company: true },
          merchant_company: true,
          cash_register: true,
          cashier_user: true,
        },
      });

      return this.mapToVoucherDetails(loaded);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
      await this.redisLockService.releaseLock(lockKey);
    }
  }

  /**
   * Executes a payroll or manual payment (Abono a Cuenta)
   */
  async executePayment(
    dto: PaymentRequestDto,
    performedByUserId: string,
    ipAddress?: string,
  ): Promise<CreditTransaction> {
    const isNew = await this.redisLockService.registerIdempotency(dto.idempotency_key);
    if (!isNew) {
      const existing = await this.dataSource.getRepository(CreditTransaction).findOne({
        where: { idempotency_key: dto.idempotency_key },
      });
      if (existing) return existing;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('READ COMMITTED');

    try {
      const client = await queryRunner.manager.findOne(ClientCreditProfile, {
        where: { id: dto.client_id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!client) {
        throw new NotFoundException(`Cliente ${dto.client_id} no encontrado`);
      }

      const paymentAmount = Number(dto.amount);
      const usedBalance = Number(client.used_balance);
      const availableBalance = Number(client.available_balance);

      const newUsed = Math.max(0, Number((usedBalance - paymentAmount).toFixed(2)));
      const newAvailable = Number((Number(client.approved_limit) - newUsed).toFixed(2));

      client.used_balance = newUsed.toFixed(2);
      client.available_balance = newAvailable.toFixed(2);
      await queryRunner.manager.save(ClientCreditProfile, client);

      const authCode = this.generateAuthCode();
      const now = new Date();
      const signatureHash = this.cryptoService.generateTransactionSignature(
        client.id,
        paymentAmount,
        now,
        authCode,
      );

      const tx = queryRunner.manager.create(CreditTransaction, {
        authorization_code: authCode,
        voucher_number: `ABONO-${dto.reference_number}`,
        idempotency_key: dto.idempotency_key,
        client_id: client.id,
        merchant_company_id: client.employer_company_id,
        cash_register_id: client.employer_company_id, // Reference ID
        cashier_user_id: performedByUserId,
        external_invoice_number: dto.reference_number,
        transaction_type: TransactionType.PAYMENT_ABONO,
        amount: paymentAmount.toFixed(2),
        previous_available_balance: availableBalance.toFixed(2),
        new_available_balance: newAvailable.toFixed(2),
        status: TransactionStatus.APPROVED,
        signature_hash: signatureHash,
        notes: dto.notes || 'Abono / Pago de Planilla',
        created_at: now,
      });

      const savedTx = await queryRunner.manager.save(CreditTransaction, tx);

      const audit = queryRunner.manager.create(AuditLog, {
        action: 'PAYMENT_ABONO_APPLIED',
        entity_type: 'CreditTransaction',
        entity_id: savedTx.id,
        previous_data: JSON.stringify({ used: usedBalance, available: availableBalance }),
        new_data: JSON.stringify({ used: newUsed, available: newAvailable, amount: paymentAmount }),
        performed_by_user_id: performedByUserId,
        ip_address: ipAddress || null,
        created_at: now,
      });
      await queryRunner.manager.save(AuditLog, audit);

      await queryRunner.commitTransaction();
      return savedTx;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Executes a legal transaction void and balance reversal:
   * 1. QueryRunner locks original transaction and client profile
   * 2. Restores consumed balance to available balance
   * 3. Marks original transaction as VOIDED with mandatory reason
   * 4. Appends a VOID_REVERSAL transaction to the immutable ledger
   * 5. Emits AuditLog
   */
  async executeVoid(
    transactionId: string,
    dto: VoidRequestDto,
    cashierUserId: string,
    ipAddress?: string,
  ): Promise<CreditTransaction> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('READ COMMITTED');

    try {
      const originalTx = await queryRunner.manager.findOne(CreditTransaction, {
        where: { id: transactionId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!originalTx) {
        throw new NotFoundException(`Transacción ${transactionId} no encontrada`);
      }

      if (originalTx.status === TransactionStatus.VOIDED) {
        throw new BadRequestException('Esta transacción ya fue anulada previamente');
      }

      if (originalTx.transaction_type !== TransactionType.PURCHASE_CHARGE) {
        throw new BadRequestException('Solo las transacciones de compra directa pueden ser anuladas');
      }

      const client = await queryRunner.manager.findOne(ClientCreditProfile, {
        where: { id: originalTx.client_id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!client) {
        throw new NotFoundException('Cliente asociado a la transacción no existe');
      }

      const voidAmount = Number(originalTx.amount);
      const usedBalance = Number(client.used_balance);
      const availableBalance = Number(client.available_balance);

      // Balance Reversal
      const restoredUsed = Math.max(0, Number((usedBalance - voidAmount).toFixed(2)));
      const restoredAvailable = Number((availableBalance + voidAmount).toFixed(2));

      client.used_balance = restoredUsed.toFixed(2);
      client.available_balance = restoredAvailable.toFixed(2);
      await queryRunner.manager.save(ClientCreditProfile, client);

      const now = new Date();
      originalTx.status = TransactionStatus.VOIDED;
      originalTx.voided_at = now;
      originalTx.voided_by_user_id = cashierUserId;
      originalTx.void_reason = dto.void_reason.trim();
      await queryRunner.manager.save(CreditTransaction, originalTx);

      // Reversal Ledger Record
      const reversalAuthCode = `REV-${this.generateAuthCode().replace('AUTH-', '')}`;
      const reversalSignature = this.cryptoService.generateTransactionSignature(
        client.id,
        voidAmount,
        now,
        reversalAuthCode,
      );

      const reversalTx = queryRunner.manager.create(CreditTransaction, {
        authorization_code: reversalAuthCode,
        voucher_number: `REV-${originalTx.voucher_number}`,
        idempotency_key: `reversal_${originalTx.id}_${now.getTime()}`,
        client_id: client.id,
        merchant_company_id: originalTx.merchant_company_id,
        cash_register_id: originalTx.cash_register_id,
        cashier_user_id: cashierUserId,
        external_invoice_number: originalTx.external_invoice_number,
        transaction_type: TransactionType.VOID_REVERSAL,
        amount: voidAmount.toFixed(2),
        previous_available_balance: availableBalance.toFixed(2),
        new_available_balance: restoredAvailable.toFixed(2),
        status: TransactionStatus.APPROVED,
        signature_hash: reversalSignature,
        notes: `Anulación de ${originalTx.authorization_code}. Motivo: ${dto.void_reason}`,
        created_at: now,
      });
      const savedReversal = await queryRunner.manager.save(CreditTransaction, reversalTx);

      const audit = queryRunner.manager.create(AuditLog, {
        action: 'TRANSACTION_VOIDED_AND_REVERSED',
        entity_type: 'CreditTransaction',
        entity_id: originalTx.id,
        previous_data: JSON.stringify({ status: TransactionStatus.APPROVED, amount: voidAmount }),
        new_data: JSON.stringify({
          status: TransactionStatus.VOIDED,
          reason: dto.void_reason,
          reversal_id: savedReversal.id,
        }),
        performed_by_user_id: cashierUserId,
        ip_address: ipAddress || null,
        created_at: now,
      });
      await queryRunner.manager.save(AuditLog, audit);

      await queryRunner.commitTransaction();
      return savedReversal;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Adjusts credit limit with transactional recalculation and audit
   */
  async adjustLimit(
    dto: AdjustLimitDto,
    performedByUserId: string,
    ipAddress?: string,
  ): Promise<ClientCreditProfile> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('READ COMMITTED');

    try {
      const client = await queryRunner.manager.findOne(ClientCreditProfile, {
        where: { id: dto.client_id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!client) {
        throw new NotFoundException('Cliente no encontrado');
      }

      const prevLimit = Number(client.approved_limit);
      const usedBalance = Number(client.used_balance);
      const newLimit = Number(dto.new_limit);

      const newAvailable = Number((newLimit - usedBalance).toFixed(2));

      client.approved_limit = newLimit.toFixed(2);
      client.available_balance = newAvailable.toFixed(2);
      const updated = await queryRunner.manager.save(ClientCreditProfile, client);

      const now = new Date();
      const authCode = this.generateAuthCode();
      const sigHash = this.cryptoService.generateTransactionSignature(client.id, newLimit, now, authCode);

      const tx = queryRunner.manager.create(CreditTransaction, {
        authorization_code: authCode,
        voucher_number: `LIM-${now.getTime()}`,
        idempotency_key: `limit_adj_${client.id}_${now.getTime()}`,
        client_id: client.id,
        merchant_company_id: client.employer_company_id,
        cash_register_id: client.employer_company_id,
        cashier_user_id: performedByUserId,
        external_invoice_number: 'ADJ-LIMITE',
        transaction_type: TransactionType.LIMIT_ADJUSTMENT,
        amount: Math.abs(newLimit - prevLimit).toFixed(2),
        previous_available_balance: (prevLimit - usedBalance).toFixed(2),
        new_available_balance: newAvailable.toFixed(2),
        status: TransactionStatus.APPROVED,
        signature_hash: sigHash,
        notes: `Ajuste de límite de C$ ${prevLimit} a C$ ${newLimit}. Motivo: ${dto.reason}`,
        created_at: now,
      });
      await queryRunner.manager.save(CreditTransaction, tx);

      const audit = queryRunner.manager.create(AuditLog, {
        action: 'CREDIT_LIMIT_ADJUSTED',
        entity_type: 'ClientCreditProfile',
        entity_id: client.id,
        previous_data: JSON.stringify({ approved_limit: prevLimit }),
        new_data: JSON.stringify({ approved_limit: newLimit, reason: dto.reason }),
        performed_by_user_id: performedByUserId,
        ip_address: ipAddress || null,
        created_at: now,
      });
      await queryRunner.manager.save(AuditLog, audit);

      await queryRunner.commitTransaction();
      return updated;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Helper to map transaction to complete thermal voucher specification
   */
  mapToVoucherDetails(tx: CreditTransaction): VoucherDetails {
    const client = tx.client;
    const merchant = tx.merchant_company;
    const register = tx.cash_register;
    const cashier = tx.cashier_user;

    const qrPayload = JSON.stringify({
      auth: tx.authorization_code,
      vouch: tx.voucher_number,
      amt: tx.amount,
      date: tx.created_at,
      sig: tx.signature_hash.substring(0, 16),
    });

    return {
      transaction_id: tx.id,
      authorization_code: tx.authorization_code,
      voucher_number: tx.voucher_number,
      external_invoice_number: tx.external_invoice_number,
      created_at: tx.created_at,
      status: tx.status,
      amount: tx.amount,
      currency: 'C$',
      previous_available_balance: tx.previous_available_balance,
      new_available_balance: tx.new_available_balance,
      client: {
        id: client ? client.id : tx.client_id,
        full_name: client ? `${client.first_name} ${client.last_name}` : 'CLIENTE CORPORATIVO',
        masked_national_id: client ? this.maskNationalId(client.national_id) : '***',
        employee_code: client ? client.employee_code : '***',
        employer_name: client?.employer_company ? client.employer_company.name : 'EMPRESA AFILIADA',
      },
      merchant: {
        id: merchant ? merchant.id : tx.merchant_company_id,
        name: merchant ? merchant.name : 'COMERCIO AFILIADO',
        ruc: merchant ? merchant.ruc : '***',
      },
      terminal: {
        terminal_code: register ? register.terminal_code : 'POS-01',
        name: register ? register.name : 'CAJA 01',
        location: register ? register.location : 'TIENDA',
      },
      cashier: {
        id: cashier ? cashier.id : tx.cashier_user_id,
        full_name: cashier ? cashier.full_name : 'CAJERO',
        username: cashier ? cashier.username : 'cajero',
      },
      signature_hash: tx.signature_hash,
      verification_qr_payload: qrPayload,
    };
  }
}
