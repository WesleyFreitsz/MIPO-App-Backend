import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  ForbiddenException,
  Req,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FinanceService } from './finance.service';
import { UserRole } from 'src/users/entities/user.entity';

@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('summary')
  async getSummary(@Req() req: any) {
    if (req?.user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Apenas administradores podem ver o resumo financeiro.');
    }
    return this.financeService.getSummary();
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('transactions')
  async getTransactions(
    @Req() req: any,
    @Query('skip') skip = 0,
    @Query('take') take = 50,
  ) {
    if (req?.user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Apenas administradores podem ver transações.');
    }
    return this.financeService.getTransactions(Number(skip), Number(take));
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('transactions')
  async create(
    @Body() dto: { description: string; value: number; type: 'in' | 'out' },
    @Req() req: any,
  ) {
    if (req?.user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Apenas administradores podem registrar transações.');
    }
    return this.financeService.create(dto);
  }
}
