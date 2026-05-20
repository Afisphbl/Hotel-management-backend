import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  LocaleSetting,
  DateFormat,
  TimeFormat,
  FirstDayOfWeek,
} from '../../database/entities/global/locale-setting.entity';

@Injectable()
export class LocaleService {
  constructor(
    @InjectRepository(LocaleSetting)
    private localeRepository: Repository<LocaleSetting>,
  ) {}

  async findByHotel(hotelId: string): Promise<LocaleSetting> {
    const locale = await this.localeRepository.findOne({ where: { hotelId } });
    if (locale) return locale;
    return this.createDefault(hotelId);
  }

  async upsert(hotelId: string, data: Partial<LocaleSetting>): Promise<LocaleSetting> {
    let locale = await this.localeRepository.findOne({ where: { hotelId } });
    if (locale) {
      Object.assign(locale, data);
    } else {
      locale = this.localeRepository.create({ hotelId, ...data });
    }
    return this.localeRepository.save(locale);
  }

  async findAll(): Promise<LocaleSetting[]> {
    return this.localeRepository.find({ relations: ['hotel'] });
  }

  private async createDefault(hotelId: string): Promise<LocaleSetting> {
    const locale = this.localeRepository.create({
      hotelId,
      language: 'en',
      dateFormat: DateFormat.DD_MM_YYYY,
      timeFormat: TimeFormat.TWENTY_FOUR_HOUR,
      timezone: 'UTC',
      currency: 'GBP',
      firstDayOfWeek: FirstDayOfWeek.MONDAY,
      supportedLanguages: ['en'],
    });
    return this.localeRepository.save(locale);
  }
}
