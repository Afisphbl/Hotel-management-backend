import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from '../../../database/entities/invoice.entity';
import { Booking } from '../../../database/entities/booking.entity';

export interface GeneratedPdf {
  filename: string;
  content: Buffer;
  contentType: string;
}

@Injectable()
export class PdfGeneratorService {
  private readonly logger = new Logger(PdfGeneratorService.name);

  constructor(
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
  ) {}

  async generateInvoicePdf(invoiceId: string): Promise<GeneratedPdf> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId },
      relations: ['booking'],
    });

    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    const html = this.renderInvoiceHtml(invoice);
    const buffer = Buffer.from(html, 'utf-8');

    this.logger.log(
      `PDF generated for invoice ${invoice.invoiceNumber || invoiceId}`,
    );

    return {
      filename: `invoice-${invoice.invoiceNumber || invoiceId}.html`,
      content: buffer,
      contentType: 'text/html',
    };
  }

  private renderInvoiceHtml(invoice: Invoice): string {
    const num = invoice.invoiceNumber || invoice.id.slice(0, 8).toUpperCase();
    const items = (invoice.lineItems || [])
      .map(
        (item) => `
        <tr>
          <td>${item.description}</td>
          <td>${item.quantity}</td>
          <td>$${Number(item.unitPrice).toFixed(2)}</td>
          <td>$${Number(item.total).toFixed(2)}</td>
        </tr>`,
      )
      .join('');

    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Invoice ${num}</title></head>
<body style="font-family:Arial;max-width:800px;margin:0 auto;padding:20px;">
  <h1>INVOICE</h1>
  <p><strong>Invoice #:</strong> ${num}</p>
  <p><strong>Status:</strong> ${invoice.status}</p>
  <p><strong>Date:</strong> ${invoice.createdAt.toISOString().split('T')[0]}</p>
  <p><strong>Due Date:</strong> ${invoice.dueDate ? invoice.dueDate.toISOString().split('T')[0] : 'N/A'}</p>
  <hr>
  <table style="width:100%;border-collapse:collapse;">
    <tr style="background:#f5f5f5;">
      <th style="text-align:left;padding:8px;">Description</th>
      <th style="text-align:right;padding:8px;">Qty</th>
      <th style="text-align:right;padding:8px;">Unit Price</th>
      <th style="text-align:right;padding:8px;">Total</th>
    </tr>
    ${items}
  </table>
  <hr>
  <p><strong>Subtotal:</strong> $${Number(invoice.subtotal || invoice.amount).toFixed(2)}</p>
  <p><strong>Tax:</strong> $${Number(invoice.taxTotal).toFixed(2)}</p>
  <p style="font-size:1.2em;"><strong>Total:</strong> $${Number(invoice.amount).toFixed(2)} ${invoice.currency}</p>
</body>
</html>`;
  }
}
