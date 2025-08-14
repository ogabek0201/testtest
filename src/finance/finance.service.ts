import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
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

  async exportFinanceXlsx(): Promise<Buffer> {
    const transactions = await this.financeRepository.find({
      relations: ['user', 'creator'],
      order: { createdAt: 'DESC' },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Finance');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'User ID', key: 'userId', width: 10 },
      { header: 'User Login', key: 'userLogin', width: 20 },
      { header: 'Created By', key: 'createdBy', width: 12 },
      { header: 'Creator Login', key: 'creatorLogin', width: 20 },
      { header: 'Amount', key: 'amount', width: 12 },
      { header: 'Remaining', key: 'remaining', width: 12 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Created At', key: 'createdAt', width: 20 },
      { header: 'Updated At', key: 'updatedAt', width: 20 },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    transactions.forEach((tx) => {
      worksheet.addRow({
        id: tx.id,
        userId: tx.userId,
        userLogin: tx.user?.login || '',
        createdBy: tx.createdBy,
        creatorLogin: tx.creator?.login || '',
        amount: tx.amount,
        remaining: tx.remaining_amount,
        status: tx.status,
        createdAt: tx.createdAt,
        updatedAt: tx.updatedAt,
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
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
