import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from 'src/auth/authenticated-user.interface';
import { UserRole } from 'src/users/entities/user.entity';
import { CreateReportDto } from './dto/create-report.dto';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReportDto) {
    return this.reportsService.createReport(user.userId, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  findAll() {
    return this.reportsService.findAll();
  }

  @Patch(':id/dismiss')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  dismiss(@Param('id', ParseUUIDPipe) id: string) {
    return this.reportsService.dismiss(id);
  }

  @Patch(':id/remove-post')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  removePost(@Param('id', ParseUUIDPipe) id: string) {
    return this.reportsService.removePost(id);
  }

  @Patch(':id/remove-chat-message')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  removeChatMessage(@Param('id', ParseUUIDPipe) id: string) {
    return this.reportsService.removeChatMessage(id);
  }

  @Patch(':id/ban-user')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  banReportedUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.reportsService.banReportedUser(id);
  }
}
