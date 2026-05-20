import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Role } from './role.entity';

export enum UserScope {
  PLATFORM = 'platform',
  HOTEL = 'hotel',
}

@Entity({ name: 'users', schema: 'global' })
export class User extends BaseEntity {
  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  password: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({
    type: 'enum',
    enum: UserScope,
    default: UserScope.HOTEL,
  })
  scope: UserScope;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  roleId: string;

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'roleId' })
  role: Role;

  @Column({ default: false })
  twoFactorEnabled: boolean;

  @Column({ select: false, nullable: true })
  twoFactorSecret: string;
}
