import { IsNotEmpty, IsNumber, IsPositive, IsString, IsUUID, IsOptional, MaxLength } from 'class-validator';

export class ChargeRequestDto {
  @IsUUID('4', { message: 'El clientId debe ser un UUID válido' })
  @IsNotEmpty({ message: 'El cliente es obligatorio' })
  client_id!: string;

  @IsUUID('4', { message: 'El merchantCompanyId debe ser un UUID válido' })
  @IsNotEmpty({ message: 'La empresa comercio es obligatoria' })
  merchant_company_id!: string;

  @IsUUID('4', { message: 'El cashRegisterId debe ser un UUID válido' })
  @IsNotEmpty({ message: 'La caja registradora es obligatoria' })
  cash_register_id!: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El monto debe tener máximo 2 decimales' })
  @IsPositive({ message: 'El monto a cobrar debe ser mayor a cero' })
  amount!: number;

  @IsString({ message: 'El número de factura externa debe ser texto' })
  @IsNotEmpty({ message: 'El número de factura del sistema ERP es obligatorio' })
  external_invoice_number!: string;

  @IsString({ message: 'La clave de idempotencia debe ser texto' })
  @IsNotEmpty({ message: 'La clave de idempotencia es obligatoria para evitar doble cobro' })
  idempotency_key!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4, { message: 'El PIN de autorización debe tener 4 dígitos' })
  pin?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

