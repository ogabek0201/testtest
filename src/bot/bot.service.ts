import { Injectable } from '@nestjs/common';
import { Context, Markup } from 'telegraf';
import { WizardScene, Stage } from 'telegraf/scenes';
import { UserService } from '../user/user.service';
import { RoleEnum } from 'src/enums';
import { BotContext } from 'src/types';
import { commands } from 'src/config';
import { FinanceService } from 'src/finance/finance.service';
import { deleteMessageWithDelay, formatDate } from 'src/utils';
import { Finance } from 'src/entities/finance.entity';
import { FinanceStatus } from 'src/entities/finance-status.enum';

@Injectable()
export class BotService {
  constructor(
    private readonly userService: UserService,
    private readonly financeService: FinanceService,
  ) {}

  async start(ctx: Context) {
    const firstName = ctx.from?.first_name || 'Пользователь';
    const telegramId = ctx.from?.id;

    const user = await this.userService.getUserInfo(telegramId);

    if (user && user.isRegistered) {
      await ctx.reply(
        `👋 Привет снова, ${firstName}!\n` +
          `Рады видеть вас снова. Вы уже зарегистрированы ✅`,
      );
    } else {
      await ctx.reply(
        `👋 Привет, ${firstName}!\n\n` +
          `Добро пожаловать в наш бот.\n` +
          `Пожалуйста, завершите регистрацию, чтобы пользоваться всеми функциями.`,
      );

      // Only save if user does not exist
      if (!user) {
        await this.userService.saveUserData(ctx); // default role USER
      }
    }

    await this.showMenu(ctx);
  }

  async showMenu(ctx: Context) {
    const user = await this.userService.getUserInfo(ctx.from?.id);
    if (!user) return;

    const buttons = [[commands.stat]];

    switch (user.role) {
      case RoleEnum.USER:
        if (!user.isRegistered) {
          buttons[0].unshift(commands.registration); // show only if not registered
        }
        break;
      case RoleEnum.SENDER:
        buttons[0].push(commands.search);
        break;
      case RoleEnum.RECEIVER:
        buttons[0].push(commands.receive_money);
        break;
      case RoleEnum.ADMIN:
        buttons.push([commands.search, commands.admin]);
        break;
    }

    buttons.push([commands.settings]);

    await ctx.reply('Выберите действие:', Markup.keyboard(buttons).resize());
  }

  async getStatistics(ctx: Context) {
    const stats = await this.userService.getUserStats(ctx?.from?.id);
    if (!stats) {
      await ctx.reply('❌ У вас пока нет платежей.');
      return;
    }

    let message = '📊 Статистика\n\n';

    message += `🔹 Количество платежей: ${stats.totalTransactions} \n`;
    message += `💰 Общая сумма: ${stats.totalAmount}$\n`;

    if ('totalUsers' in stats) {
      // This means the user is an Admin
      message += `👥 Всего пользователей: ${stats.totalUsers}\n`;
      message += `📅 Последний платёж: ${stats.lastTransactionDate ? formatDate(stats.lastTransactionDate) : 'Нет данных'}\n`;
      message += `💳 Сумма последнего платежа: ${stats.lastTransactionAmount}$`;
    } else {
      // Sender, Receiver, or User
      message += `📅 Последний платёж: ${stats.lastTransactionDate ? formatDate(stats.lastTransactionDate) : 'Нет данных'}`;
    }

    await ctx.reply(message);
  }

  registerWizard(): WizardScene<BotContext> {
    return new WizardScene<BotContext>(
      'REGISTER_WIZARD',
      async (ctx) => {
        const sentMessage = await ctx.reply(
          '📝 Введите ваш логин (например: user123):',
        );
        (ctx.wizard.state as any).lastBotMessageId = sentMessage.message_id;
        return ctx.wizard.next();
      },
      async (ctx) => {
        if (!ctx.message || !('text' in ctx.message)) {
          await ctx.reply('❌ Ошибка! Пожалуйста, введите текст.');
          return;
        }

        const userInput = ctx.message.text.trim();

        // ✅ Check if the input is a reserved command or button text
        if (['/start', Object.values(commands).join(',')].includes(userInput)) {
          await ctx.reply('❌ Некорректный логин. Введите другое имя.');
          return;
        }

        // ✅ Delete user input message
        await ctx.deleteMessage(ctx.message.message_id).catch(() => {});

        (ctx.wizard.state as any).login = userInput;
        const sentMessage = await ctx.reply(
          '📱 Введите ваш номер телефона или отправьте его с кнопкой:',
          {
            reply_markup: {
              keyboard: [
                [{ text: '📱 Отправить номер', request_contact: true }],
              ],
              resize_keyboard: true,
              one_time_keyboard: true,
            },
          },
        );

        (ctx.wizard.state as any).lastBotMessageId = sentMessage.message_id; // Store bot message ID
        return ctx.wizard.next();
      },
      async (ctx) => {
        if (!ctx.message) {
          await ctx.reply('❌ Ошибка! Пожалуйста, отправьте номер.');
          return;
        }

        let phoneNumber: string | undefined;
        if ('contact' in ctx.message) {
          phoneNumber = ctx.message.contact.phone_number;
        } else if ('text' in ctx.message) {
          phoneNumber = ctx.message.text;
        } else {
          await ctx.reply(
            '❌ Ошибка! Пожалуйста, отправьте номер вручную или через кнопку.',
          );
          return;
        }

        // ✅ Delete user phone number input message
        await ctx.deleteMessage(ctx.message.message_id).catch(() => {});

        (ctx.wizard.state as any).phone = phoneNumber;
        await this.userService.saveUserData(ctx, {
          phone: (ctx.wizard.state as any).phone,
          login: (ctx.wizard.state as any).login,
          isRegistered: true,
        });

        // ✅ Delete the last bot message before confirming registration
        if ((ctx.wizard.state as any).lastBotMessageId) {
          await ctx
            .deleteMessage((ctx.wizard.state as any).lastBotMessageId)
            .catch(() => {});
        }

        await ctx.reply('✅ Регистрация завершена!');

        // ✅ Show the menu after registration
        await this.showMenu(ctx);

        return ctx.scene.leave();
      },
    );
  }

  setupScenes(): Stage<BotContext> {
    const registerScene = this.registerWizard();
    const stage = new Stage<BotContext>([registerScene]);

    return stage;
  }

  async validateTransaction(
    ctx: BotContext,
    previousAmount: number | null,
    inlineMessage: string,
    recipient?: number | null,
  ) {
    const amount = Number(inlineMessage);
    if (Number(previousAmount) !== Number(inlineMessage)) {
      await ctx.reply('❌ Суммы не совпадают. Попробуйте еще раз');
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      await ctx.reply('❌ Некорректная сумма. Попробуйте снова.');
      return;
    }
    if (!recipient) {
      await ctx.reply('❌ Получатель не найден');
      return;
    }
    return true;
  }

  async createTransaction(
    ctx: BotContext,
    previousAmount: number | null,
    inlineMessage: string,
    recipient?: number | null,
  ) {
    const result = await this.validateTransaction(
      ctx,
      previousAmount,
      inlineMessage,
      recipient,
    );
    if (!result) return;

    try {
      const user = await this.userService.getUserInfo(ctx?.from?.id);
      const data = {
        amount: Number(inlineMessage),
        userId: recipient,
        createdBy: user?.id,
      };
      const result = await this.financeService.createPayment(data);
      if (!result) {
        await ctx.reply('❌ Произошла ошибка попробуйте позже');
      }
      const recipientUser = await this.userService.getUserInfo(recipient);
      const messageId = await ctx.reply(
        `✅ Вы успешно отправили ${inlineMessage}$ пользователю${recipient ? ' ' + recipientUser?.login : '.'}`,
      );
      deleteMessageWithDelay(ctx, messageId);
      return result;
    } catch (err) {
      if (err.message !== 'internal_server_error') {
        await ctx.reply(err.message);
      } else {
        await ctx.reply('❌ Произошла ошибка попробуйте позже');
      }
    }
  }

  async sendPaymentNotification(
    ctx: BotContext,
    transaction?: Finance,
    recipient?: number | null,
    amount?: number,
  ) {
    if (!transaction || !recipient || !amount) return;
    await ctx.telegram.sendMessage(
      recipient,
      `💰 Вы получили ${amount}$. Вы подтверждаете транзакцию?`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '✅ Да',
            `payment_confirmation_yes_${transaction.id}`,
          ),
          Markup.button.callback(
            '❌ Нет',
            `payment_confirmation_no_${transaction.id}`,
          ),
        ],
      ]),
    );
  }

  async sendNotification(ctx: BotContext, recipient, message) {
    await ctx.telegram.sendMessage(recipient, message);
  }

  async getPendingTransactions(): Promise<Finance[]> {
    return this.financeService.getPendingTransactions();
  }

  async getTransactionDetailsById(
    id: number,
  ): Promise<Finance | null | undefined> {
    return this.financeService.getTransaction(id);
  }

  async confirmTransactionReceive(
    ctx: BotContext,
    transactionId: number,
    amount: number,
  ) {
    const tx = await this.getTransactionDetailsById(transactionId); // updated method name
    if (!tx) {
      await ctx.reply('❌ Транзакция не найдена.');
      return;
    }

    if (tx.remaining_amount < amount) {
      await ctx.reply('❌ Недостаточно средств в транзакции.');
      return;
    }

    const updatedTx = await this.financeService.receiveAmountFromTransaction(
      transactionId,
      amount,
      ctx.from?.id,
    );

    if (!updatedTx) {
      await ctx.reply('❌ Произошла ошибка при обновлении транзакции.');
      return;
    }

    return updatedTx;
  }

  async changeTransactionStatus(
    ctx: Context,
    transactionId: number,
    status: FinanceStatus,
  ) {
    const transactionFound =
      await this.financeService.getTransaction(transactionId);

    if (!transactionFound) {
      await ctx.reply('No transaction found');
    }
    await this.financeService.updateTransaction(transactionId, { status });
  }
}
