import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
 
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private prisma: PrismaService,
  ) {}
 
  async use(req: Request, res: Response, next: NextFunction) {
    try {
      const token = this.extractTokenFromHeader(req);
     
      if (!token) {
        throw new UnauthorizedException('No token provided');
      }
 
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('server.jwt.secret'),
      });
 
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub, isActive: true },
        select: {
          id: true,
          userName: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          gender: true
        },
      });
 
      if (!user) {
        throw new UnauthorizedException('Invalid token');
      }
 
      req['user'] = user;
      next();
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
 
  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) return undefined;
   
    const [,token] = authHeader.split(' ');
    return token;
  }
}