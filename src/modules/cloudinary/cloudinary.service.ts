import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}

export interface ImageTransformOptions {
  width?: number;
  height?: number;
  crop?: 'fill' | 'scale' | 'fit' | 'thumb' | 'crop';
  quality?: number | 'auto';
  format?: 'webp' | 'avif' | 'jpeg' | 'png' | 'auto';
  blur?: number;
  sharpen?: number;
}

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private isConfigured = false;

  constructor(private readonly configService: ConfigService) {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });
      this.isConfigured = true;
      this.logger.log(`Cloudinary configured for cloud: ${cloudName}`);
    } else {
      this.logger.warn('Cloudinary not configured — some image features will be unavailable');
    }
  }

  async uploadImage(
    file: Express.Multer.File,
    folder: string = 'hotel',
  ): Promise<CloudinaryUploadResult> {
    if (!this.isConfigured) {
      throw new Error('Cloudinary is not configured');
    }

    const buffer = file.buffer || Buffer.from(
      file.path ? require('fs').readFileSync(file.path) : '',
    );

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        },
        (error, result: UploadApiResponse) => {
          if (error) {
            this.logger.error(`Cloudinary upload failed: ${error.message}`);
            reject(new Error(`Image upload failed: ${error.message}`));
          } else {
            resolve({
              url: result.secure_url,
              publicId: result.public_id,
              width: result.width,
              height: result.height,
              format: result.format,
              bytes: result.bytes,
            });
          }
        },
      );

      uploadStream.end(buffer);
    });
  }

  async deleteImage(publicId: string): Promise<void> {
    if (!this.isConfigured) return;
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error: any) {
      this.logger.error(`Failed to delete Cloudinary image ${publicId}: ${error.message}`);
    }
  }

  getOptimizedUrl(publicId: string, transforms?: ImageTransformOptions): string {
    if (!this.isConfigured) return '';
    const params: string[] = ['q_auto', 'f_auto'];
    if (transforms?.width) params.push(`w_${transforms.width}`);
    if (transforms?.height) params.push(`h_${transforms.height}`);
    if (transforms?.crop) params.push(`c_${transforms.crop}`);
    if (transforms?.quality && transforms.quality !== 'auto') params.push(`q_${transforms.quality}`);
    if (transforms?.format && transforms.format !== 'auto') params.push(`f_${transforms.format}`);
    if (transforms?.blur) params.push(`e_blur:${transforms.blur}`);
    if (transforms?.sharpen) params.push(`e_sharpen:${transforms.sharpen}`);
    return cloudinary.url(publicId, { transformation: params.join(',') });
  }

  isReady(): boolean {
    return this.isConfigured;
  }
}
