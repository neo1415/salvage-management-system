import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { brandLegalName, getEmailBranding, getSupportEmail } from '@/features/notifications/templates/email-branding';
import { wrapProfessionalEmail } from '@/features/notifications/templates/wrap-professional-email';

const resend = new Resend(process.env.RESEND_API_KEY);
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, message } = body;

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    const branding = await getEmailBranding();
    const supportEmail = getSupportEmail(branding);
    const recipient = process.env.CONTACT_FORM_TO_EMAIL || supportEmail;
    const from = process.env.CONTACT_FORM_FROM_EMAIL
      || process.env.EMAIL_FROM
      || `${branding.brandName} Contact Form <${supportEmail}>`;

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safePhone = phone ? escapeHtml(phone) : '';
    const safeMessage = escapeHtml(message);

    await resend.emails.send({
      from,
      to: recipient,
      replyTo: email,
      subject: `Contact Form Submission from ${safeName}`,
      html: await wrapProfessionalEmail(
        'New Contact Form Submission',
        `
          <p>You have received a new message from the ${branding.brandName} website contact form.</p>
          <div style="background-color: #f9f9f9; border-left: 4px solid ${branding.primaryColor}; padding: 15px; margin: 16px 0;">
            <p style="margin: 0 0 8px; color: #666666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;"><strong>Name</strong></p>
            <p style="margin: 0;">${safeName}</p>
          </div>
          <div style="background-color: #f9f9f9; border-left: 4px solid ${branding.primaryColor}; padding: 15px; margin: 16px 0;">
            <p style="margin: 0 0 8px; color: #666666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;"><strong>Email</strong></p>
            <p style="margin: 0;"><a href="mailto:${safeEmail}" style="color: ${branding.primaryColor}; text-decoration: none;">${safeEmail}</a></p>
          </div>
          ${safePhone ? `<div style="background-color: #f9f9f9; border-left: 4px solid ${branding.primaryColor}; padding: 15px; margin: 16px 0;"><p style="margin: 0 0 8px; color: #666666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;"><strong>Phone</strong></p><p style="margin: 0;">${safePhone}</p></div>` : ''}
          <div style="background-color: #f9f9f9; border-left: 4px solid ${branding.primaryColor}; padding: 15px; margin: 16px 0;">
            <p style="margin: 0 0 8px; color: #666666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;"><strong>Message</strong></p>
            <p style="margin: 0; white-space: pre-wrap;">${safeMessage}</p>
          </div>
          <p style="margin: 24px 0 0; padding: 16px; background-color: #fff8e1; border-radius: 4px; color: #856404; font-size: 14px;">You can reply directly to this email to respond to ${safeName}.</p>
          <p style="font-size: 12px; color: #999999;">${brandLegalName(branding)}</p>
        `,
        `New message from ${safeName}.`
      ),
    });

    return NextResponse.json(
      { message: 'Email sent successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };

    return entities[char] ?? char;
  });
}
