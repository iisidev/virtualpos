import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { CompanyStatus } from '../../../common/enums';

export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty({ message: 'El código de empresa es requerido' })
  code!: string;

  @IsString()
  @IsNotEmpty({ message: 'La razón social / nombre es requerida' })
  name!: string;

  @IsString()
  @IsNotEmpty({ message: 'El RUC es requerido' })
  ruc!: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsBoolean()
  @IsOptional()
  is_employer?: boolean;

  @IsBoolean()
  @IsOptional()
  is_merchant?: boolean;

  @IsEnum(CompanyStatus)
  @IsOptional()
  status?: CompanyStatus;
}

export class UpdateCompanyDto {
  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  ruc?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsBoolean()
  @IsOptional()
  is_employer?: boolean;

  @IsBoolean()
  @IsOptional()
  is_merchant?: boolean;

  @IsEnum(CompanyStatus)
  @IsOptional()
  status?: CompanyStatus;
}
