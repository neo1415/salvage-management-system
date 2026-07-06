/**
 * Report Distribution Service
 * 
 * Handles report delivery via email and archiving
 * Task 29: Report Scheduling System
 */

import { emailService } from '@/features/notifications/services/email.service';
import { getEmailBranding, getSupportEmail, getSupportPhone } from '@/features/notifications/templates/email-branding';
import { wrapProfessionalEmail } from '@/features/notifications/templates/wrap-professional-email';
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
    const body = await this.generateEmailBody(delivery);

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
  private static async generateEmailBody(delivery: ReportDelivery): Promise<string> {
    const branding = await getEmailBranding();
    const supportEmail = getSupportEmail(branding);
    const supportPhone = getSupportPhone(branding);
    const periodText = delivery.period
      ? `<p><strong>Period:</strong> ${new Date(delivery.period.startDate).toLocaleDateString('en-NG')} to ${new Date(delivery.period.endDate).toLocaleDateString('en-NG')}</p>`
      : '';

    return wrapProfessionalEmail(
      `${delivery.reportName} Generated`,
      `
        <h2 style="color: ${branding.primaryColor};">${delivery.reportName}</h2>
        <p>Your scheduled report has been generated and is attached to this email.</p>
        ${periodText}
        <p><strong>Generated:</strong> ${delivery.generatedAt.toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}</p>
        <p><strong>Format:</strong> ${delivery.format.toUpperCase()}</p>
        <p>Please find the report attached to this email. If you have any questions or need assistance, contact ${supportEmail}${supportPhone ? ` or ${supportPhone}` : ''}.</p>
        <p style="font-size: 12px; color: #666;">This is an automated email from ${branding.brandName}. Please do not reply to this message.</p>
      `,
      `${delivery.reportName} from ${branding.brandName}`
    );
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
    _metadata: unknown
  ): Promise<string> {
    // Scale extension: archive scheduled reports to cloud storage when retention is finalized.
    // For now, just return a placeholder archive ID
    console.log(`[ReportDistribution] Archiving report ${reportId} (${reportData.length} bytes)`);
    return `archive-${reportId}-${Date.now()}`;
  }
}
