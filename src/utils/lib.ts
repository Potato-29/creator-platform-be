import { Response } from "express";
import { ACCESS_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY } from "src/auth/constants";

export function setTokenCookies(res: Response, accessToken: string, refreshToken?: string): void {
    const cookieOptions = {
        httpOnly: true,
        secure: true,
        //   secure: this.configService.get('server.nodeEnv') === 'production',
        sameSite: 'lax' as const,
    };

    res.cookie('accessToken', accessToken, {
        ...cookieOptions,
        maxAge: ACCESS_TOKEN_EXPIRY,
    });

    if (refreshToken) {
        res.cookie('refreshToken', refreshToken, {
            ...cookieOptions,
            maxAge: REFRESH_TOKEN_EXPIRY,
        });
    }
}