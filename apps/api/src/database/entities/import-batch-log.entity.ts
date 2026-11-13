import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ImportType } from '../../common/enums';
import { User } from './user.entity';

@Entity('import_batch_logs')
export class ImportBatchLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  file_name!: string;

  @Column({
    type: 'enum',
    enum: ImportType,
    default: ImportType.CLIENTS,
  })
  import_type!: ImportType;

  @Column({ type: 'int', default: 0 })
  total_rows!: number;

  @Column({ type: 'int', default: 0 })
  successful_rows!: number;

  @Column({ type: 'int', default: 0 })
  error_rows!: number;

  @Column({ type: 'jsonb', nullable: true })
  errors_summary?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  diff_summary?: string | null;

  @Index()
  @Column({ type: 'uuid' })
  executed_by_user_id!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'executed_by_user_id' })
  executed_by?: User;
}
