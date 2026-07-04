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

describe('StorageController', () => {
  let controller: StorageController;
  let storageService: StorageService;

  const mockStorageService = {
    getPresignedPutUrl: jest.fn(),
  };

  const mockTenantQuotaService = {
    reserveStorage: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StorageController],
      providers: [
        { provide: StorageService, useValue: mockStorageService },
        { provide: TenantQuotaService, useValue: mockTenantQuotaService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ScopeGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SuspensionGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PlanLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<StorageController>(StorageController);
    storageService = module.get<StorageService>(StorageService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createPresignedUploadUrl', () => {
    it('should prefix the key with hotelId and sanitize it to prevent path traversal', async () => {
      const hotelId = 'hotel-123';
      const dto = {
        key: '../../../dangerous/path/file.jpg',
        sizeMb: 1,
        contentType: 'image/jpeg',
      };
      const req = { user: { hotel_id: hotelId } };

      mockStorageService.getPresignedPutUrl.mockResolvedValue('http://s3.url/presigned');

      const result = await controller.createPresignedUploadUrl(dto, req);

      // We expect the key to be sanitized (removing ../) and prefixed with hotels/{hotelId}/
      const expectedKey = `hotels/${hotelId}/dangerous/path/file.jpg`;

      expect(mockStorageService.getPresignedPutUrl).toHaveBeenCalledWith({
        key: expectedKey,
        contentType: dto.contentType,
      });
      expect(result.key).toBe(expectedKey);
    });

    it('should prevent complex path traversal bypass attempts like ....//', async () => {
      const hotelId = 'hotel-123';
      const dto = {
        key: '....//....//secret.txt',
        sizeMb: 1,
      };
      const req = { user: { hotel_id: hotelId } };

      mockStorageService.getPresignedPutUrl.mockResolvedValue('http://s3.url/presigned');

      const result = await controller.createPresignedUploadUrl(dto, req);

      // The previous naive regex would have left ../../secret.txt
      // Our improved logic should remove all path traversal segments
      const expectedKey = `hotels/${hotelId}/secret.txt`;

      expect(mockStorageService.getPresignedPutUrl).toHaveBeenCalledWith({
        key: expectedKey,
        contentType: undefined,
      });
      expect(result.key).toBe(expectedKey);
    });

    it('should handle normal keys by prefixing with hotelId', async () => {
      const hotelId = 'hotel-abc';
      const dto = {
        key: 'avatars/user1.png',
        sizeMb: 0.5,
      };
      const req = { user: { hotel_id: hotelId } };

      mockStorageService.getPresignedPutUrl.mockResolvedValue('http://s3.url/presigned');

      const result = await controller.createPresignedUploadUrl(dto, req);

      const expectedKey = `hotels/${hotelId}/avatars/user1.png`;

      expect(mockStorageService.getPresignedPutUrl).toHaveBeenCalledWith({
        key: expectedKey,
        contentType: undefined,
      });
      expect(result.key).toBe(expectedKey);
    });
  });
});
