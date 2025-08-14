import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Finance } from '../entities/finance.entity';
import { FinanceStatus } from 'src/entities/finance-status.enum';
import { FinanceHistoryService } from './finance-history.service';

@Injectable()
export class FinanceService {
  constructor(
    @InjectRepository(Finance)
    private readonly financeRepository: Repository<Finance>,
    private readonly financeHistoryService: FinanceHistoryService,
  ) {}

  async getTransaction(id?: number) {
    if (!id) return;
    return await this.financeRepository.findOneBy({ id });
  }

  async getPendingTransactions() {
    return await this.financeRepository.find({
      where: { status: FinanceStatus.CONFIRMED },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateTransaction(id?: number, data?: Partial<Finance>) {
    if (!id) return;
    return await this.financeRepository.update({ id }, { ...data });
  }

  async createPayment(data: {
    amount: number;
    userId?: number | null;
    createdBy?: number;
  }) {
    const { amount, userId, createdBy } = data;
    if (!amount) throw new Error('No amount');
    if (!userId || !createdBy) throw new Error('No recipient or creating user');
    try {
      const payment = this.financeRepository.create({
        userId,
        amount,
        remaining_amount: amount,
        createdBy,
        status: FinanceStatus.PENDING,
      });
      await this.financeRepository.save(payment);
      return payment;
    } catch (err: any) {
      console.error(err);
      throw new Error('internal_server_error');
    }
  }

  async exportFinanceCsv(): Promise<Buffer> {
    const transactions = await this.financeRepository.find({
      relations: ['user', 'creator'],
      order: { createdAt: 'DESC' },
    });

    const header = [
      'ID',
      'User ID',
      'User Login',
      'Created By',
      'Creator Login',
      'Amount',
      'Remaining',
      'Status',
      'Created At',
      'Updated At',
    ];

    const rows = transactions.map((tx) => [
      tx.id,
      tx.userId,
      tx.user?.login || '',
      tx.createdBy,
      tx.creator?.login || '',
      tx.amount,
      tx.remaining_amount,
      tx.status,
      tx.createdAt,
      tx.updatedAt,
    ]);

    const csvContent = [header, ...rows]
      .map((row) => row.join(','))
      .join('\n');

    return Buffer.from(csvContent, 'utf8');
  }

  async receiveAmountFromTransaction(
    transactionId: number,
    amount: number,
    receiverId?: number,
  ): Promise<Finance | null | undefined> {
    const tx = await this.getTransaction(transactionId);
    if (!tx) return null;

    if (tx.remaining_amount < amount) {
      throw new Error('Недостаточно средств в транзакции.');
    }

    tx.remaining_amount -= amount;

    if (tx.remaining_amount === 0) {
      tx.status = FinanceStatus.RECEIVED;
    }

    const updated = await this.updateTransaction(transactionId, {
      remaining_amount: tx.remaining_amount,
      status: tx.status,
    });

    if (!updated) throw new Error('Error with updating transaction');

    // ✅ Save finance history
    await this.financeHistoryService.addHistoryEntry(
      transactionId,
      amount,
      receiverId,
    );

    return this.getTransaction(tx.id);
  }
}
