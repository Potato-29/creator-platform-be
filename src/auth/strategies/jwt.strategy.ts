import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { Request } from 'express';
 
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // Extract from Authorization header (Bearer token)
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        // Extract from cookie
        (request: Request) => {
          return request?.cookies?.accessToken;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('server.jwt.secret'),
    });
  }
 
  async validate(payload: any) {
    // For backward compatibility, if type is not present, assume it's an access token
    // Only reject if explicitly marked as refresh token
    if (payload.type === 'refresh') {
      throw new UnauthorizedException('Cannot use refresh token for authentication');
    }
 
    const user = await this.authService.validateUser(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found or inactive');
    }
   
    // Return user without password and sensitive data
    const { password, resetToken, resetTokenExpiry, refreshToken, refreshTokenExpiry, ...userWithoutSensitiveData } = user;
    return userWithoutSensitiveData;
  }
}