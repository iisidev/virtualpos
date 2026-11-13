import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { CatalogCategory } from '../../../database/entities/catalog-item.entity';

export class CreateCatalogItemDto {
  @IsEnum(CatalogCategory, { message: 'Categoría de catálogo inválida' })
  @IsNotEmpty()
  category!: CatalogCategory;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  order_index?: number;
}

export class UpdateCatalogItemDto {
  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  order_index?: number;
}
