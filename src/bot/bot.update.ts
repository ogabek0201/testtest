import { Injectable } from '@nestjs/common';
import {
  Command,
  Ctx,
  Hears,
  InjectBot,
  On,
  Start,
  Update,
} from 'nestjs-telegraf';
import { BotService } from './bot.service';
import { UserService } from '../user/user.service';
import { Context, Markup, Scenes, Telegraf } from 'telegraf';
import { LogAction } from 'src/decorators';
import { BotContext } from 'src/types';
import {
  answerAndDeleteLastMessage,
  checkPhoneAndReply,
  deleteLastMessage,
  deleteMessageWithDelay,
} from 'src/utils';
import { RoleEnum } from 'src/enums';

@Update()
@Injectable()
export class BotUpdate {
  constructor(
    private readonly botService: BotService,
    private readonly userService: UserService,
    @InjectBot() private readonly bot: Telegraf<BotContext>,
  ) {
    this.bot.hears('📋 Регистрация', (ctx) => this.onRegistration(ctx));
  }

  @Start()
  @LogAction('command_start')
  async onStart(@Ctx() ctx: Context) {
    await this.botService.start(ctx);
  }

  @Command('help')
  @LogAction('command_help')
  async onHelp(@Ctx() ctx: Context) {
    await ctx.reply('Доступные команды: /start, /register, /stats, /help');
  }

  @Hears('📋 Регистрация')
  @LogAction('hear_registration')
  async onRegistration(@Ctx() ctx: Scenes.WizardContext) {
    const user = await this.userService.getUserInfo(ctx?.from?.id);
    if (user?.isRegistered) {
      const message = await ctx.reply('Вы уже зарегистрированы!');
      deleteMessageWithDelay(ctx, message);
      return;
    }
    await ctx.scene.enter('REGISTER_WIZARD');
  }

  @Hears('📊 Статистика')
  @LogAction('hear_stats')
  async onStats(@Ctx() ctx: Context) {
    await this.botService.getStatistics(ctx);
  }

  @Hears('📁 Получить статистику')
  @LogAction('hear_export_stats')
  async onExportStats(@Ctx() ctx: Context) {
    await this.botService.exportFinanceStats(ctx);
  }

  @Hears('⚙️ Настройки')
  @LogAction('hear_settings')
  async onSettings(@Ctx() ctx: Context) {
    await ctx.reply(
      '⚙️ Выберите действие:',
      Markup.inlineKeyboard([
        [Markup.button.callback('✏️ Изменить логин', 'change_login')],
        [Markup.button.callback('📞 Изменить телефон', 'change_phone')],
      ]),
    );
  }

  @Hears('🔍 Поиск')
  @LogAction('hear_search')
  async onSearch(@Ctx() ctx: Context) {
    const botCtx = ctx as BotContext;
    await botCtx.reply(
      '🔍 Введите логин или номер телефона пользователя для поиска:',
    );
    botCtx.session.waitingFor = 'search_user';
  }

  @Hears('💸 Оформить получение')
  @LogAction('hear_receive_money')
  async onReceiveMoney(@Ctx() ctx: BotContext) {
    const userId = ctx.from?.id;
    const user = await this.userService.getUserInfo(userId);

    if (!user || user.role !== RoleEnum.RECEIVER) {
      await ctx.reply('❌ Только получатели могут оформлять получение денег.');
      return;
    }

    const pendingTransactions = await this.botService.getPendingTransactions();

    if (!pendingTransactions || pendingTransactions.length === 0) {
      await ctx.reply('📭 Нет доступных транзакций для получения.');
      return;
    }

    const buttons = pendingTransactions.map((tx) => {
      const remainingAmount = tx.remaining_amount;
      const sender = tx.user?.login || 'отправителя';
      return [
        Markup.button.callback(
          `💰 ${remainingAmount} сом от ${sender}`,
          `receive_tx_${tx.id}`,
        ),
      ];
    });

    await ctx.reply(
      '💸 Выберите транзакцию для получения:',
      Markup.inlineKeyboard(buttons),
    );

    ctx.session.waitingFor = 'selecting_transaction';
  }

  @On('contact')
  @LogAction('callback_contact')
  async onContact(@Ctx() ctx: BotContext) {
    if (ctx.session.waitingFor === 'phone' && (ctx.message as any).contact) {
      const newPhone = (ctx?.message as any)?.contact?.phone_number;

      await this.userService.saveUserData(ctx, { phone: newPhone });
      const successMessage = await ctx.reply(
        `✅ Ваш новый номер телефона: ${newPhone}`,
      );
      await this.clearAndReturnMenu(ctx, successMessage);
    }
  }

  @On('text')
  @LogAction('callback_text')
  async onText(@Ctx() ctx: BotContext) {
    const inlineMessage = (ctx.message as any)?.text.trim();
    deleteMessageWithDelay(ctx, ctx.message?.message_id);
    const waitingFor = ctx.session.waitingFor;
    if (ctx.session.waitingForPayment && !waitingFor) {
      console.log('payment');
      await ctx.reply(
        '💵 Подтверждаете сумму? Отправьте число ещё раз для подтверждения.',
      );
      ctx.session.paymentAmount = inlineMessage;
      ctx.session.waitingFor = 'confirm_amount';
    }

    switch (waitingFor) {
      case 'login': {
        await deleteLastMessage(ctx);
        const newLogin = inlineMessage;

        if (newLogin.length < 3 || newLogin.length > 20) {
          await ctx.reply(
            '❌ Логин должен быть от 3 до 20 символов. Попробуйте снова.',
          );
          return;
        }

        await this.userService.saveUserData(ctx, { login: newLogin });
        const successMessage = await ctx.reply(
          `✅ Ваш новый логин: ${newLogin}`,
        );
        await this.clearAndReturnMenu(ctx, successMessage);
        return;
      }
      case 'phone': {
        const newPhone = inlineMessage;

        const result = await checkPhoneAndReply(ctx, newPhone);
        if (!result) {
          return;
        }
        await this.userService.saveUserData(ctx, { phone: newPhone });

        const successMessage = await ctx.reply(
          `✅ Ваш новый номер телефона: ${newPhone}`,
        );
        await this.clearAndReturnMenu(ctx, successMessage);
        break;
      }
      case 'search_user': {
        try {
          const users = await this.userService.searchUser(
            inlineMessage,
            ctx?.from?.id,
          );
          for (const user of users) {
            const message = await ctx.reply(
              `🔹<b>Username: </b> ${user.username || '-'}\n👤 <b>Логин:</b> ${user.login || '-'}\n📞 <b>Телефон:</b> ${user.phone || '-'}\n`,
              {
                parse_mode: 'HTML',
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: '💰 Отправить деньги',
                        callback_data: `send_money_${user.id}`,
                      },
                    ],
                  ],
                },
              },
            );
            deleteMessageWithDelay(ctx, message);
          }
        } catch (err: any) {
          await ctx.reply(err.message);
        }

        // ctx.session.waitingFor = null;
        break;
      }
      case 'confirm_amount': {
        const paymentAmount = ctx.session.paymentAmount || 0;
        const recipient = ctx.session.waitingForPayment;
        const transaction = await this.botService.createTransaction(
          ctx,
          paymentAmount,
          inlineMessage,
          recipient,
        );

        await this.botService.sendPaymentNotification(
          ctx,
          transaction,
          recipient,
          paymentAmount,
        );

        ctx.session.waitingFor = null;
        ctx.session.waitingForPayment = null;
        break;
      }
      case 'selecting_transaction': {
        const transactionId = ctx.session.waitingForTransaction;
        const inputAmount = Number(inlineMessage);

        if (!transactionId || isNaN(inputAmount) || inputAmount <= 0) {
          await ctx.reply('❌ Введите корректную сумму.');
          return;
        }

        const tx =
          await this.botService.getTransactionDetailsById(transactionId);
        if (!tx || tx.remaining_amount < inputAmount) {
          await ctx.reply(
            `❌ Введите сумму от 1 до ${tx?.remaining_amount || 0}$.`,
          );
          return;
        }

        // Store the amount and move to confirmation step
        ctx.session.paymentAmount = inputAmount;
        ctx.session.waitingFor = 'confirm_receving';

        await ctx.reply(
          `Подтверждаете получение ${inputAmount}$ из транзакции #${transactionId}? Введите сумму еще раз для подтверждения.`,
        );

        break;
      }
      case 'confirm_receving': {
        const paymentAmount = Number(ctx.session.paymentAmount);
        const confirmAmount = Number(inlineMessage);
        const transactionId = ctx.session.waitingForTransaction;

        if (paymentAmount !== confirmAmount) {
          await ctx.reply('❌ Сумма не совпадает. Попробуйте снова.');
          return;
        }

        const tx =
          await this.botService.getTransactionDetailsById(transactionId);

        // Complete transaction (partial or full)
        const result = await this.botService.confirmTransactionReceive(
          ctx,
          transactionId,
          paymentAmount,
        );
        if (result) {
          await ctx.reply(`✅ Вы успешно получили ${paymentAmount}$.`);
          await this.botService.sendNotification(
            ctx,
            tx?.userId,
            `✅ Успешно отправлено: ${paymentAmount}`,
          );
        }

        // Clear session
        ctx.session.waitingFor = null;
        ctx.session.waitingForTransaction = null;
        ctx.session.paymentAmount = null;
        break;
      }
    }
  }

  async clearAndReturnMenu(ctx: BotContext, successMessage?: any) {
    await answerAndDeleteLastMessage(ctx);
    await this.botService.showMenu(ctx);
    ctx.session.waitingFor = null;
    deleteMessageWithDelay(ctx, successMessage);
  }
}
