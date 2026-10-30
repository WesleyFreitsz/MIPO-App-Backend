import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { FinancePeriodDto } from './dto/finance-period.dto';

export function toCsv(transactions: Transaction[]): string {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = transactions.map((t) =>
    [
      new Date(t.createdAt).toISOString().slice(0, 10),
      escape(t.description),
      t.type === 'in' ? 'entrada' : 'saida',
      Number(t.value).toFixed(2).replace('.', ','),
    ].join(';'),
  );
  return ['data;descricao;tipo;valor', ...lines].join('\n');
}

@Injectable()
export class FinanceService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
  ) {}

  private inPeriod(
    query: SelectQueryBuilder<Transaction>,
    { from, to }: FinancePeriodDto,
  ) {
    if (from) query.andWhere('t.createdAt >= :from', { from: new Date(from) });
    if (to) query.andWhere('t.createdAt <= :to', { to: new Date(to) });
    return query;
  }

  async getSummary(period: FinancePeriodDto = {}) {
    const totals = await this.inPeriod(
      this.transactionRepository
        .createQueryBuilder('t')
        .select('t.type', 'type')
        .addSelect('COALESCE(SUM(t.value), 0)', 'total')
        .groupBy('t.type'),
      period,
    ).getRawMany<{ type: 'in' | 'out'; total: string }>();

    const totalIn = Number(totals.find((t) => t.type === 'in')?.total ?? 0);
    const totalOut = Number(totals.find((t) => t.type === 'out')?.total ?? 0);
    const balance = totalIn - totalOut;

    return { totalIn, totalOut, balance };
  }

  async getMonthly(period: FinancePeriodDto = {}) {
    const rows = await this.inPeriod(
      this.transactionRepository
        .createQueryBuilder('t')
        .select("to_char(date_trunc('month', t.createdAt), 'YYYY-MM')", 'month')
        .addSelect('t.type', 'type')
        .addSelect('COALESCE(SUM(t.value), 0)', 'total')
        .groupBy('month')
        .addGroupBy('t.type')
        .orderBy('month', 'ASC'),
      period,
    ).getRawMany<{ month: string; type: 'in' | 'out'; total: string }>();

    const months = [...new Set(rows.map((r) => r.month))];
    return months.map((month) => ({
      month,
      totalIn: Number(
        rows.find((r) => r.month === month && r.type === 'in')?.total ?? 0,
      ),
      totalOut: Number(
        rows.find((r) => r.month === month && r.type === 'out')?.total ?? 0,
      ),
    }));
  }

  async getTransactions(skip = 0, take = 50, period: FinancePeriodDto = {}) {
    const data = await this.inPeriod(
      this.transactionRepository
        .createQueryBuilder('t')
        .orderBy('t.createdAt', 'DESC')
        .skip(skip)
        .take(take),
      period,
    ).getMany();
    return data.map((t) => ({
      ...t,
      value: Number(t.value),
    }));
  }

  async exportCsv(period: FinancePeriodDto = {}) {
    const data = await this.inPeriod(
      this.transactionRepository
        .createQueryBuilder('t')
        .orderBy('t.createdAt', 'ASC'),
      period,
    ).getMany();
    return toCsv(data);
  }

  async create(dto: CreateTransactionDto) {
    const transaction = this.transactionRepository.create({
      description: dto.description,
      value: dto.value,
      type: dto.type,
    });
    return this.transactionRepository.save(transaction);
  }

  async update(id: string, dto: UpdateTransactionDto) {
    const transaction = await this.transactionRepository.findOne({
      where: { id },
    });
    if (!transaction) throw new NotFoundException('Transação não encontrada');
    Object.assign(transaction, dto);
    return this.transactionRepository.save(transaction);
  }

  async remove(id: string) {
    const result = await this.transactionRepository.delete(id);
    if (!result.affected) {
      throw new NotFoundException('Transação não encontrada');
    }
    return { message: 'Transação apagada' };
  }
}
