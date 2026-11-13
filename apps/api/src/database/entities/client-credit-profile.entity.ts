import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { CreditStatus } from '../../common/enums';
import { Company } from './company.entity';
import { CreditTransaction } from './credit-transaction.entity';
import { CreditIncreaseRequest } from './credit-increase-request.entity';

@Entity('client_credit_profiles')
@Index('idx_client_composite_search', ['national_id', 'employee_code', 'whatsapp_phone'])
export class ClientCreditProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  employer_company_id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50, unique: true })
  employee_code!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50, unique: true })
  national_id!: string;

  @Column({ type: 'varchar', length: 150 })
  first_name!: string;

  @Column({ type: 'varchar', length: 150 })
  last_name!: string;

  @Column({ type: 'varchar', length: 150, default: 'EMPLEADO' })
  job_title!: string;

  @Column({ type: 'varchar', length: 50, default: 'NIVEL-1' })
  grade_level!: string;

  @Column({ type: 'varchar', length: 50, default: 'PLANTA' })
  classification!: string;

  @Column({ type: 'text', nullable: true })
  salary_encrypted?: string | null;

  @Index()
  @Column({ type: 'varchar', length: 30 })
  whatsapp_phone!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  pin_hash?: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  birth_date?: string | null; // Format: YYYY-MM-DD for WhatsApp identity verification

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.0 })
  approved_limit!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.0 })
  used_balance!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.0 })
  available_balance!: string;

  @Column({
    type: 'enum',
    enum: CreditStatus,
    default: CreditStatus.ACTIVE,
  })
  credit_status!: CreditStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  created_by?: string;

  @ManyToOne(() => Company, (c) => c.employees, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'employer_company_id' })
  employer_company?: Company;

  @OneToMany(() => CreditTransaction, (tx) => tx.client)
  transactions?: CreditTransaction[];

  @OneToMany(() => CreditIncreaseRequest, (req) => req.client)
  increase_requests?: CreditIncreaseRequest[];
}

