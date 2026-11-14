import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { CashRegisterStatus } from '../../../common/enums';

export class CreateCashRegisterDto {
  @IsUUID('4', { message: 'ID de empresa comercio inválido' })
  @IsNotEmpty({ message: 'La empresa asociada es requerida' })
  company_id!: string;

  @IsString()
  @IsNotEmpty({ message: 'El código de terminal es requerido' })
  terminal_code!: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre de caja es requerido' })
  name!: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsEnum(CashRegisterStatus, { message: 'Estado de caja inválido' })
  @IsOptional()
  status?: CashRegisterStatus;
}

export class UpdateCashRegisterDto {
  @IsUUID('4', { message: 'ID de empresa comercio inválido' })
  @IsOptional()
  company_id?: string;

  @IsString()
  @IsOptional()
  terminal_code?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsEnum(CashRegisterStatus, { message: 'Estado de caja inválido' })
  @IsOptional()
  status?: CashRegisterStatus;
}

export class UpdateCashRegisterStatusDto {
  @IsEnum(CashRegisterStatus, { message: 'Estado de caja inválido (OPEN, CLOSED o SUSPENDED)' })
  @IsNotEmpty({ message: 'El nuevo estado es requerido' })
  status!: CashRegisterStatus;
}

