import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, Type } from '@google/genai';
import { RoomsService } from '../hotel/services/rooms.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private ai: GoogleGenAI;
  private readonly DEFAULT_MODEL = 'gemini-3.5-flash';

  constructor(
    private configService: ConfigService,
    private roomsService: RoomsService,
  ) {
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

  async chat(message: string, history: any[], context: any, hotelId: string): Promise<string> {
    if (!this.ai) {
      throw new InternalServerErrorException('AI Service is not configured.');
    }

    const systemPrompt = `
      You are the helpful "LuxeHotel" AI Concierge.
      Your goal is to assist guests with their questions about the hotel, room types, and policies.
      
      Current Hotel Context:
      ${JSON.stringify(context)}

      TOOLS:
      You have access to a tool to check real-time room availability. 
      If the user asks for available rooms for specific dates, call the checkAvailability tool.
      
      Rules:
      1. Be polite, professional, and helpful. 
      2. Use tools when needed to give accurate, real-time answers.
      3. If you don't know something, suggest contacting staff.
      4. Keep responses concise and friendly.
    `;

    try {
      const chat = this.ai.chats.create({
        model: this.DEFAULT_MODEL,
        config: {
          systemInstruction: systemPrompt,
          tools: [
            {
              functionDeclarations: [
                {
                  name: 'checkAvailability',
                  description: 'Checks real-time room availability for a specific hotel and date range.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      startDate: {
                        type: Type.STRING,
                        description: 'Check-in date in YYYY-MM-DD format.'
                      },
                      endDate: {
                        type: Type.STRING,
                        description: 'Check-out date in YYYY-MM-DD format.'
                      },
                      roomTypeId: {
                        type: Type.STRING,
                        description: 'Optional ID of the room type to filter by.'
                      }
                    },
                    required: ['startDate', 'endDate']
                  }
                }
              ]
            }
          ]
        },
        history: history.map(h => ({
          role: h.role,
          parts: [{ text: h.parts[0].text }]
        })),
      });

      let result = await chat.sendMessage({ message: [{ text: message }] });

      // Handle function calls (loop in case of multiple calls)
      while (result.functionCalls?.length) {
        const functionResponses = await Promise.all(
          result.functionCalls.map(async (call) => {
            if (call.name === 'checkAvailability') {
              const { startDate, endDate, roomTypeId } = call.args as any;
              try {
                const availability = await this.roomsService.getAvailability(
                  hotelId,
                  roomTypeId,
                  startDate,
                  endDate
                );
                
                // Format availability for the AI to understand easily
                const simplifiedAvailability = availability
                  .filter(a => a.available)
                  .map(a => ({
                    roomNumber: a.room.roomNumber,
                    roomType: a.room.roomType?.name,
                    price: Number(a.room.effectivePrice || a.room.basePrice),
                    capacity: a.room.baseCapacity
                  }));

                return {
                  name: call.name,
                  response: { content: simplifiedAvailability }
                };
              } catch (err) {
                return {
                  name: call.name,
                  response: { error: 'Failed to check availability' }
                };
              }
            }
            return { name: call.name, response: { error: 'Unknown function' } };
          })
        );

        result = await chat.sendMessage({
          message: functionResponses.map(res => ({
            functionResponse: res
          }))
        });
      }

      return result.text || 'No response generated';
    } catch (error) {
      this.logger.error(`Error in AI chat: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to process chat message');
    }
  }
}
