import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private ai: GoogleGenAI;
  private readonly DEFAULT_MODEL = 'gemini-3.5-flash';

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
        model: this.DEFAULT_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      return response.text || 'No response generated';
    } catch (error) {
      this.logger.error(`Error generating AI response: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to generate AI response');
    }
  }

  async interpretSearch(query: string, context: any): Promise<any> {
    if (!this.ai) {
      throw new InternalServerErrorException('AI Service is not configured.');
    }

    const systemPrompt = `
      You are an expert travel assistant for a hotel booking system.
      Your task is to convert a user's natural language query into structured search filters.
      
      Available Data Context (Hotels and Rooms):
      ${JSON.stringify(context)}

      The structured output MUST be a JSON object with the following optional fields:
      - minCapacity (number): minimum number of guests.
      - maxCapacity (number): maximum number of guests.
      - roomTypeId (string): the ID of a specific room type if mentioned.
      - startDate (string): YYYY-MM-DD format.
      - endDate (string): YYYY-MM-DD format.
      - sortBy (string): 'price', 'capacity', or 'roomNumber'.
      - sortOrder (string): 'asc' or 'desc'.
      - reasoning (string): A brief 1-sentence explanation of why these filters were chosen.

      Rules:
      1. If dates are mentioned like "next weekend", estimate them based on the current date: ${new Date().toISOString().split('T')[0]}.
      2. If "cheap" or "affordable" is mentioned, set sortBy to 'price' and sortOrder to 'asc'.
      3. If "luxury" or "best" is mentioned, set sortBy to 'price' and sortOrder to 'desc'.
      4. ONLY return valid JSON. No markdown formatting.
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: this.DEFAULT_MODEL,
        contents: [
          { role: 'user', parts: [{ text: `System Instruction: ${systemPrompt}` }] },
          { role: 'user', parts: [{ text: `User Query: "${query}"` }] }
        ],
        config: {
          responseMimeType: 'application/json',
        }
      });

      return JSON.parse(response.text || '{}');
    } catch (error) {
      this.logger.error(`Error interpreting AI search: ${error.message}`, error.stack);
      return { error: 'Failed to interpret query' };
    }
  }

  async chat(message: string, history: any[], context: any): Promise<string> {
    if (!this.ai) {
      throw new InternalServerErrorException('AI Service is not configured.');
    }

    const systemPrompt = `
      You are the helpful "LuxeHotel" AI Concierge.
      Your goal is to assist guests with their questions about the hotel, room types, and policies.
      
      Current Hotel Context:
      ${JSON.stringify(context)}

      Be polite, professional, and helpful. Use the context provided to answer questions accurately.
      If you don't know the answer, politely suggest they contact the hotel staff directly.
      Keep your responses concise and friendly.
    `;

    try {
      const chat = this.ai.chats.create({
        model: this.DEFAULT_MODEL,
        config: {
          systemInstruction: systemPrompt,
        },
        history: history.map(h => ({
          role: h.role,
          parts: [{ text: h.parts[0].text }]
        })),
      });

      const result = await chat.sendMessage({ message: [{ text: message }] });
      return result.text || 'No response generated';
    } catch (error) {
      this.logger.error(`Error in AI chat: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to process chat message');
    }
  }
}
