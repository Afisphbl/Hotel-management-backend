import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../database/entities/user.entity';
import { Hotel } from '../../database/entities/hotel.entity';
import { HotelUserAccess } from '../../database/entities/hotel-user-access.entity';
import { Role } from '../../database/entities/role.entity';
import { RolePermission } from '../../database/entities/role-permission.entity';
import { Permission } from '../../database/entities/permission.entity';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { SupportAccess } from '../../database/entities/global/support-access.entity';
import { UserManagementService } from '../platform/user-management.service';
import { PasswordPolicyService } from '../../common/services/password-policy.service';
import { RedisService } from '../redis/redis.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  let passwordPolicyService: PasswordPolicyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: { findOne: jest.fn(), update: jest.fn() },
        },
        { provide: getRepositoryToken(Hotel), useValue: {} },
        { provide: getRepositoryToken(HotelUserAccess), useValue: {} },
        { provide: getRepositoryToken(Role), useValue: {} },
        { provide: getRepositoryToken(RolePermission), useValue: {} },
        { provide: getRepositoryToken(Permission), useValue: {} },
        { provide: getRepositoryToken(RefreshToken), useValue: {} },
        { provide: getRepositoryToken(AuditLog), useValue: {} },
        { provide: getRepositoryToken(SupportAccess), useValue: {} },
        { provide: UserManagementService, useValue: {} },
        {
          provide: PasswordPolicyService,
          useValue: { assertCompliant: jest.fn() },
        },
        { provide: RedisService, useValue: {} },
        { provide: JwtService, useValue: {} },
        { provide: ConfigService, useValue: {} },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    passwordPolicyService = module.get<PasswordPolicyService>(PasswordPolicyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('changePassword', () => {
    it('should throw BadRequestException if password is not compliant', async () => {
      jest.spyOn(passwordPolicyService, 'assertCompliant').mockRejectedValue(new BadRequestException('Weak password'));

      await expect(service.changePassword('user-id', 'old-pass', 'weak')).rejects.toThrow(BadRequestException);
      expect(passwordPolicyService.assertCompliant).toHaveBeenCalledWith('weak');
    });

    it('should call assertCompliant before checking current password', async () => {
      const assertSpy = jest.spyOn(passwordPolicyService, 'assertCompliant').mockResolvedValue(undefined);

      // It will fail later because we didn't mock other things, but we want to see if assertCompliant was called
      try {
        await service.changePassword('user-id', 'old-pass', 'StrongPass123!');
      } catch (e) {
        // ignore
      }

      expect(assertSpy).toHaveBeenCalledWith('StrongPass123!');
    });
  });
});
