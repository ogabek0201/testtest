import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Finance } from './finance.entity'; // import your Finance entity
import { User } from './user.entity';

@Entity()
export class FinanceHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  amount: number;

  @Column()
  createdBy: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdBy' })
  creator: User;

  @Column()
  financeId: number;

  @ManyToOne(() => Finance)
  @JoinColumn({ name: 'financeId' })
  finance: Finance;

  @CreateDateColumn()
  createdAt: string;
}
