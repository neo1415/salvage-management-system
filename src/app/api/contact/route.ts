import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, message } = body;

    // Validate required fields
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Send email to noreply@nemsalvage.com
    await resend.emails.send({
      from: 'NEM Salvage Contact Form <noreply@nemsalvage.com>',
      to: 'noreply@nemsalvage.com',
      replyTo: email,
      subject: `Contact Form Submission from ${name}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Contact Form Submission</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                      <td style="background: linear-gradient(135deg, #800020 0%, #600018 100%); padding: 30px; text-align: center;">
                        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">
                          New Contact Form Submission
                        </h1>
                      </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                      <td style="padding: 40px 30px;">
                        <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                          You have received a new message from the NEM Salvage website contact form.
                        </p>

                        <!-- Contact Details -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                          <tr>
                            <td style="padding: 15px; background-color: #f9f9f9; border-left: 4px solid #800020;">
                              <p style="margin: 0 0 10px; color: #666666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">
                                <strong>Name</strong>
                              </p>
                              <p style="margin: 0; color: #333333; font-size: 16px;">
                                ${name}
                              </p>
                            </td>
                          </tr>
                          <tr><td style="height: 10px;"></td></tr>
                          <tr>
                            <td style="padding: 15px; background-color: #f9f9f9; border-left: 4px solid #800020;">
                              <p style="margin: 0 0 10px; color: #666666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">
                                <strong>Email</strong>
                              </p>
                              <p style="margin: 0; color: #333333; font-size: 16px;">
                                <a href="mailto:${email}" style="color: #800020; text-decoration: none;">${email}</a>
                              </p>
                            </td>
                          </tr>
                          ${phone ? `
                          <tr><td style="height: 10px;"></td></tr>
                          <tr>
                            <td style="padding: 15px; background-color: #f9f9f9; border-left: 4px solid #800020;">
                              <p style="margin: 0 0 10px; color: #666666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">
                                <strong>Phone</strong>
                              </p>
                              <p style="margin: 0; color: #333333; font-size: 16px;">
                                ${phone}
                              </p>
                            </td>
                          </tr>
                          ` : ''}
                          <tr><td style="height: 10px;"></td></tr>
                          <tr>
                            <td style="padding: 15px; background-color: #f9f9f9; border-left: 4px solid #800020;">
                              <p style="margin: 0 0 10px; color: #666666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">
                                <strong>Message</strong>
                              </p>
                              <p style="margin: 0; color: #333333; font-size: 16px; line-height: 1.6; white-space: pre-wrap;">
                                ${message}
                              </p>
                            </td>
                          </tr>
                        </table>

                        <p style="margin: 30px 0 0; padding: 20px; background-color: #fff8e1; border-radius: 4px; color: #856404; font-size: 14px; line-height: 1.6;">
                          <strong>💡 Quick Action:</strong> You can reply directly to this email to respond to ${name}.
                        </p>
                      </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                      <td style="padding: 30px; background-color: #f9f9f9; text-align: center; border-top: 1px solid #e0e0e0;">
                        <p style="margin: 0 0 10px; color: #666666; font-size: 14px;">
                          <strong>NEM Insurance Salvage Management System</strong>
                        </p>
                        <p style="margin: 0; color: #999999; font-size: 12px;">
                          199 Ikorodu Road, Obanikoro, Lagos, Nigeria
                        </p>
                        <p style="margin: 10px 0 0; color: #999999; font-size: 12px;">
                          This email was sent from the contact form on the NEM Salvage website.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
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
