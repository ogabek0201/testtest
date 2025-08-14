import { Scenes } from 'telegraf';
import { BotContext } from 'src/types';
import { UserService } from 'src/user/user.service';
import { BotService } from './bot.service';

export function createRegisterWizard(
  userService: UserService,
  botService: BotService,
): Scenes.WizardScene<BotContext> {
  return new Scenes.WizardScene<BotContext>(
    'REGISTER_WIZARD',
    async (ctx: BotContext) => {
      await ctx.reply('📝 Введите логин:');
      return ctx.wizard.next();
    },
    async (ctx: BotContext) => {
      if (!ctx.message || !('text' in ctx.message)) {
        await ctx.reply('❌ Пожалуйста, введите логин текстом.');
        return;
      }
      ctx.wizard.state.login = ctx.message.text.trim();
      await ctx.reply(
        '📞 Введите номер телефона или отправьте контакт:',
      );
      return ctx.wizard.next();
    },
    async (ctx: BotContext) => {
      if (!ctx.message) {
        await ctx.reply('❌ Ошибка! Пожалуйста, отправьте номер.');
        return;
      }

      let phoneNumber: string | undefined;
      if ('contact' in ctx.message) {
        phoneNumber = ctx.message.contact.phone_number;
      } else if ('text' in ctx.message) {
        phoneNumber = ctx.message.text.trim();
      }

      await userService.saveUserData(ctx, {
        login: ctx.wizard.state.login,
        phone: phoneNumber,
        isRegistered: true,
      });

      await ctx.reply('✅ Регистрация завершена!');
      await botService.showMenu(ctx);

      return ctx.scene.leave();
    },
  );
}
