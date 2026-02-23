import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '../users/entities/user.entity';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(AuthGuard('jwt'))
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  create(@Request() req, @Body() body: any) {
    return this.reportsService.createReport(req.user.userId, body);
  }

  @Get()
  findAll(@Request() req) {
    if (req.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Apenas admins podem ver denúncias.');
    }
    return this.reportsService.findAll();
  }

  @Patch(':id/dismiss')
  dismiss(@Request() req, @Param('id') id: string) {
    if (req.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Apenas admins podem gerenciar denúncias.');
    }
    return this.reportsService.dismiss(id);
  }
}
