import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryColumn,
} from 'typeorm';
import { RoleEnum } from 'src/enums';

@Entity('users')
export class User {
  @PrimaryColumn({ unique: true, type: 'bigint' })
  id: number;

  @Column({ nullable: true })
  fullName?: string;

  @Column({ unique: true, type: 'varchar', nullable: true })
  login?: string;

  @Column({ unique: true, type: 'varchar', nullable: true })
  username?: string;

  @Column({ nullable: true })
  language?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ type: 'text', nullable: true })
  address?: string;

  @Column({ type: 'boolean', nullable: false, default: false })
  isPremium: boolean;

  @Column({ type: 'boolean', nullable: false, default: false })
  isBot: boolean;

  @Column({ type: 'boolean', nullable: false, default: false })
  isRegistered: boolean;

  @Column({ type: 'enum', enum: RoleEnum, default: RoleEnum.USER })
  role: RoleEnum;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
