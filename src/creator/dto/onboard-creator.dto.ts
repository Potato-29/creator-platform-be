import { ApiProperty } from "@nestjs/swagger";
import { CREATOR_ONBOARDING_STATUS } from "@prisma/client";
import { IsOptional, IsString } from "class-validator";

export class OnboardCreatorDto {
  @IsOptional()
  @IsString()
  cocNr: string;
}

export class OnboardResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty({ enum: CREATOR_ONBOARDING_STATUS })
  status: CREATOR_ONBOARDING_STATUS;

  @ApiProperty()
  message: string;

  @ApiProperty({ required: false })
  nextStep?: string;

  @ApiProperty({ required: false })
  redirectUrl?: string;
}