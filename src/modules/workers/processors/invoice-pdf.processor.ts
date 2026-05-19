import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { PdfGeneratorService } from '../services/pdf-generator.service';
import { NotificationService } from '../services/notification.service';

@Processor('invoice-pdf')
export class InvoicePdfProcessor extends WorkerHost {
  private readonly logger = new Logger(InvoicePdfProcessor.name);

  constructor(
    private pdfGenerator: PdfGeneratorService,
    private notificationService: NotificationService,
  ) {
    super();
  }

  async process(
    job: Job<{ invoiceId: string; notifyUser?: boolean; userId?: string }>,
  ): Promise<any> {
    const { invoiceId, notifyUser, userId } = job.data;

    this.logger.log(`Generating PDF for invoice ${invoiceId}`);

    try {
      const pdf = await this.pdfGenerator.generateInvoicePdf(invoiceId);

      this.logger.log(
        `PDF generated: ${pdf.filename} (${pdf.content.length} bytes)`,
      );

      if (notifyUser && userId) {
        await this.notificationService.send({
          userId,
          type: 'invoice_ready' as any,
          title: 'Invoice Ready',
          body: `Your invoice ${pdf.filename} is ready for download.`,
          data: { invoiceId, filename: pdf.filename },
        });
      }

      return { invoiceId, filename: pdf.filename, size: pdf.content.length };
    } catch (err) {
      this.logger.error(
        `Failed to generate PDF for invoice ${invoiceId}: ${err.message}`,
      );
      throw err;
    }
  }
}
