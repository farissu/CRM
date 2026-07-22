import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import prisma from '../config/database';

const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

export class AuthController {
  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      const agent = await prisma.agent.findUnique({
        where: { email },
        select: { id: true, email: true, password: true, name: true, role: true, phone: true, companyId: true, isActive: true, mustChangePassword: true }
      });

      if (!agent) return res.status(401).json({ error: 'Invalid credentials' });
      if (!agent.isActive) return res.status(401).json({ error: 'Account is inactive' });

      const isPasswordValid = await bcrypt.compare(password, agent.password);
      if (!isPasswordValid) return res.status(401).json({ error: 'Invalid credentials' });

      await prisma.agent.update({ where: { id: agent.id }, data: { lastLoginAt: new Date() } });

      const token = jwt.sign(
        { id: agent.id, email: agent.email, name: agent.name, role: agent.role, companyId: agent.companyId },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        token,
        agent: {
          id: agent.id, email: agent.email, name: agent.name, role: agent.role,
          phone: agent.phone, companyId: agent.companyId, mustChangePassword: agent.mustChangePassword
        }
      });
    } catch (err: unknown) {
      res.status(500).json({ error: 'Login failed', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  async me(req: Request, res: Response) {
    // req.user is populated by the `authenticate` middleware
    res.json({ agent: req.user });
  }

  async logout(req: Request, res: Response) {
    res.json({ message: 'Logged out successfully', agentId: req.user?.id });
  }

  async saveWhatsAppToken(req: Request, res: Response) {
    const { accessToken } = req.body as { accessToken: string };
    if (!accessToken) { res.status(400).json({ error: 'accessToken required' }); return; }

    const appId = process.env.WHATSAPP_APP_ID;
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (!appId || !appSecret) { res.status(500).json({ error: 'WhatsApp app credentials not configured' }); return; }

    try {
      const longRes = await axios.get<{ access_token: string }>(
        'https://graph.facebook.com/v19.0/oauth/access_token',
        { params: { grant_type: 'fb_exchange_token', client_id: appId, client_secret: appSecret, fb_exchange_token: accessToken } }
      );
      const longToken = longRes.data.access_token;

      const envPath = path.join(__dirname, '../../.env');
      const envContent = fs.readFileSync(envPath, 'utf8')
        .replace(/WHATSAPP_ACCESS_TOKEN=.*/, `WHATSAPP_ACCESS_TOKEN=${longToken}`);
      fs.writeFileSync(envPath, envContent);
      process.env.WHATSAPP_ACCESS_TOKEN = longToken;

      res.json({ success: true });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to exchange token' });
    }
  }
}

export const authController = new AuthController();
