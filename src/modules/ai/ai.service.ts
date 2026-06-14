import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoogleGenAI, Type } from '@google/genai';
import { RoomsService } from '../hotel/services/rooms.service';
import { PublicBookingService } from '../public-booking/public-booking.service';
import { BookingsService } from '../bookings/bookings.service';
import { RoomStatus } from '../../database/entities/room.entity';
import { Hotel } from '../../database/entities/hotel.entity';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private ai: GoogleGenAI;
  private staffAi: GoogleGenAI;
  private readonly DEFAULT_MODEL = 'gemini-2.0-flash-lite';
  private readonly STAFF_MODEL = 'gemini-2.0-flash';

  constructor(
    private configService: ConfigService,
    private roomsService: RoomsService,
    private publicBookingService: PublicBookingService,
    private bookingsService: BookingsService,
    @InjectRepository(Hotel) private hotelRepository: Repository<Hotel>,
  ) {
    const apiKey = this.configService.get<string>('GOOGLE_AI_API_KEY');
    if (!apiKey || apiKey === 'your_api_key_here' || apiKey === '') {
      this.logger.warn('GOOGLE_AI_API_KEY is not set correctly in .env');
    } else {
      this.ai = new GoogleGenAI({ apiKey });
    }

    const staffKey = this.configService.get<string>('GOOGLE_AI_STAFF_API_KEY');
    if (staffKey && staffKey !== '') {
      this.staffAi = new GoogleGenAI({ apiKey: staffKey });
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

  async chat(message: string, history: any[], context: any, hotelId: string, user?: any): Promise<{ text: string, checkoutUrl?: string }> {
    if (!this.ai) {
      throw new InternalServerErrorException('AI Service is not configured.');
    }

    let detectedCheckoutUrl: string | undefined;

    const authContext = user 
      ? `The current user is LOGGED IN as "${user.name}" with email "${user.email}". 
         When booking, use these details and DO NOT ask the user for their name or email. 
         Just confirm you are using their account details.`
      : `The user is NOT LOGGED IN. 
         Before allowing them to book/reserve a room via the createBooking tool, you MUST tell them to log in first.
         Provide this link: [Click here to login](/login). 
         Do not call createBooking until they are logged in.`;

    const systemPrompt = `
      You are the helpful "LuxeHotel" AI Concierge.
      Your goal is to assist guests with their questions about the hotel, room types, and policies.
      
      Current Hotel Context:
      ${JSON.stringify(context)}

      User Authentication State:
      ${authContext}

      TOOLS:
      1. checkAvailability: Use this to find available rooms for specific dates.
      2. createBooking: Use this to initiate a reservation for a guest. 
      
      CRITICAL ROOM RULES:
      - You do NOT know which room numbers exist. NEVER tell a guest a room does or does not exist based on your own assumptions.
      - When a user mentions a specific room number (e.g. "room 901"), ALWAYS call checkAvailability first to look it up. The checkAvailability results will include roomNumber — find the matching room and use its roomId.
      - If checkAvailability returns no room matching that number, only then say the room was not found in availability results.
      - NEVER invent a range of room numbers (e.g. "102 to 510"). You only know what the tool returns.

      Rules for Booking:
      - ONLY use createBooking if the user is LOGGED IN.
      - You need the roomId (UUID from checkAvailability results), checkIn date, checkOut date, and numGuests.
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
                // Capture the checkout URL so we can return it as metadata
                detectedCheckoutUrl = bookingResult.checkoutUrl;
                
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

      return {
        text: result.text || 'No response generated',
        checkoutUrl: detectedCheckoutUrl
      };
    } catch (error) {
      this.logger.error(`Error in AI chat: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to process chat message');
    }
  }

  async staffChat(
    message: string,
    history: any[],
    hotelId: string,
    userId: string,
  ): Promise<{ text: string }> {
    if (!this.staffAi) {
      throw new InternalServerErrorException('Staff AI is not configured. Check GOOGLE_AI_STAFF_API_KEY.');
    }

    const hotel = await this.hotelRepository.findOne({ where: { id: hotelId } });
    const rawTz = hotel?.timezone || 'UTC';
    // Normalize "GMT+3" → "Etc/GMT-3" (POSIX sign is inverted)
    const timezone = rawTz.replace(/^GMT([+-])(\d+)$/, (_, sign, h) =>
      `Etc/GMT${sign === '+' ? '-' : '+'}${h}`
    );
    const today = new Date().toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD in hotel tz

    console.log('[AI staffChat] UTC now:', new Date().toISOString());
    console.log('[AI staffChat] Hotel raw timezone:', rawTz, '→ normalized:', timezone);
    console.log('[AI staffChat] today (hotel tz):', today);

    const systemPrompt = `You are an intelligent hotel operations assistant for staff.
Today's date is ${today}. Hotel ID: ${hotelId}.

You can perform the following actions using tools:
- getBookings: search bookings by status, date, guest name, or room number
- getTodayActions: get bookings that need check-in or check-out today
- updateBookingStatus: change a booking status (confirm, cancel, check_in, check_out)
- updateRoomStatus: change a room's status (available, occupied, cleaning, maintenance)

Rules:
- Always call getTodayActions when asked about today's check-ins or check-outs.
- When checking in a booking, also update the room status to 'occupied'.
- When checking out a booking, also update the room status to 'available'.
- Be concise and direct. Confirm every action you take.
- If an action fails, explain why clearly.`;

    const tools: any[] = [
      {
        functionDeclarations: [
          {
            name: 'getBookings',
            description: 'Search and list bookings with optional filters.',
            parameters: {
              type: Type.OBJECT,
              properties: {
                status: { type: Type.STRING, description: 'Filter by booking status: PENDING, HOLD, CONFIRMED, CHECKED_IN, CHECKED_OUT, CANCELLED' },
                dateFrom: { type: Type.STRING, description: 'Filter check-in from date YYYY-MM-DD' },
                dateTo: { type: Type.STRING, description: 'Filter check-in to date YYYY-MM-DD' },
                search: { type: Type.STRING, description: 'Search by guest name or room number' },
              },
            },
          },
          {
            name: 'getTodayActions',
            description: 'Get bookings that need check-in today (CONFIRMED with checkIn=today) or check-out today (CHECKED_IN with checkOut=today).',
            parameters: { type: Type.OBJECT, properties: {} },
          },
          {
            name: 'updateBookingStatus',
            description: 'Update a booking status.',
            parameters: {
              type: Type.OBJECT,
              properties: {
                bookingId: { type: Type.STRING },
                action: { type: Type.STRING, description: 'One of: confirm, cancel, checkin, checkout' },
              },
              required: ['bookingId', 'action'],
            },
          },
          {
            name: 'updateRoomStatus',
            description: 'Update a room status.',
            parameters: {
              type: Type.OBJECT,
              properties: {
                roomId: { type: Type.STRING },
                status: { type: Type.STRING, description: 'One of: available, occupied, cleaning, maintenance' },
              },
              required: ['roomId', 'status'],
            },
          },
        ],
      },
    ];

    const chat = this.staffAi.chats.create({
      model: this.STAFF_MODEL,
      config: { systemInstruction: systemPrompt, tools },
      history: history.map((h) => ({ role: h.role, parts: [{ text: h.parts[0].text }] })),
    });

    let result = await chat.sendMessage({ message: [{ text: message }] });
    console.log('[AI staffChat] initial response text:', result.text);
    console.log('[AI staffChat] function calls:', result.functionCalls?.map(c => c.name) ?? 'none');

    while (result.functionCalls?.length) {
      const responses = await Promise.all(
        result.functionCalls.map(async (call) => {
          try {
            if (call.name === 'getBookings') {
              const args = call.args as any;
              const data = await this.bookingsService.findAll({
                hotelId,
                status: args.status,
                dateFrom: args.dateFrom,
                dateTo: args.dateTo,
                search: args.search,
                page: 1,
                limit: 20,
              });
              return { name: call.name, response: { content: data.items.map((b: any) => ({
                id: b.id, status: b.status, checkIn: b.checkIn, checkOut: b.checkOut,
                guest: `${b.guest?.firstName} ${b.guest?.lastName}`,
                rooms: b.bookingRooms?.map((br: any) => ({ roomId: br.roomId, roomNumber: br.room?.roomNumber })),
              })) } };
            }

            if (call.name === 'getTodayActions') {
              const [checkIns, checkOuts] = await Promise.all([
                this.bookingsService.findAll({ hotelId, status: 'CONFIRMED' as any, dateFrom: today, page: 1, limit: 50 }),
                this.bookingsService.findAll({ hotelId, status: 'CHECKED_IN' as any, page: 1, limit: 50 }),
              ]);
              const todayCheckIns = checkIns.items.filter((b: any) => b.checkIn?.split('T')[0] === today);
              console.log('[AI getTodayActions] today:', today);
              console.log('[AI getTodayActions] raw checkIns:', checkIns.items.map((b: any) => ({ id: b.id, checkIn: b.checkIn, split: b.checkIn?.split('T')[0] })));
              console.log('[AI getTodayActions] filtered checkIns count:', todayCheckIns.length);
              const todayCheckouts = checkOuts.items.filter((b: any) => b.checkOut?.split('T')[0] === today);
              return { name: call.name, response: { content: {
                checkIns: todayCheckIns.map((b: any) => ({
                  id: b.id, guest: `${b.guest?.firstName} ${b.guest?.lastName}`, checkIn: b.checkIn,
                  rooms: b.bookingRooms?.map((br: any) => ({ roomId: br.roomId, roomNumber: br.room?.roomNumber })),
                })),
                checkOuts: todayCheckouts.map((b: any) => ({
                  id: b.id, guest: `${b.guest?.firstName} ${b.guest?.lastName}`, checkOut: b.checkOut,
                  rooms: b.bookingRooms?.map((br: any) => ({ roomId: br.roomId, roomNumber: br.room?.roomNumber })),
                })),
              } } };
            }

            if (call.name === 'updateBookingStatus') {
              const { bookingId, action } = call.args as any;
              if (action === 'checkin') {
                await this.bookingsService.checkin(bookingId, hotelId, userId);
              } else if (action === 'checkout') {
                await this.bookingsService.checkout(bookingId, hotelId, userId);
              } else if (action === 'confirm') {
                await this.bookingsService.confirm(bookingId, `staff-${Date.now()}`, hotelId, userId);
              } else if (action === 'cancel') {
                await this.bookingsService.cancel(bookingId, hotelId, undefined, userId);
              }
              return { name: call.name, response: { content: { success: true, bookingId, action } } };
            }

            if (call.name === 'updateRoomStatus') {
              const { roomId, status } = call.args as any;
              await this.roomsService.updateStatus(roomId, status as RoomStatus, hotelId);
              return { name: call.name, response: { content: { success: true, roomId, status } } };
            }

            return { name: call.name, response: { error: 'Unknown function' } };
          } catch (err) {
            this.logger.error(`Staff AI tool error [${call.name}]: ${err.message}`);
            return { name: call.name, response: { error: err.message } };
          }
        }),
      );

      result = await chat.sendMessage({
        message: responses.map((r) => ({ functionResponse: r })),
      });
    }

    return { text: result.text || 'No response generated' };
  }
}
