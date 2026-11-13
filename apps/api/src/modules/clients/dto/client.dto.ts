import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';
import { CreditStatus } from '../../../common/enums';

export class CreateClientDto {
  @IsUUID('4', { message: 'ID de empresa empleadora inválido' })
  @IsNotEmpty()
  employer_company_id!: string;

  @IsString()
  @IsNotEmpty()
  employee_code!: string;

  @IsString()
  @IsNotEmpty()
  national_id!: string;

  @IsString()
  @IsNotEmpty()
  first_name!: string;

  @IsString()
  @IsNotEmpty()
  last_name!: string;

  @IsString()
  @IsNotEmpty()
  job_title!: string;

  @IsString()
  @IsOptional()
  grade_level?: string;

  @IsString()
  @IsOptional()
  classification?: string;

  @IsNumber()
  @IsOptional()
  salary?: number;

  @IsString()
  @IsNotEmpty()
  whatsapp_phone!: string;

  @IsString()
  @IsOptional()
  birth_date?: string;

  @IsNumber()
  @Min(0)
  approved_limit!: number;

  @IsEnum(CreditStatus)
  @IsOptional()
  credit_status?: CreditStatus;
}

export class UpdateClientStatusDto {
  @IsEnum(CreditStatus)
  @IsNotEmpty()
  credit_status!: CreditStatus;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}

