import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { Finance } from '../entities/finance.entity';
import { FinanceStatus } from 'src/entities/finance-status.enum';
import { FinanceHistoryService } from './finance-history.service';
import { formatDate } from 'src/utils';

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
      relations: ['creator', 'user'],
      order: { createdAt: 'DESC' },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Finance');

    worksheet.columns = [
      { header: 'Получатель', key: 'recipient', width: 25 },
      { header: 'Статус', key: 'status', width: 14 },
      { header: 'Кто отправил', key: 'sender', width: 25 },
      { header: 'Когда отправил', key: 'sentAt', width: 20 },
      { header: 'Сумма', key: 'amount', width: 12 },
      { header: 'Остаточная сумма', key: 'remaining', width: 18 },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2E2E2' },
      };
    });

    transactions.forEach((tx) => {
      worksheet.addRow({
        recipient: tx.user?.login,
        status: tx.status,
        sender: tx.creator?.login || '',
        sentAt: formatDate(tx.createdAt),
        amount: tx.amount,
        remaining: tx.remaining_amount,
      });
    });

    worksheet.getColumn('amount').numFmt = '#,##0.00';
    worksheet.getColumn('remaining').numFmt = '#,##0.00';

    worksheet.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
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
