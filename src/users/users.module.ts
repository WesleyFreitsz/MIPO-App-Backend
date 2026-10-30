import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller'; // Adicionado
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { AccountDataService } from './account-data.service';
import { UploadsModule } from 'src/uploads/uploads.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), UploadsModule],
  controllers: [UsersController], // Adicionado
  providers: [UsersService, AccountDataService],
  exports: [UsersService, AccountDataService],
})
export class UsersModule {}
