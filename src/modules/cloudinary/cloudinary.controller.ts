import {
  Controller,
  Post,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CloudinaryService } from './cloudinary.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { SuspensionGuard } from '../../common/guards/suspension.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Scopes } from '../../common/decorators/scopes.decorator';
import { UserScope } from '../../database/entities/user.entity';
import { success } from '../hotel/common/response.interceptor';

@Controller('hotel/cloudinary')
@UseGuards(JwtAuthGuard, ScopeGuard, TenantGuard, SuspensionGuard, PermissionsGuard)
@Scopes(UserScope.HOTEL)
export class CloudinaryController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only image files are allowed');
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('File size must be less than 5MB');
    }

    const hotelId = req.user.hotel_id;
    const folder = `hotels/${hotelId}`;

    const result = await this.cloudinaryService.uploadImage(file, folder);
    return success(result);
  }
}
