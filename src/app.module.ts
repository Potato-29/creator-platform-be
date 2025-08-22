import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from './prisma/prisma.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AuthMiddleware } from './middleware/auth.middleware';
import serverConfig from './config/server.config';
import { CreatorModule } from './creator/creator.module';

@Module({
  imports: [UsersModule, AuthModule, CreatorModule, ConfigModule.forRoot({
    isGlobal: true, // Makes ConfigService available globally
    envFilePath: '.env', // Optional: specify a particular .env file
    load: [serverConfig],
  }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET_KEY'),
        signOptions: { expiresIn: '1d' },
      }),
      inject: [ConfigService],
    }),
    PrismaModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .exclude(
        {path: 'creator/onboard/notify', method: RequestMethod.POST},
        {path: 'creator/onboard/return', method: RequestMethod.POST},
        {path: 'auth/*', method: RequestMethod.ALL},
     )
      .forRoutes(
        { path: 'users/*', method: RequestMethod.ALL },
        { path: 'creator/*', method: RequestMethod.ALL }
      );
  }
}
