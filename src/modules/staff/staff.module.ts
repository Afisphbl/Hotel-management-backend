import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Staff } from '../../database/entities/staff.entity';
import { StaffController } from './controllers/staff.controller';
import { StaffService } from './services/staff.service';
import { PasswordPolicyService } from '../../common/services/password-policy.service';

@Module({
  imports: [TypeOrmModule.forFeature([Staff])],
  controllers: [StaffController],
  providers: [StaffService, PasswordPolicyService],
  exports: [StaffService],
})
export class StaffModule {}
