import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { IncreaseRequestStatus, ChannelType } from '../../common/enums';
import { ClientCreditProfile } from './client-credit-profile.entity';
import { User } from './user.entity';

@Entity('credit_increase_requests')
export class CreditIncreaseRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  client_id!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  current_limit!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  requested_limit!: string;

  @Column({ type: 'text' })
  reason!: string;

  @Column({
    type: 'enum',
    enum: ChannelType,
    default: ChannelType.WHATSAPP_BOT,
  })
  channel!: ChannelType;

  @Column({
    type: 'enum',
    enum: IncreaseRequestStatus,
    default: IncreaseRequestStatus.PENDING,
  })
  status!: IncreaseRequestStatus;

  @Column({ type: 'uuid', nullable: true })
  reviewed_by?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewed_at?: Date | null;

  @Column({ type: 'text', nullable: true })
  review_notes?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @ManyToOne(() => ClientCreditProfile, (c) => c.increase_requests, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client?: ClientCreditProfile;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by' })
  reviewer?: User | null;
}
