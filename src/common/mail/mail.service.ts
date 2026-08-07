import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.configService.get<string>('MAIL_USER'),
        pass: this.configService.get<string>('MAIL_PASS'),
      },
    });
  }

  async sendMail(to: string, subject: string, text: string, html?: string) {
    const mailOptions = {
      from: `"Grovr" <${this.configService.get<string>('MAIL_USER')}>`,
      to,
      subject,
      text,
      html,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);

      this.logger.log(`Email sent successfully: ${info.messageId}`);

      return info;
    } catch (error: any) {
      this.logger.error(`Failed to send email: ${error.message}`);

      throw new InternalServerErrorException('Failed to send email');
    }
  }

  async sendOtpMail(
    email: string,
    otp: string,
    type: 'registration' | 'forgot-password' = 'registration',
  ) {
    const isRegistration = type === 'registration';

    const subject = isRegistration
      ? 'Verify Your Email'
      : 'Reset Your Password';

    const title = isRegistration ? 'Email Verification' : 'Password Reset';

    const description = isRegistration
      ? 'Use the OTP below to verify your email address.'
      : 'Use the OTP below to reset your password.';

    const textBody = `
${title}

Your OTP Code: ${otp}

This OTP will expire in 10 minutes.

If you did not request this email, please ignore it.
`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${subject}</title>
</head>

<body style="
  margin:0;
  padding:0;
  background:#f4f7fb;
  font-family:Arial,sans-serif;
">

  <table width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center" style="padding:40px 20px;">

        <table
          width="600"
          cellspacing="0"
          cellpadding="0"
          style="
            background:#ffffff;
            border-radius:16px;
            overflow:hidden;
            box-shadow:0 4px 20px rgba(0,0,0,0.08);
          "
        >

          <!-- Header -->
          <tr>
            <td
              align="center"
              style="
                background:#111827;
                padding:30px;
                color:#ffffff;
              "
            >
              <h1 style="
                margin:0;
                font-size:28px;
              ">
                Grovr
              </h1>

              <p style="
                margin-top:10px;
                font-size:14px;
                opacity:0.8;
              ">
                Secure Authentication System
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:40px;">

              <h2 style="
                margin-top:0;
                color:#111827;
                font-size:24px;
              ">
                ${title}
              </h2>

              <p style="
                color:#4b5563;
                font-size:16px;
                line-height:1.6;
              ">
                ${description}
              </p>

              <!-- OTP Box -->
              <div style="
                margin:35px 0;
                text-align:center;
              ">

                <div style="
                  display:inline-block;
                  background:#f3f4f6;
                  padding:18px 40px;
                  border-radius:12px;
                  border:2px dashed #d1d5db;
                ">

                  <span style="
                    font-size:36px;
                    letter-spacing:10px;
                    font-weight:bold;
                    color:#111827;
                  ">
                    ${otp}
                  </span>

                </div>

              </div>

              <p style="
                color:#ef4444;
                font-size:14px;
                margin-top:20px;
              ">
                This OTP will expire in 10 minutes.
              </p>

              <p style="
                color:#6b7280;
                font-size:14px;
                line-height:1.6;
                margin-top:30px;
              ">
                If you did not request this email,
                you can safely ignore it.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td
              align="center"
              style="
                background:#f9fafb;
                padding:25px;
                font-size:13px;
                color:#9ca3af;
              "
            >
              © 2026 Grovr. All rights reserved.
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
`;

    return await this.sendMail(email, subject, textBody, htmlBody);
  }
}
