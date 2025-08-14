import { Module } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Finance, FinanceHistory } from 'src/entities';
import { FinanceHistoryService } from './finance-history.service';

@Module({
  imports: [TypeOrmModule.forFeature([Finance, FinanceHistory])],
  providers: [FinanceService, FinanceHistoryService],
  exports: [FinanceService, FinanceHistoryService],
})
export class FinanceModule {}
