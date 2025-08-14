import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FinanceHistory } from 'src/entities/finance-history.entity';

@Injectable()
export class FinanceHistoryService {
  constructor(
    @InjectRepository(FinanceHistory)
    private readonly historyRepository: Repository<FinanceHistory>,
  ) {}

  /**
   * Add a new finance history entry when amount is received.
   *
   * @param financeId - ID of the finance transaction
   * @param amount - amount received (partial or full)
   * @param userId - ID of the user who received the amount
   */
  async addHistoryEntry(
    financeId: number,
    amount: number,
    userId?: number,
  ): Promise<FinanceHistory> {
    if (!userId) throw new Error('user not found');
    const history = this.historyRepository.create({
      financeId,
      amount,
      createdBy: userId,
    });

    return this.historyRepository.save(history);
  }

  /**
   * Get all history entries for a specific transaction.
   *
   * @param financeId - ID of the finance transaction
   */
  async getHistoryByFinanceId(financeId: number): Promise<FinanceHistory[]> {
    return this.historyRepository.find({
      where: { financeId },
      order: { createdAt: 'DESC' },
      relations: ['creator'],
    });
  }

  /**
   * Get all history entries created by a specific user.
   */
  async getHistoryByUser(userId: number): Promise<FinanceHistory[]> {
    return this.historyRepository.find({
      where: { createdBy: userId },
      order: { createdAt: 'DESC' },
      relations: ['finance'],
    });
  }
}
