import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum CatalogCategory {
  JOB_TITLE = 'JOB_TITLE',
  GRADE_LEVEL = 'GRADE_LEVEL',
  CLASSIFICATION = 'CLASSIFICATION',
}

@Entity('catalog_items')
export class CatalogItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({
    type: 'enum',
    enum: CatalogCategory,
    default: CatalogCategory.JOB_TITLE,
  })
  category!: CatalogCategory;

  @Index()
  @Column({ type: 'varchar', length: 50 })
  code!: string;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({ type: 'int', default: 0 })
  order_index!: number;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
