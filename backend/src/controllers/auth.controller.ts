import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { wappinAuthService } from '../services/wappin-auth.service';

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

      // Login to Wappin API and get token for this agent
      let wappinToken: string | null = null;
      try {
        wappinToken = await wappinAuthService.loginForAgent(agent.id);
        console.log(`✓ Wappin authentication successful for agent ${agent.id}`);
      } catch (wappinError: any) {
        console.error('Wappin login failed:', wappinError.message);
        // Continue with CRM login even if Wappin fails
        // This allows agents to still access the CRM if Wappin is down
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
        },
        wappinAuthenticated: !!wappinToken
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

  /**
   * POST /api/auth/logout
   */
  async logout(req: Request, res: Response) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const decoded = jwt.verify(token, JWT_SECRET) as any;

      // Logout from Wappin (delete token from Redis)
      try {
        await wappinAuthService.logoutAgent(decoded.id);
        console.log(`✓ Agent ${decoded.id} logged out from Wappin`);
      } catch (wappinError: any) {
        console.error('Failed to logout from Wappin:', wappinError.message);
        // Continue even if Wappin logout fails
      }

      res.json({ 
        message: 'Logged out successfully',
        agentId: decoded.id
      });
    } catch (error: any) {
      console.error('Logout error:', error);
      res.status(500).json({
        error: 'Logout failed',
        message: error.message
      });
    }
  }
}

export const authController = new AuthController();
