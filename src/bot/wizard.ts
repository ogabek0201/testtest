// src/bot/registerWizardScene.ts
import { Scenes } from 'telegraf';
import { RegisterWizardContext } from 'src/types';

export function createRegisterWizard(): Scenes.WizardScene<RegisterWizardContext> {
  return new Scenes.WizardScene<RegisterWizardContext>(
    'REGISTER_WIZARD',
    async (ctx) => {
      await ctx.reply('📝 Введите логин:');
      return ctx.wizard.next();
    },
    async (ctx) => {
      await ctx.reply('📞 Введите номер телефона:');
      return ctx.wizard.next();
    },
    async (ctx) => {
      await ctx.reply('✅ Регистрация завершена!');
      return ctx.scene.leave();
    },
  );
}
