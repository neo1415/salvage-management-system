import { Resend } from 'resend';

// Validate required environment variables
if (!process.env.RESEND_API_KEY) {
  console.warn('RESEND_API_KEY is not set. Email functionality will be disabled.');
}

if (!process.env.EMAIL_FROM) {
  console.warn('EMAIL_FROM is not set. Using default sender address.');
}

// Initialize Resend with a dummy key if not configured (for testing)
const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key_for_testing');

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Email Service
 * Production-ready email service with error handling, logging, and retry logic
 */
export class EmailService {
  private readonly fromAddress: string;
  private readonly maxRetries: number = 3;
  private readonly retryDelay: number = 1000; // 1 second
  private readonly supportEmail: string = 'nemsupport@nem-insurance.com';
  private readonly supportPhone: string = '234-02-014489560';

  constructor() {
    this.fromAddress = process.env.EMAIL_FROM || 'NEM Insurance <noreply@salvage.nem-insurance.com>';
  }

  /**
   * Send welcome email to new user
   * @param email - User email address
   * @param fullName - User full name
   * @returns Email result with success status
   */
  async sendWelcomeEmail(email: string, fullName: string): Promise<EmailResult> {
    try {
      // Validate inputs
      if (!email || !fullName) {
        throw new Error('Email and fullName are required');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Invalid email format');
      }

      const result = await this.sendEmailWithRetry({
        to: email,
        subject: 'Welcome to NEM Insurance Salvage Management System',
        html: this.getWelcomeEmailTemplate(fullName),
        replyTo: this.supportEmail,
      });

      if (result.success) {
        console.log(`Welcome email sent successfully to ${email} (Message ID: ${result.messageId})`);
      } else {
        console.error(`Failed to send welcome email to ${email}: ${result.error}`);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Welcome email error:', errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Send email with retry logic
   * @param options - Email options
   * @returns Email result
   */
  private async sendEmailWithRetry(options: EmailOptions): Promise<EmailResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // Check if API key is configured
        if (!process.env.RESEND_API_KEY) {
          console.warn('Email not sent: RESEND_API_KEY not configured');
          return {
            success: false,
            error: 'Email service not configured',
          };
        }

        const response = await resend.emails.send({
          from: this.fromAddress,
          to: options.to,
          subject: options.subject,
          html: options.html,
          replyTo: options.replyTo,
        });

        // Resend returns { data: { id: string } } on success or { error: object } on failure
        if (response.data && 'id' in response.data) {
          return {
            success: true,
            messageId: response.data.id,
          };
        } else if (response.error) {
          throw new Error(JSON.stringify(response.error));
        } else {
          throw new Error('Unexpected response from email service');
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`Email send attempt ${attempt}/${this.maxRetries} failed:`, lastError.message);

        // Wait before retrying (exponential backoff)
        if (attempt < this.maxRetries) {
          await this.sleep(this.retryDelay * attempt);
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Failed to send email after multiple attempts',
    };
  }

  /**
   * Get welcome email HTML template
   * @param fullName - User full name
   * @returns HTML email template
   */
  private getWelcomeEmailTemplate(fullName: string): string {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://salvage.nem-insurance.com';
    
    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to NEM Insurance Salvage Management System</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              margin: 0;
              padding: 0;
              background-color: #f5f5f5;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background-color: #ffffff;
            }
            .header {
              background-color: #800020;
              color: white;
              padding: 30px 20px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 600;
            }
            .content {
              padding: 30px 20px;
            }
            .content p {
              margin: 0 0 15px 0;
            }
            .steps {
              background-color: #f9f9f9;
              border-left: 4px solid #FFD700;
              padding: 15px 20px;
              margin: 20px 0;
            }
            .steps ol {
              margin: 10px 0;
              padding-left: 20px;
            }
            .steps li {
              margin: 8px 0;
            }
            .button {
              display: inline-block;
              padding: 14px 28px;
              background-color: #FFD700;
              color: #800020;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 600;
              margin: 20px 0;
              text-align: center;
            }
            .button:hover {
              background-color: #FFC700;
            }
            .button-container {
              text-align: center;
              margin: 30px 0;
            }
            .support-info {
              background-color: #f9f9f9;
              padding: 20px;
              border-radius: 6px;
              margin: 20px 0;
            }
            .support-info h3 {
              margin: 0 0 10px 0;
              font-size: 16px;
              color: #800020;
            }
            .support-info ul {
              list-style: none;
              padding: 0;
              margin: 0;
            }
            .support-info li {
              margin: 8px 0;
            }
            .footer {
              text-align: center;
              padding: 20px;
              font-size: 12px;
              color: #666;
              background-color: #f5f5f5;
              border-top: 1px solid #e0e0e0;
            }
            .footer p {
              margin: 5px 0;
            }
            @media only screen and (max-width: 600px) {
              .header h1 {
                font-size: 20px;
              }
              .content {
                padding: 20px 15px;
              }
              .button {
                display: block;
                width: 100%;
                box-sizing: border-box;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to NEM Insurance<br>Salvage Management System</h1>
            </div>
            
            <div class="content">
              <p><strong>Dear ${this.escapeHtml(fullName)},</strong></p>
              
              <p>Thank you for registering with NEM Insurance Salvage Management System! Your account has been created successfully.</p>
              
              <div class="steps">
                <h3 style="margin-top: 0; color: #800020;">Next Steps to Start Bidding:</h3>
                <ol>
                  <li><strong>Verify your phone number</strong> via SMS OTP</li>
                  <li><strong>Complete Tier 1 KYC verification</strong> with your BVN (Bank Verification Number)</li>
                  <li><strong>Browse available auctions</strong> and start bidding on salvage items</li>
                </ol>
              </div>
              
              <div class="button-container">
                <a href="${appUrl}/login" class="button">Login to Your Account</a>
              </div>
              
              <div class="support-info">
                <h3>Need Help?</h3>
                <p>Our support team is here to assist you:</p>
                <ul>
                  <li>📞 Phone: ${this.supportPhone}</li>
                  <li>📧 Email: ${this.supportEmail}</li>
                  <li>📍 Address: 199 Ikorodu Road, Obanikoro, Lagos</li>
                </ul>
              </div>
              
              <p style="margin-top: 30px;">Best regards,<br><strong>NEM Insurance Team</strong></p>
            </div>
            
            <div class="footer">
              <p><strong>NEM Insurance Plc</strong></p>
              <p>199 Ikorodu Road, Obanikoro, Lagos, Nigeria</p>
              <p style="margin-top: 15px;">This is an automated email. Please do not reply to this message.</p>
              <p>If you did not create this account, please contact us immediately.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Send generic email
   * @param options - Email options
   * @returns Email result
   */
  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    try {
      // Validate inputs
      if (!options.to || !options.subject || !options.html) {
        throw new Error('Email to, subject, and html are required');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(options.to)) {
        throw new Error('Invalid email format');
      }

      const result = await this.sendEmailWithRetry(options);

      if (result.success) {
        console.log(`Email sent successfully to ${options.to} (Message ID: ${result.messageId})`);
      } else {
        console.error(`Failed to send email to ${options.to}: ${result.error}`);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Email send error:', errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Escape HTML to prevent XSS
   * @param text - Text to escape
   * @returns Escaped text
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (char) => map[char]);
  }

  /**
   * Sleep for specified milliseconds
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Validate email service configuration
   * @returns True if email service is properly configured
   */
  isConfigured(): boolean {
    return !!process.env.RESEND_API_KEY;
  }
}

export const emailService = new EmailService();
