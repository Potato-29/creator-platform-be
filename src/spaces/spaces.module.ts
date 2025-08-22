import { Module } from '@nestjs/common';
import { SpacesService } from './spaces.service';

@Module({
  providers: [SpacesService],
  exports: [SpacesService],
})
export class SpacesModule {}