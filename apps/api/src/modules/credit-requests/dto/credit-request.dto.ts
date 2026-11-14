import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateCreditRequestDto {
  @IsUUID('4', { message: 'ID de cliente inválido' })
  @IsNotEmpty({ message: 'El cliente es obligatorio' })
  client_id!: string;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El límite solicitado debe ser un número con máximo 2 decimales' },
  )
  @IsPositive({ message: 'El límite solicitado debe ser mayor a cero' })
  requested_limit!: number;

  @IsString({ message: 'El motivo de la solicitud es obligatorio' })
  @IsNotEmpty({ message: 'Debe ingresar el motivo o justificación de la solicitud' })
  reason!: string;
}

export class ReviewCreditRequestDto {
  @IsIn(['APPROVE', 'REJECT'], { message: 'La acción debe ser APPROVE o REJECT' })
  @IsNotEmpty({ message: 'La acción es obligatoria' })
  action!: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsString()
  review_notes?: string;

  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El límite aprobado debe ser un número con máximo 2 decimales' },
  )
  @IsPositive({ message: 'El límite aprobado debe ser mayor a cero' })
  approved_limit?: number;
}

