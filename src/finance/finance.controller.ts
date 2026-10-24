import { Controller, Get, Post, Body, UseGuards, Query } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { UserRole } from 'src/users/entities/user.entity';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@Controller('finance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('summary')
  async getSummary() {
    return this.financeService.getSummary();
  }

  @Get('transactions')
  async getTransactions(@Query() pagination: PaginationQueryDto) {
    return this.financeService.getTransactions(
      pagination.skip,
      pagination.take,
    );
  }

  @Post('transactions')
  async create(@Body() dto: CreateTransactionDto) {
    return this.financeService.create(dto);
  }
}
