import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../../common/enums';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre de usuario es requerido' })
  @MinLength(3, { message: 'El usuario debe tener al menos 3 caracteres' })
  username!: string;

  @IsString()
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password!: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre completo es requerido' })
  full_name!: string;

  @IsEnum(UserRole, { message: 'Rol de usuario inválido' })
  @IsNotEmpty({ message: 'El rol es requerido' })
  role!: UserRole;

  @IsUUID('4', { message: 'ID de empresa inválido' })
  @IsOptional()
  company_id?: string | null;

  @IsOptional()
  is_active?: boolean;
}

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  @MinLength(3)
  username?: string;

  @IsString()
  @IsOptional()
  @MinLength(6)
  password?: string;

  @IsString()
  @IsOptional()
  full_name?: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @IsUUID('4')
  @IsOptional()
  company_id?: string | null;

  @IsOptional()
  is_active?: boolean;
}
