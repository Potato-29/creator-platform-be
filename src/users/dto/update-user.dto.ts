import { IsOptional, IsString, IsEmail, IsEnum, IsDateString, Length } from 'class-validator';
import { Transform } from 'class-transformer';
import { Gender, Role } from '@prisma/client';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(3, 30)
  @Transform(({ value }) => value?.trim().toLowerCase())
  userName?: string;

  @IsOptional()
  @IsString()
  @Length(2, 50)
  @Transform(({ value }) => value?.trim())
  firstName?: string;

  @IsOptional()
  @IsString()
  @Length(2, 50)
  @Transform(({ value }) => value?.trim())
  lastName?: string;

  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => value?.trim().toLowerCase())
  email?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsString()
  profilePic?: string;

  @IsOptional()
  @IsString()
  bannerImage?: string;

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
  countryCode?: string;

  @IsOptional()
  @IsString()
  zip?: string;
}

export class UserProfileResponseDto {
  id: string;
  userName: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string | null;
  dateOfBirth: Date;
  gender: Gender;
  profilePic?: string | null;
  bannerImage?: string | null;
  role: Role;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  countryCode?: string | null;
  zip?: string | null;
  isActive: boolean;
  createdAt: Date;

  constructor(partial: Partial<UserProfileResponseDto>) {
    Object.assign(this, partial);
  }
}