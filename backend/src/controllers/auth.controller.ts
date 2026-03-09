import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export class AuthController {
  /**
   * POST /api/auth/login
   */
  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      // Find agent by email
      const agent = await prisma.agent.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          password: true,
          name: true,
          role: true,
          phone: true,
          companyId: true,
          isActive: true
        }
      });

      if (!agent) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      if (!agent.isActive) {
        return res.status(401).json({ error: 'Account is inactive' });
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(password, agent.password);

      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          id: agent.id,
          email: agent.email,
          name: agent.name,
          role: agent.role,
          companyId: agent.companyId
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Return agent data and token
      res.json({
        token,
        agent: {
          id: agent.id,
          email: agent.email,
          name: agent.name,
          role: agent.role,
          phone: agent.phone,
          companyId: agent.companyId
        }
      });
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(500).json({
        error: 'Login failed',
        message: error.message
      });
    }
  }

  /**
   * GET /api/auth/me
   */
  async me(req: Request, res: Response) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const decoded = jwt.verify(token, JWT_SECRET) as any;

      const agent = await prisma.agent.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          phone: true,
          companyId: true,
          isActive: true
        }
      });

      if (!agent || !agent.isActive) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      res.json({ agent });
    } catch (error: any) {
      console.error('Auth verification error:', error);
      res.status(401).json({ error: 'Invalid token' });
    }
  }
}

export const authController = new AuthController();
