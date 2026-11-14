import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TransactionType, TransactionStatus } from '../../common/enums';
import { ClientCreditProfile } from './client-credit-profile.entity';
import { Company } from './company.entity';
import { CashRegister } from './cash-register.entity';
import { User } from './user.entity';

@Entity('credit_transactions')
export class CreditTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 32, unique: true })
  authorization_code!: string;

  @Index()
  @Column({ type: 'varchar', length: 50 })
  voucher_number!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 128, unique: true })
  idempotency_key!: string;

  @Index()
  @Column({ type: 'uuid' })
  client_id!: string;

  @Index()
  @Column({ type: 'uuid' })
  merchant_company_id!: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  cash_register_id?: string | null;

  @Index()
  @Column({ type: 'uuid' })
  cashier_user_id!: string;

  @Index()
  @Column({ type: 'varchar', length: 100, default: '' })
  external_invoice_number!: string;

  @Column({
    type: 'enum',
    enum: TransactionType,
    default: TransactionType.PURCHASE_CHARGE,
  })
  transaction_type!: TransactionType;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  previous_available_balance!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  new_available_balance!: string;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.APPROVED,
  })
  status!: TransactionStatus;

  @Column({ type: 'timestamptz', nullable: true })
  voided_at?: Date | null;

  @Column({ type: 'uuid', nullable: true })
  voided_by_user_id?: string | null;

  @Column({ type: 'text', nullable: true })
  void_reason?: string | null;

  @Column({ type: 'varchar', length: 64 })
  signature_hash!: string;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @ManyToOne(() => ClientCreditProfile, (c) => c.transactions, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'client_id' })
  client?: ClientCreditProfile;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'merchant_company_id' })
  merchant_company?: Company;

  @ManyToOne(() => CashRegister, (cr) => cr.transactions, {
    onDelete: 'RESTRICT',
    nullable: true,
  })
  @JoinColumn({ name: 'cash_register_id' })
  cash_register?: CashRegister | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cashier_user_id' })
  cashier_user?: User;
}

