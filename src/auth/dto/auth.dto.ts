import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from '../entities/user.entity';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

export enum SocialProvider {
  GOOGLE = 'google',
}

export class SocialLoginDto {
  @IsEnum(SocialProvider)
  provider: SocialProvider;

  @IsString()
  @MinLength(1)
  idToken: string;
}

export class RefreshTokenDto {
  @IsString()
  userId: string;

  @IsString()
  refreshToken: string;
}

export class RevokeTokenDto {
  @IsString()
  token: string;
}
