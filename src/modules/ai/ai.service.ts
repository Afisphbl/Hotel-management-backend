import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private ai: GoogleGenAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GOOGLE_AI_API_KEY');
    if (!apiKey || apiKey === 'your_api_key_here' || apiKey === '') {
      this.logger.warn('GOOGLE_AI_API_KEY is not set correctly in .env');
    } else {
      this.ai = new GoogleGenAI({ apiKey });
    }
  }

  async generateResponse(prompt: string): Promise<string> {
    if (!this.ai) {
      throw new InternalServerErrorException('AI Service is not configured. Please check GOOGLE_AI_API_KEY.');
    }

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      return response.text || 'No response generated';
    } catch (error) {
      this.logger.error(`Error generating AI response: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to generate AI response');
    }
  }
}
