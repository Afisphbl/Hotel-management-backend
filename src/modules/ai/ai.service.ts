import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, Type } from '@google/genai';
import { RoomsService } from '../hotel/services/rooms.service';
import { PublicBookingService } from '../public-booking/public-booking.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private ai: GoogleGenAI;
  private readonly DEFAULT_MODEL = 'gemini-3.5-flash';

  constructor(
    private configService: ConfigService,
    private roomsService: RoomsService,
    private publicBookingService: PublicBookingService,
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
      1. checkAvailability: Use this to find available rooms for specific dates.
      2. createBooking: Use this to initiate a reservation for a guest. 
      
      Rules for Booking:
      - Before calling createBooking, you MUST collect the guest's: First Name, Last Name, Email, and optionally Phone Number.
      - You also need the roomId, checkIn date, checkOut date, and numGuests.
      - If any of these are missing, ask the guest for them politely.
      - Once you call createBooking, tell the guest their booking is prepared and provide the checkout URL as a clear, clickable Markdown link (e.g., [Click here to pay and confirm](url)).
      
      General Rules:
      - Be polite, professional, and helpful. 
      - Use tools when needed to give accurate, real-time answers.
      - If you don't know something, suggest contacting staff.
      - Keep responses concise and friendly.
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
                },
                {
                  name: 'createBooking',
                  description: 'Initiates a room reservation and generates a payment link.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      firstName: { type: Type.STRING },
                      lastName: { type: Type.STRING },
                      email: { type: Type.STRING },
                      phoneNumber: { type: Type.STRING },
                      roomId: { type: Type.STRING },
                      checkIn: { type: Type.STRING, description: 'YYYY-MM-DD' },
                      checkOut: { type: Type.STRING, description: 'YYYY-MM-DD' },
                      numGuests: { type: Type.NUMBER },
                      notes: { type: Type.STRING }
                    },
                    required: ['firstName', 'lastName', 'email', 'roomId', 'checkIn', 'checkOut', 'numGuests']
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
                const simplifiedAvailability = availability
                  .filter(a => a.available)
                  .map(a => ({
                    roomId: a.room.id,
                    roomNumber: a.room.roomNumber,
                    roomType: a.room.roomType?.name,
                    price: Number(a.room.effectivePrice || a.room.basePrice),
                    capacity: a.room.baseCapacity
                  }));
                return { name: call.name, response: { content: simplifiedAvailability } };
              } catch (err) {
                return { name: call.name, response: { error: 'Failed to check availability' } };
              }
            }

            if (call.name === 'createBooking') {
              const args = call.args as any;
              try {
                const bookingResult = await this.publicBookingService.createPublicBooking({
                  hotelId,
                  ...args
                });
                return {
                  name: call.name,
                  response: { 
                    content: {
                      success: true,
                      bookingId: bookingResult.bookingId,
                      checkoutUrl: bookingResult.checkoutUrl,
                      totalPrice: bookingResult.totalPrice
                    }
                  }
                };
              } catch (err) {
                this.logger.error(`Booking tool error: ${err.message}`);
                return { 
                  name: call.name, 
                  response: { error: err.message || 'Failed to create booking' } 
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
