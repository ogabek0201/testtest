import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { session, Scenes } from 'telegraf';

import { BotService } from './bot.service';
import { BotUpdate } from './bot.update';
import { BotActions } from './bot.action';
import { BotContext } from 'src/types';
import { UserModule } from 'src/user/user.module';
import { FinanceModule } from 'src/finance/finance.module';
import { createRegisterWizard } from './wizard';

@Module({
  imports: [
    TelegrafModule.forRootAsync({
      useFactory: () => {
        const stage = new Scenes.Stage<BotContext>([createRegisterWizard()]);

        return {
          token: process.env.BOT_TOKEN as string,
          middlewares: [
            session(),
            stage.middleware(),
            async (ctx, next) => {
              console.log('✅ SESSION CHECK:', ctx.session);
              return next();
            },
          ],
        };
      },
    }),
    UserModule,
    FinanceModule,
  ],
  providers: [BotService, BotUpdate, BotActions],
})
export class BotModule {}
