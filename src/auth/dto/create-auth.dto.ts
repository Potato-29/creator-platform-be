import { Gender, Role } from '@prisma/client';
import { IsEmail, IsNotEmpty, IsString, IsEnum, IsOptional, MinLength, IsDateString, IsPhoneNumber, MaxLength } from 'class-validator';
import type { MulterFile } from 'multer';

export class SignUpDto {
    @IsNotEmpty()
    @IsString()
    userName: string;

    @IsNotEmpty()
    @IsString()
    firstName: string;

    @IsNotEmpty()
    @IsString()
    lastName: string;

    @IsNotEmpty()
    @IsDateString()
    dateOfBirth: string;

    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsOptional()
    @IsPhoneNumber()
    phoneNumber?: string;

    @IsNotEmpty()
    @IsEnum(Gender)
    gender: Gender;

    @IsNotEmpty()
    @IsString()
    @MinLength(6)
    password: string;

    @IsNotEmpty()
    @IsEnum(Role)
    role: Role;

    @IsOptional()
    @IsString()
    street?: string;

    @IsOptional()
    @IsString()
    city?: string;

    @IsOptional()
    @IsString()
    state?: string;

    @IsOptional()
    @IsString()
    @MaxLength(4)
    countryCode?: string;

    @IsOptional()
    @IsString()
    zip?: string;
}

export class SignupImageDto {
    @IsOptional()
    profilePic?: MulterFile[];

    @IsOptional()
    bannerImage?: MulterFile[];
}

export class SignInDto {
    @IsString()
    @IsNotEmpty()
    userNameOrEmail: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    password: string;
}

export class ForgotPasswordDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;
}

export class ResetPasswordDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    newPassword: string;
}

export class ChangePasswordDto {
    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    oldPassword: string;
  
    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    newPassword: string;
  }

export class RefreshTokenDto {
    @IsString()
    refreshToken: string;
}
