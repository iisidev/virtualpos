import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 100 })
  action!: string;

  @Index()
  @Column({ type: 'varchar', length: 100 })
  entity_type!: string;

  @Index()
  @Column({ type: 'varchar', length: 100 })
  entity_id!: string;

  @Column({ type: 'jsonb', nullable: true })
  previous_data?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  new_data?: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  performed_by_user_id?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  ip_address?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}

