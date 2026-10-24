import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@Injectable()
export class FinanceService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
  ) {}

  async getSummary() {
    const totals = await this.transactionRepository
      .createQueryBuilder('t')
      .select('t.type', 'type')
      .addSelect('COALESCE(SUM(t.value), 0)', 'total')
      .groupBy('t.type')
      .getRawMany<{ type: 'in' | 'out'; total: string }>();

    const totalIn = Number(totals.find((t) => t.type === 'in')?.total ?? 0);
    const totalOut = Number(totals.find((t) => t.type === 'out')?.total ?? 0);
    const balance = totalIn - totalOut;

    return { totalIn, totalOut, balance };
  }

  async getTransactions(skip = 0, take = 50) {
    const data = await this.transactionRepository.find({
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
    return data.map((t) => ({
      ...t,
      value: Number(t.value),
    }));
  }

  async create(dto: CreateTransactionDto) {
    const transaction = this.transactionRepository.create({
      description: dto.description,
      value: dto.value,
      type: dto.type,
    });
    return this.transactionRepository.save(transaction);
  }
}
