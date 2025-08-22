import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CreatorService } from './creator.service';
import { CreatorController } from './creator.controller';
import { OppService } from './opp/opp.service';
import { MailModule } from 'src/mail/mail.module';
import { UsersService } from 'src/users/users.service';

@Module({
  imports: [HttpModule, MailModule],
  controllers: [CreatorController],
  providers: [CreatorService, OppService, UsersService],
  exports: [CreatorService, OppService],
})
export class CreatorModule {} 