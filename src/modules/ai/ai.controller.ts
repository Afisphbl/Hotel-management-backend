import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('test')
  @HttpCode(HttpStatus.OK)
  async testAi(@Body('prompt') prompt: string) {
    const response = await this.aiService.generateResponse(prompt || 'Hello, are you ready?');
    return {
      success: true,
      message: 'AI response generated successfully',
      response,
    };
  }
}
