import { SetMetadata } from "@nestjs/common";

export const PUBLIC_DEC_KEY = 'isPublic';
export const Public = () => SetMetadata(PUBLIC_DEC_KEY, true);