import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { User } from 'src/entities/user.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceModule } from 'src/finance/finance.module';
import { Finance } from 'src/entities/finance.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Finance]), FinanceModule],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
