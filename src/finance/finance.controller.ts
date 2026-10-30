import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Query,
  Patch,
  Delete,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FinanceService } from './finance.service';
import { UserRole } from 'src/users/entities/user.entity';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import {
  FinancePeriodDto,
  FinanceTransactionsQueryDto,
} from './dto/finance-period.dto';

@Controller('finance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('summary')
  async getSummary(@Query() period: FinancePeriodDto) {
    return this.financeService.getSummary(period);
  }

  @Get('monthly')
  async getMonthly(@Query() period: FinancePeriodDto) {
    return this.financeService.getMonthly(period);
  }

  @Get('export')
  async exportCsv(@Query() period: FinancePeriodDto) {
    return { csv: await this.financeService.exportCsv(period) };
  }

  @Get('transactions')
  async getTransactions(@Query() query: FinanceTransactionsQueryDto) {
    return this.financeService.getTransactions(query.skip, query.take, query);
  }

  @Post('transactions')
  async create(@Body() dto: CreateTransactionDto) {
    return this.financeService.create(dto);
  }

  @Patch('transactions/:id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.financeService.update(id, dto);
  }

  @Delete('transactions/:id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.financeService.remove(id);
  }
}
