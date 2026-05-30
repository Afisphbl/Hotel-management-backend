import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { NotificationService } from '../services/notification.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private notificationService: NotificationService) {}

  @Get()
  async findAll(@Request() req: any) {
    const notifications = await this.notificationService.findByUser(req.user.userId);
    return { success: true, data: notifications };
  }

  @Get('unread-count')
  async getUnreadCount(@Request() req: any) {
    const count = await this.notificationService.countUnread(req.user.userId);
    return { success: true, data: { count } };
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  async markRead(@Param('id') id: string) {
    await this.notificationService.markRead(id);
    return { success: true };
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  async markAllRead(@Request() req: any) {
    await this.notificationService.markAllRead(req.user.userId);
    return { success: true };
  }
}
