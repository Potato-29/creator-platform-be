import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('server.mail.host'),
      port: Number(this.configService.get('server.mail.port')),
      secure: (this.configService.get('server.mail.secure').toLowerCase() === 'true'),
      auth: {
        user: this.configService.get('server.mail.user'),
        pass: this.configService.get('server.mail.password'),
      },
    });
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    const resetUrl = `${this.configService.get<string>('server.frontendUrl')}/reset-password?token=${resetToken}`;
    const mailOptions = {
      from: this.configService.get<string>('server.mail.from'),
      to: email,
      subject: 'Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>You requested a password reset for your account.</p>
          <p>Click the link below to reset your password:</p>
          <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this password reset, please ignore this email.</p>
        </div>
      `,
    };
    try {
      return await this.transporter.sendMail(mailOptions);
    } catch (err) {
      throw err
    }
  }

  async sendVerificationEmail(email: string, verificationCode: string, frontendUrl: string, userName: string): Promise<void> {
    const verificationUrl = `${frontendUrl}/verify-email?code=${verificationCode}`;
    
    const mailOptions = {
      from: this.configService.get<string>('server.mail.from'),
      to: email,
      subject: 'Email Verification',
      html: `
      <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Email Verification</title>
            </head>
            <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                <div style="max-width: 90%; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                  <div style="padding: 40px 30px;">
                    <div style="margin-bottom: 30px;">
                      <p style="color: #333333; font-size: 18px; margin: 0 0 10px 0; font-weight: 500;">
                        Hi ${userName},
                      </p>
                      <p style="font-size: 16px; line-height: 1.6;">Thank you for signing up! Please verify your email address by clicking the button below:</p>
                      <div style="text-align: center; margin: 40px 0;">
                        <a href="${verificationUrl}" 
                           style="display: inline-block; 
                                  padding: 15px 30px; 
                                  background: linear-gradient(135deg, #9807a7, #c13cc4); 
                                  color: #333333; 
                                  text-decoration: none; 
                                  border-radius: 25px; 
                                  font-size: 16px; 
                                  font-weight: 500; 
                                  letter-spacing: 0.5px;
                                  box-shadow: 0 4px 15px rgba(152, 7, 167, 0.3);
                                  transition: all 0.3s ease;">
                          Verify Email
                        </a>
                      </div>

                      <p style="font-size: 16px; line-height: 1.6;">This link will expire in 10 minutes.</p>
                      <p style="font-size: 16px; line-height: 1.6;">If the button doesn't work, you can copy and paste this link into your browser:</p>
                      <a href="${verificationUrl}" style="font-size: 16px; line-height: 1.6;text-decoration: underline;">${verificationUrl}</a>
                    </div>
                  </div>
                </div>
            </body>
        </html>
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }

  async sendStepNotification(name: string, email: string, subject: string, success: boolean, overviewUrl: string, stepNotify?: string): Promise<void> {
    const mailOptions = {
      from: this.configService.get<string>('server.mail.from'),
      to: email,
      subject: subject,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${subject}</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
            <div style="max-width: 90%; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #9807a7, #c13cc4); padding: 40px 30px; text-align: center;">
                    <div style="background-color: #ffffff; width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        ${success
          ? '<div style="color: #28a745; font-size: 24px; font-weight: bold;">✓</div>'
          : '<div style="color: #ffc107; font-size: 24px; font-weight: bold;">⚠</div>'
        }
                    </div>
                    <h1 style="color: #333333; margin: 0; font-size: 28px; font-weight: 300; letter-spacing: 1px;">
                        ${success ? 'Verification Update' : 'Action Required'}
                    </h1>
                </div>

                <!-- Content -->
                <div style="padding: 40px 30px;">
                    <div style="margin-bottom: 30px;">
                        <p style="color: #333333; font-size: 18px; margin: 0 0 10px 0; font-weight: 500;">
                            Hi ${name},
                        </p>
                        
                        ${success
          ? `<div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 20px; margin: 20px 0; border-radius: 4px;">
                                 <p style="color: #155724; margin: 0; font-size: 16px; line-height: 1.6;">
                                   <strong>Great news!</strong> ${stepNotify || 'You have successfully completed your verification step for the Online Payment Platform (OPP).'} Your account is one step closer to being fully activated.
                                 </p>
                               </div>`
          : `<div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0; border-radius: 4px;">
                                 <p style="color: #856404; margin: 0 0 15px 0; font-size: 16px; line-height: 1.6;">
                                   We've reviewed your application for the Online Payment Platform (OPP). ${stepNotify || 'Additional information is required to continue your verification process.'}
                                 </p>
                                 <p style="color: #856404; margin: 0; font-size: 16px; line-height: 1.6;">
                                   Please log in to your account and provide the required information to continue your onboarding process.
                                 </p>
                               </div>`
        }
                    </div>

                    <!-- Action Button -->
                    <div style="text-align: center; margin: 40px 0;">
                        <a href="${overviewUrl}" 
                           style="display: inline-block; 
                                  padding: 15px 30px; 
                                  background: linear-gradient(135deg, #9807a7, #c13cc4); 
                                  color: #333333; 
                                  text-decoration: none; 
                                  border-radius: 25px; 
                                  font-size: 16px; 
                                  font-weight: 500; 
                                  letter-spacing: 0.5px;
                                  box-shadow: 0 4px 15px rgba(152, 7, 167, 0.3);
                                  transition: all 0.3s ease;">
                            ${success ? 'Go to Dashboard' : 'Continue Verification'}
                        </a>
                    </div>

                    <!-- Additional Info -->
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 30px 0;">
                        <p style="color: #6c757d; margin: 0; font-size: 14px; line-height: 1.5;">
                            <strong>Need help?</strong> If you have any questions about the verification process, our support team is here to assist you. Simply contact us via <a href="https://onlinepaymentplatform.com/support">https://onlinepaymentplatform.com/support</a>.
                        </p>
                    </div>

                    <!-- Closing -->
                    <div style="border-top: 1px solid #dee2e6; padding-top: 30px; margin-top: 30px;">
                        <p style="color: #333333; margin: 0 0 10px 0; font-size: 16px;">
                            ${success ? 'Welcome aboard!' : 'Thank you for your patience,'}
                        </p>
                        <p style="color: #6c757d; margin: 0; font-size: 14px; font-weight: 500;">
                            Creator Platform Support Team
                        </p>
                    </div>
                </div>

                <!-- Footer -->
                <div style="background-color: #f8f9fa; padding: 20px 30px; border-top: 1px solid #dee2e6;">
                    <div style="text-align: center;">
                        <p style="color: #6c757d; margin: 0 0 10px 0; font-size: 12px; line-height: 1.4;">
                            This is an automated message from Creator Platform. Please do not reply to this email.
                        </p>
                        <p style="color: #6c757d; margin: 0; font-size: 12px;">
                            © ${new Date().getFullYear()} Creator Platform. All rights reserved.
                        </p>
                    </div>
                </div>
            </div>

            <!-- Mobile Responsiveness -->
            <style>
                @media only screen and (max-width: 600px) {
                    .email-container {
                        width: 100% !important;
                        max-width: 100% !important;
                    }
                    .email-content {
                        padding: 20px !important;
                    }
                    .email-header {
                        padding: 30px 20px !important;
                    }
                    .email-button {
                        display: block !important;
                        width: 80% !important;
                        margin: 20px auto !important;
                    }
                }
            </style>
        </body>
        </html>
      `,
    };
    await this.transporter.sendMail(mailOptions);
  }
}