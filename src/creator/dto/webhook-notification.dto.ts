import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class WebhookNotificationDto {
    @IsNotEmpty()
    @IsString()
    uid: string;

    @IsNotEmpty()
    @IsString()
    type: string;

    @IsNotEmpty()
    @IsNumber()
    created: number;

    @IsNotEmpty()
    @IsString()
    object_uid: string;

    @IsNotEmpty()
    @IsString()
    object_type: string;

    @IsNotEmpty()
    @IsString()
    object_url: string;

    @IsOptional()
    @IsString()
    verification_hash?: string;

    @IsOptional()
    @IsString()
    parent_uid?: string;

    @IsOptional()
    @IsString()
    parent_type?: string;

    @IsOptional()
    @IsString()
    parent_url?: string;
}