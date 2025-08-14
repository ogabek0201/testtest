import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppService } from './app.service';
import { User, Finance, FinanceHistory } from './entities';
import { dbConfig } from './config';
import { BotModule } from './bot/bot.module';

console.log(
  'Connecting to DB:',
  process.env.DB_USERNAME,
  process.env.DB_HOST,
  process.env.DB_PASSWORD,
);

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'mysql',
      entities: [User, Finance, FinanceHistory],
      ...dbConfig,
    }),
    TypeOrmModule.forFeature([User, Finance, FinanceHistory]),
    BotModule,
  ],
  providers: [AppService],
})
export class AppModule {}
