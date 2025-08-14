import { Injectable, OnModuleInit } from '@nestjs/common';
import { Action, Ctx, InjectBot } from 'nestjs-telegraf';
import { Context, Telegraf } from 'telegraf';

import { BotService } from './bot.service';
import { LogAction } from 'src/decorators';
import { answerAndDeleteLastMessage, deleteMessageWithDelay } from 'src/utils';
import { BotContext } from 'src/types';
import { FinanceStatus } from 'src/entities/finance-status.enum';

@Injectable()
export class BotActions implements OnModuleInit {
  mode = '';
  constructor(
    @InjectBot() private readonly bot: Telegraf<BotContext>,
    private readonly botService: BotService,
  ) {}

  onModuleInit() {
    console.log('Registering manual handlers...');
    this.bot.action(/^send_money_(\d+)$/, async (ctx: BotContext) => {
      await this.onSendMoney(ctx);
    });
    this.bot.action(/^receive_tx_(\d+)$/, async (ctx: BotContext) => {
      const tx_id = Number(ctx?.match?.[1] || 0);
      await this.onReceiveMoney(ctx, tx_id);
    });
    this.bot.action('change_login', async (ctx: Context) => {
      await this.onChangeLogin(ctx as BotContext);
    });

    this.bot.action('change_phone', async (ctx: Context) => {
      await this.onChangePhone(ctx as BotContext);
    });
    this.bot.action(
      /^payment_confirmation_yes_(\d+)$/,
      async (ctx: Context) => {
        await this.onPaymentConfirm(ctx as BotContext, FinanceStatus.CONFIRMED);
        await ctx.reply('✅ Вы подтвердили транзакцию');
      },
    );
    this.bot.action(/^payment_confirmation_no_(\d+)$/, async (ctx: Context) => {
      await this.onPaymentConfirm(ctx as BotContext, FinanceStatus.CANCELED);
      await ctx.reply('Вы отклонили транзакцию');
    });
  }

  @Action(/^send_money_(\d+)$/)
  @LogAction('send_money')
  async onSendMoney(ctx: BotContext) {
    const userId = Number(ctx?.match?.[1]);
    ctx.session.waitingForPayment = userId;
    ctx.session.waitingFor = null;

    await ctx.answerCbQuery();
    await ctx.reply('💵 Введите сумму для отправки:');
  }

  @Action('change_login')
  @LogAction('callback_change_login')
  async onChangeLogin(@Ctx() ctx: BotContext) {
    await answerAndDeleteLastMessage(ctx);
    await ctx.reply('✏️ Введите новый логин:');
    ctx.session.waitingFor = 'login';
  }

  @Action('change_phone')
  @LogAction('callback_change_phone')
  async onChangePhone(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    await ctx.reply('📞 Введите новый номер телефона или отправьте контакт:', {
      reply_markup: {
        keyboard: [[{ text: '📱 Отправить номер', request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
    ctx.session.waitingFor = 'phone';
  }

  async onReceiveMoney(@Ctx() ctx: BotContext, tx_id: number) {
    await ctx.answerCbQuery();
    const callbackMessageId = ctx.callbackQuery?.message;
    deleteMessageWithDelay(ctx, callbackMessageId);
    ctx.session.waitingForTransaction = tx_id;
    ctx.session.waitingFor = 'selecting_transaction';

    const tx = await this.botService.getTransactionDetailsById(tx_id);
    if (!tx || tx.remaining_amount <= 0) {
      await ctx.reply(
        '❌ Ошибка: транзакция не найдена или уже получена полностью.',
      );
      return;
    }

    await ctx.reply(
      `💰 Введите сумму для получения от 1 до ${tx.remaining_amount}$:`,
    );

    await ctx.answerCbQuery();
  }

  async onPaymentConfirm(@Ctx() ctx: BotContext, status) {
    await ctx.answerCbQuery();
    const callbackMessageId = ctx.callbackQuery?.message;
    deleteMessageWithDelay(ctx, callbackMessageId);
    const transactionId = Number(ctx?.match?.[1]);
    await this.botService.changeTransactionStatus(ctx, transactionId, status);
  }
}
