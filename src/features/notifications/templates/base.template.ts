/**
 * Base Email Template
 * Provides consistent styling and structure for all email templates
 */

export interface BaseTemplateProps {
  title: string;
  preheader?: string;
  content: string;
}

export function getBaseEmailTemplate(props: BaseTemplateProps): string {
  const { title, preheader, content } = props;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const logoUrl = `${appUrl}/icons/Nem-insurance-Logo.jpg`;
  
  return `
    <!DOCTYPE html>
    <html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="x-apple-disable-message-reformatting">
        <title>${title}</title>
        ${preheader ? `<div style="display: none; max-height: 0px; overflow: hidden;">${preheader}</div>` : ''}
        <!--[if mso]>
        <style type="text/css">
          body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
        </style>
        <![endif]-->
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
            width: 100% !important;
            -webkit-text-size-adjust: 100%;
            -ms-text-size-adjust: 100%;
          }
          table {
            border-collapse: collapse;
            mso-table-lspace: 0pt;
            mso-table-rspace: 0pt;
          }
          img {
            border: 0;
            height: auto;
            line-height: 100%;
            outline: none;
            text-decoration: none;
            -ms-interpolation-mode: bicubic;
          }
          .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
          }
          .header {
            background: linear-gradient(135deg, #800020 0%, #a00028 100%);
            padding: 30px 20px;
            text-align: center;
          }
          .logo-container {
            background-color: #ffffff;
            padding: 20px;
            border-radius: 12px;
            display: inline-block;
            margin-bottom: 20px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .logo {
            max-width: 180px;
            height: auto;
            display: block;
          }
          .header-title {
            color: #ffffff;
            font-size: 24px;
            font-weight: 700;
            margin: 15px 0 0 0;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          }
          .content {
            padding: 40px 30px;
          }
          .content p {
            margin: 0 0 16px 0;
            font-size: 16px;
            line-height: 1.6;
          }
          .content strong {
            color: #800020;
          }
          .button {
            display: inline-block;
            padding: 16px 32px;
            background: linear-gradient(135deg, #FFD700 0%, #FFC700 100%);
            color: #800020 !important;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 700;
            font-size: 16px;
            text-align: center;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease;
          }
          .button:hover {
            box-shadow: 0 6px 8px rgba(0, 0, 0, 0.15);
            transform: translateY(-2px);
          }
          .divider {
            height: 1px;
            background: linear-gradient(to right, transparent, #e0e0e0, transparent);
            margin: 30px 0;
          }
          .footer {
            background-color: #f9f9f9;
            padding: 30px 20px;
            text-align: center;
            border-top: 3px solid #FFD700;
          }
          .footer-logo {
            max-width: 120px;
            height: auto;
            margin-bottom: 15px;
          }
          .footer-text {
            font-size: 14px;
            color: #666666;
            margin: 8px 0;
          }
          .footer-link {
            color: #800020;
            text-decoration: none;
            font-weight: 600;
          }
          .footer-link:hover {
            text-decoration: underline;
          }
          .social-links {
            margin: 20px 0;
          }
          .social-link {
            display: inline-block;
            margin: 0 8px;
            color: #800020;
            text-decoration: none;
            font-size: 14px;
          }
          @media only screen and (max-width: 600px) {
            .email-container {
              width: 100% !important;
            }
            .content {
              padding: 30px 20px !important;
            }
            .header {
              padding: 25px 15px !important;
            }
            .header-title {
              font-size: 20px !important;
            }
            .logo {
              max-width: 150px !important;
            }
            .button {
              display: block !important;
              width: 100% !important;
              padding: 14px 20px !important;
            }
          }
        </style>
      </head>
      <body>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f4;">
          <tr>
            <td style="padding: 20px 0;">
              <table role="presentation" class="email-container" cellspacing="0" cellpadding="0" border="0" align="center" width="600">
                <!-- Header -->
                <tr>
                  <td class="header">
                    <div class="logo-container">
                      <img src="${logoUrl}" alt="NEM Insurance" class="logo" />
                    </div>
                    <h1 class="header-title">${title}</h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td class="content">
                    ${content}
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td class="footer">
                    <img src="${logoUrl}" alt="NEM Insurance" class="footer-logo" />
                    <p class="footer-text"><strong>NEM Insurance Plc</strong></p>
                    <p class="footer-text">199 Ikorodu Road, Obanikoro, Lagos, Nigeria</p>
                    <p class="footer-text">
                      📞 <a href="tel:+2340201448956" class="footer-link">234-02-014489560</a> | 
                      📧 <a href="mailto:nemsupport@nem-insurance.com" class="footer-link">nemsupport@nem-insurance.com</a>
                    </p>
                    <div class="divider"></div>
                    <p class="footer-text" style="font-size: 12px; color: #999999;">
                      This is an automated email from NEM Insurance Salvage Management System.<br>
                      Please do not reply to this message.
                    </p>
                    <p class="footer-text" style="font-size: 11px; color: #999999; margin-top: 15px;">
                      © ${new Date().getFullYear()} NEM Insurance Plc. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}
