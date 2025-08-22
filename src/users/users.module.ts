import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { OppService } from 'src/creator/opp/opp.service';
import { HttpModule } from '@nestjs/axios';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [HttpModule, MailModule],
  controllers: [UsersController],
  providers: [UsersService, PrismaService, OppService],
  exports: [UsersService],
})
export class UsersModule {}
