import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { EmailService, SendOptions } from './EmailService';
import { config } from '../../config';

class NodemailerService implements EmailService {
  private transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: false,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });

  async send({ to, subject, body }: SendOptions): Promise<void> {
    await this.transporter.sendMail({
      from: config.smtp.from,
      to: to.join(', '),
      subject,
      text: body,
    });
  }
}

class ResendEmailService implements EmailService {
  private client = new Resend(process.env.RESEND_API_KEY);

  async send({ to, subject, body }: SendOptions): Promise<void> {
    const { error } = await this.client.emails.send({
      from: config.smtp.from,
      to,
      subject,
      text: body,
    });
    if (error) throw new Error(error.message);
  }
}

export const emailService: EmailService = process.env.RESEND_API_KEY
  ? new ResendEmailService()
  : new NodemailerService();
