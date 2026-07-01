import { Test, TestingModule } from '@nestjs/testing';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';
import { TenantQuotaService } from '../../common/services/tenant-quota.service';
import { PlanLimitGuard } from '../../auth/guards/plan-limit.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { SuspensionGuard } from '../../common/guards/suspension.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { DataSource } from 'typeorm';

describe('StorageController', () => {
  let controller: StorageController;
  let storageService: StorageService;

  const mockStorageService = {
    getPresignedPutUrl: jest.fn().mockResolvedValue('http://signed-url'),
  };

  const mockTenantQuotaService = {
    reserveStorage: jest.fn(),
  };

  const mockGuard = {
    canActivate: jest.fn().mockReturnValue(true),
  };

  const mockDataSource = {};

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StorageController],
      providers: [
        { provide: StorageService, useValue: mockStorageService },
        { provide: TenantQuotaService, useValue: mockTenantQuotaService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .overrideGuard(ScopeGuard)
      .useValue(mockGuard)
      .overrideGuard(TenantGuard)
      .useValue(mockGuard)
      .overrideGuard(SuspensionGuard)
      .useValue(mockGuard)
      .overrideGuard(PermissionsGuard)
      .useValue(mockGuard)
      .overrideGuard(PlanLimitGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<StorageController>(StorageController);
    storageService = module.get<StorageService>(StorageService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createPresignedUploadUrl', () => {
    it('should prefix the key with hotelId (IDOR fix)', async () => {
      const dto = {
        key: 'file.txt',
        sizeMb: 1,
        contentType: 'text/plain',
      };
      const req = { user: { hotel_id: 'hotel-123' } };

      const result = await controller.createPresignedUploadUrl(dto, req);

      expect(mockStorageService.getPresignedPutUrl).toHaveBeenCalledWith({
        key: 'hotel-123/file.txt',
        contentType: 'text/plain',
      });
      expect(result.key).toBe('hotel-123/file.txt');
    });

    it('should sanitize path traversal in key', async () => {
      const dto = {
        key: '../../../etc/passwd',
        sizeMb: 1,
      };
      const req = { user: { hotel_id: 'hotel-123' } };

      await controller.createPresignedUploadUrl(dto, req);

      expect(mockStorageService.getPresignedPutUrl).toHaveBeenCalledWith({
        key: 'hotel-123/etc/passwd',
        contentType: undefined,
      });
    });

    it('should sanitize recursive path traversal', async () => {
      const dto = {
        key: '....//....//etc/passwd',
        sizeMb: 1,
      };
      const req = { user: { hotel_id: 'hotel-123' } };

      await controller.createPresignedUploadUrl(dto, req);

      expect(mockStorageService.getPresignedPutUrl).toHaveBeenCalledWith({
        key: 'hotel-123/etc/passwd',
        contentType: undefined,
      });
    });

    it('should sanitize backslashes', async () => {
      const dto = {
        key: '..\\..\\etc\\passwd',
        sizeMb: 1,
      };
      const req = { user: { hotel_id: 'hotel-123' } };

      await controller.createPresignedUploadUrl(dto, req);

      expect(mockStorageService.getPresignedPutUrl).toHaveBeenCalledWith({
        key: 'hotel-123/etc/passwd',
        contentType: undefined,
      });
    });

    it('should sanitize leading slashes and dots', async () => {
      const dto = {
        key: '///./root-file.txt',
        sizeMb: 1,
      };
      const req = { user: { hotel_id: 'hotel-123' } };

      await controller.createPresignedUploadUrl(dto, req);

      expect(mockStorageService.getPresignedPutUrl).toHaveBeenCalledWith({
        key: 'hotel-123/root-file.txt',
        contentType: undefined,
      });
    });
  });
});
