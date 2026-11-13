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
import { CashRegisterStatus } from '../../common/enums';
import { Company } from './company.entity';
import { CreditTransaction } from './credit-transaction.entity';

@Entity('cash_registers')
export class CashRegister {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  company_id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50, unique: true })
  terminal_code!: string;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  location!: string;

  @Column({
    type: 'enum',
    enum: CashRegisterStatus,
    default: CashRegisterStatus.CLOSED,
  })
  status!: CashRegisterStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  created_by?: string;

  @ManyToOne(() => Company, (c) => c.cash_registers, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company?: Company;

  @OneToMany(() => CreditTransaction, (tx) => tx.cash_register)
  transactions?: CreditTransaction[];
}
