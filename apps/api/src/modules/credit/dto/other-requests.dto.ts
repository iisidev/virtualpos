import { IsNotEmpty, IsNumber, IsPositive, IsString, IsUUID, IsOptional } from 'class-validator';

export class PaymentRequestDto {
  @IsUUID('4', { message: 'El clientId debe ser un UUID válido' })
  @IsNotEmpty({ message: 'El cliente es obligatorio' })
  client_id!: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El monto de abono debe tener máximo 2 decimales' })
  @IsPositive({ message: 'El monto de abono debe ser positivo' })
  amount!: number;

  @IsString({ message: 'La referencia o recibo de abono es obligatoria' })
  @IsNotEmpty({ message: 'El recibo de nómina o comprobante de abono es obligatorio' })
  reference_number!: string;

  @IsString()
  @IsNotEmpty({ message: 'La clave de idempotencia es obligatoria' })
  idempotency_key!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class VoidRequestDto {
  @IsString({ message: 'El motivo de anulación es obligatorio' })
  @IsNotEmpty({ message: 'Debe especificar el motivo legal/operativo de la anulación' })
  void_reason!: string;
}

export class AdjustLimitDto {
  @IsUUID('4', { message: 'El clientId debe ser un UUID válido' })
  @IsNotEmpty({ message: 'El cliente es obligatorio' })
  client_id!: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El nuevo límite debe ser un número con máx 2 decimales' })
  @IsPositive({ message: 'El nuevo límite debe ser mayor a cero' })
  new_limit!: number;

  @IsString()
  @IsNotEmpty({ message: 'Debe justificar el motivo del cambio de límite' })
  reason!: string;
}
