import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './entities/transaction.entity';

@Injectable()
export class FinanceService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
  ) {}

  async getSummary() {
    const transactions = await this.transactionRepository.find({
      order: { createdAt: 'DESC' },
    });

    const totalIn = transactions
      .filter((t) => t.type === 'in')
      .reduce((acc, t) => acc + Number(t.value), 0);
    const totalOut = transactions
      .filter((t) => t.type === 'out')
      .reduce((acc, t) => acc + Number(t.value), 0);
    const balance = totalIn - totalOut;

    return { totalIn, totalOut, balance };
  }

  async getTransactions(skip = 0, take = 50) {
    const [data, total] = await this.transactionRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
    return data.map((t) => ({
      ...t,
      value: Number(t.value),
    }));
  }

  async create(dto: { description: string; value: number; type: 'in' | 'out' }) {
    const transaction = this.transactionRepository.create(dto);
    return this.transactionRepository.save(transaction);
  }
}
