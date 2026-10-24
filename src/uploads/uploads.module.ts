import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { ObjectStorageService } from './object-storage.service';
import { Upload } from './entities/upload.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Upload])],
  controllers: [UploadsController],
  providers: [UploadsService, ObjectStorageService],
})
export class UploadsModule {}
