/**
 * Report Distribution Service
 * 
 * Handles report delivery via email and archiving
 * Task 29: Report Scheduling System
 */

import { emailService } from '@/features/notifications/services/email.service';
import { ExportFormat } from '../../types';

export interface ReportDelivery {
  reportType: string;
  reportName: string;
  recipients: string[];
  format: ExportFormat;
  reportData: Buffer;
  generatedAt: Date;
  period?: {
    startDate: string;
    endDate: string;
  };
}

export class ReportDistributionService {
  /**
   * Distribute report to recipients via email
   */
  static async distributeReport(delivery: ReportDelivery): Promise<{
    success: boolean;
    delivered: number;
    failed: number;
    errors: string[];
  }> {
    const results = {
      success: true,
      delivered: 0,
      failed: 0,
      errors: [] as string[],
    };

    const fileName = this.generateFileName(delivery.reportType, delivery.format, delivery.generatedAt);
    const mimeType = this.getMimeType(delivery.format);

    for (const recipient of delivery.recipients) {
      try {
        await this.sendReportEmail(recipient, delivery, fileName, mimeType);
        results.delivered++;
      } catch (error) {
        results.failed++;
        results.success = false;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Failed to send to ${recipient}: ${errorMessage}`);
        console.error(`[ReportDistribution] Failed to send report to ${recipient}:`, error);
      }
    }

    return results;
  }

  /**
   * Send report email to a single recipient
   */
  private static async sendReportEmail(
    recipient: string,
    delivery: ReportDelivery,
    fileName: string,
    mimeType: string
  ): Promise<void> {
    const subject = this.generateEmailSubject(delivery);
    const body = this.generateEmailBody(delivery);

    // Convert Buffer to base64 for email attachment
    const attachmentContent = delivery.reportData.toString('base64');

    await emailService.sendEmail({
      to: recipient,
      subject,
      html: body,
      attachments: [
        {
          filename: fileName,
          content: attachmentContent,
          encoding: 'base64',
          contentType: mimeType,
        },
      ],
    });
  }

  /**
   * Generate email subject
   */
  private static generateEmailSubject(delivery: ReportDelivery): string {
    const date = delivery.generatedAt.toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return `${delivery.reportName} - ${date}`;
  }

  /**
   * Generate email body HTML
   */
  private static generateEmailBody(delivery: ReportDelivery): string {
    const periodText = delivery.period
      ? `<p><strong>Period:</strong> ${new Date(delivery.period.startDate).toLocaleDateString('en-NG')} to ${new Date(delivery.period.endDate).toLocaleDateString('en-NG')}</p>`
      : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #0066cc;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 5px 5px 0 0;
          }
          .content {
            background-color: #f9f9f9;
            padding: 30px;
            border: 1px solid #ddd;
            border-top: none;
            border-radius: 0 0 5px 5px;
          }
          .footer {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-size: 12px;
            color: #666;
            text-align: center;
          }
          .button {
            display: inline-block;
            padding: 10px 20px;
            background-color: #0066cc;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin-top: 15px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>NEM Insurance Salvage Report</h1>
          </div>
          <div class="content">
            <h2>${delivery.reportName}</h2>
            <p>Your scheduled report has been generated and is attached to this email.</p>
            ${periodText}
            <p><strong>Generated:</strong> ${delivery.generatedAt.toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}</p>
            <p><strong>Format:</strong> ${delivery.format.toUpperCase()}</p>
            <p>Please find the report attached to this email. If you have any questions or need assistance, please contact our support team.</p>
          </div>
          <div class="footer">
            <p>NEM Insurance Plc<br>
            199 Ikorodu Road, Obanikoro, Lagos<br>
            Phone: 234-02-014489560</p>
            <p>This is an automated email. Please do not reply to this message.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate file name for report
   */
  private static generateFileName(
    reportType: string,
    format: ExportFormat,
    generatedAt: Date
  ): string {
    const timestamp = generatedAt.toISOString().split('T')[0]; // YYYY-MM-DD
    const sanitizedType = reportType.replace(/[^a-z0-9-]/gi, '-');
    const extension = this.getFileExtension(format);

    return `${sanitizedType}-${timestamp}.${extension}`;
  }

  /**
   * Get file extension for format
   */
  private static getFileExtension(format: ExportFormat): string {
    const extensions: Record<ExportFormat, string> = {
      pdf: 'pdf',
      excel: 'xlsx',
      csv: 'csv',
      json: 'json',
    };

    return extensions[format] || 'pdf';
  }

  /**
   * Get MIME type for format
   */
  private static getMimeType(format: ExportFormat): string {
    const mimeTypes: Record<ExportFormat, string> = {
      pdf: 'application/pdf',
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      csv: 'text/csv',
      json: 'application/json',
    };

    return mimeTypes[format] || 'application/octet-stream';
  }

  /**
   * Archive report (placeholder for future implementation)
   */
  static async archiveReport(
    reportId: string,
    reportData: Buffer,
    metadata: any
  ): Promise<string> {
    // TODO: Implement report archiving to cloud storage (S3, Azure Blob, etc.)
    // For now, just return a placeholder archive ID
    console.log(`[ReportDistribution] Archiving report ${reportId} (${reportData.length} bytes)`);
    return `archive-${reportId}-${Date.now()}`;
  }
}
