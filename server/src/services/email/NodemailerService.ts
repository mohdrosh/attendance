import nodemailer from 'nodemailer';
import { EmailService, SendOptions } from './EmailService';
import { config } from '../../config';

export class NodemailerService implements EmailService {
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

export const emailService: EmailService = new NodemailerService();
