import { IsString, MinLength } from "class-validator";

export class DeactivateUserDto {
    @IsString()
    @MinLength(5, { message: 'Password must be at least 6 characters long' })
    password: string;
  }