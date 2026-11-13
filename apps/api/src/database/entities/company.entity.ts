import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { CompanyStatus } from '../../common/enums';
import { CashRegister } from './cash-register.entity';
import { ClientCreditProfile } from './client-credit-profile.entity';
import { User } from './user.entity';

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50, unique: true })
  ruc!: string;

  @Column({ type: 'text', default: '' })
  address!: string;

  @Column({ type: 'varchar', length: 50, default: '' })
  phone!: string;

  @Column({ type: 'boolean', default: true })
  is_employer!: boolean;

  @Column({ type: 'boolean', default: false })
  is_merchant!: boolean;

  @Column({
    type: 'enum',
    enum: CompanyStatus,
    default: CompanyStatus.ACTIVE,
  })
  status!: CompanyStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  created_by?: string;

  @OneToMany(() => CashRegister, (cr) => cr.company)
  cash_registers?: CashRegister[];

  @OneToMany(() => ClientCreditProfile, (client) => client.employer_company)
  employees?: ClientCreditProfile[];

  @OneToMany(() => User, (user) => user.company)
  users?: User[];
}

