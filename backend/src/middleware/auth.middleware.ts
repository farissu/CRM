import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        role: string;
        companyId: string;
      };
    }
  }
}

/**
 * Middleware to authenticate JWT token
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // Get agent with company from database
    const agent = await prisma.agent.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        companyId: true,
        isActive: true
      }
    });

    if (!agent || !agent.isActive) {
      return res.status(401).json({ error: 'Invalid token or inactive account' });
    }

    // Set user in request
    req.user = {
      id: agent.id,
      email: agent.email,
      name: agent.name,
      role: agent.role,
      companyId: agent.companyId
    };

    next();
  } catch (error: any) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Middleware to check if user is Super Admin
 */
export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Forbidden: Super Admin access required' });
  }
  next();
};

/**
 * Middleware to check if user is Admin or Super Admin
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  next();
};
