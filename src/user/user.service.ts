import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Not, Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Context } from 'telegraf';
import { Finance } from 'src/entities/finance.entity';
import { RoleEnum } from 'src/enums';
import { FinanceStatus } from 'src/entities/finance-status.enum';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Finance)
    private readonly financeRepository: Repository<Finance>,
  ) {}

  async getUserStats(userId?: number) {
    if (!userId) return;

    const userRole = (await this.getUserInfo(userId))?.role;
    if (!userRole) return;

    if (userRole === RoleEnum.ADMIN) {
      const completedTransactions = await this.financeRepository.find({
        where: { status: FinanceStatus.CONFIRMED },
        order: { createdAt: 'DESC' },
      });

      const totalAmount = completedTransactions.reduce(
        (sum, tx) => sum + tx.amount,
        0,
      );
      const totalUsers = await this.userRepository.count();

      return {
        totalTransactions: completedTransactions.length,
        totalAmount,
        lastTransactionAmount: completedTransactions[0]?.amount ?? null,
        lastTransactionDate: completedTransactions[0]?.createdAt ?? null,
        totalUsers,
      };
    }

    let transactions: any[] = [];

    if (userRole === RoleEnum.SENDER) {
      transactions = await this.financeRepository.find({
        where: { createdBy: userId },
        order: { createdAt: 'DESC' },
      });
    } else if (userRole === RoleEnum.RECEIVER || userRole === RoleEnum.USER) {
      transactions = await this.financeRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' },
      });
    }

    if (!transactions.length) return null;

    return {
      totalTransactions: transactions.length,
      totalAmount: transactions.reduce(
        (sum, tx) => Number(sum) + Number(tx.amount),
        0,
      ),
      lastTransactionDate: transactions[0].createdAt,
    };
  }

  async searchUser(message: string, id?: number) {
    if (!message || !id) {
      throw new Error('❌ Сообщение пустое.');
    }

    const searchQuery = message.replace('/search ', '').trim();
    if (!searchQuery) {
      throw new Error('❌ Введите логин, username или телефон для поиска.');
    }

    const users = await this.userRepository.find({
      where: [
        { login: Like(`%${searchQuery}%`), id: Not(id) },
        { username: Like(`%${searchQuery}%`), id: Not(id) },
        { phone: Like(`%${searchQuery}%`), id: Not(id) },
      ],
      take: 10,
    });

    if (!users.length) {
      throw new Error('❌ Пользователь не найден.');
    }
    return users;
  }

  async getUserInfo(id?: number | null) {
    if (!id) return;
    return await this.userRepository.findOneBy({ id });
  }

  async saveUserData(ctx: Context, data?: Partial<User>) {
    const {
      id: userId,
      username,
      first_name,
      last_name,
      is_premium,
      is_bot,
      language_code,
    } = ctx.from || {};
    if (!userId) return;
    const user = await this.userRepository.findOneBy({ id: userId });
    const fullName = `${last_name || ''} ${first_name || ''}`.trim();
    if (!user) {
      const createdUser = this.userRepository.create({
        id: userId,
        ...data,
        username,
        fullName: fullName,
        isPremium: is_premium,
        isBot: is_bot,
        language: language_code,
      });
      await this.userRepository.save(createdUser);
    } else {
      await this.userRepository.update(
        { id: userId },
        {
          ...data,
          username,
          fullName: fullName,
          isPremium: is_premium,
          isBot: is_bot,
          language: language_code,
        },
      );
    }
  }
}
