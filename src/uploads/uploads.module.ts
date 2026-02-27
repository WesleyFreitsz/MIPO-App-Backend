import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadsController } from './uploads.controller';
import { Upload } from './entities/upload.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Upload])], 
  controllers: [UploadsController],
})
export class UploadsModule {}
