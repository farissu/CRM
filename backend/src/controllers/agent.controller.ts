import { Request, Response } from 'express';
import prisma from '../config/database';
import bcrypt from 'bcrypt';

// Update agent profile
export const updateProfile = async (req: Request, res: Response) => {
  try {
    const agentId = req.user?.id;
    if (!agentId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, email, phone, avatar } = req.body;

    // Check if email is already taken by another user
    if (email) {
      const existingAgent = await prisma.agent.findFirst({
        where: {
          email,
          id: { not: agentId }
        }
      });

      if (existingAgent) {
        return res.status(400).json({ error: 'Email already in use' });
      }
    }

    // Update agent
    const updatedAgent = await prisma.agent.update({
      where: { id: agentId },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(phone !== undefined && { phone }),
        ...(avatar !== undefined && { avatar }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        phone: true,
      }
    });

    return res.json({ agent: updatedAgent });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
};

// Change password
export const changePassword = async (req: Request, res: Response) => {
  try {
    const agentId = req.user?.id;
    if (!agentId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Get agent with password
    const agent = await prisma.agent.findUnique({
      where: { id: agentId }
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, agent.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.agent.update({
      where: { id: agentId },
      data: { password: hashedPassword }
    });

    return res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ error: 'Failed to change password' });
  }
};

// Get all agents (filtered by company for non-Super Admin)
export const getAllAgents = async (req: Request, res: Response) => {
  try {
    const userRole = req.user?.role;
    const userCompanyId = req.user?.companyId;

    // Super Admin sees all agents, others see only their company
    const whereClause = userRole === 'SUPER_ADMIN' ? {} : { companyId: userCompanyId };

    const agents = await prisma.agent.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        phone: true,
        isActive: true,
        createdAt: true,
        companyId: true,
        company: {
          select: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return res.json({ agents });
  } catch (error) {
    console.error('Get agents error:', error);
    return res.status(500).json({ error: 'Failed to get agents' });
  }
};

// Create agent (Super Admin only)
export const createAgent = async (req: Request, res: Response) => {
  try {
    const { email, password, name, role, companyId, phone, avatar } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    if (!companyId) {
      return res.status(400).json({ error: 'Company is required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if email already exists
    const existingAgent = await prisma.agent.findUnique({
      where: { email }
    });

    if (existingAgent) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const newAgent = await prisma.agent.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: role || 'AGENT',
        companyId,
        phone,
        avatar,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        phone: true,
        companyId: true,
        company: {
          select: {
            id: true,
            name: true,
          }
        },
        isActive: true,
        createdAt: true,
      }
    });

    return res.status(201).json({ agent: newAgent });
  } catch (error) {
    console.error('Create agent error:', error);
    return res.status(500).json({ error: 'Failed to create agent' });
  }
};

// Update agent (Super Admin only)
export const updateAgent = async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const { name, email, phone, avatar, role, companyId, isActive } = req.body;

    // Check if email is already taken by another user
    if (email) {
      const existingAgent = await prisma.agent.findFirst({
        where: {
          email,
          id: { not: agentId }
        }
      });

      if (existingAgent) {
        return res.status(400).json({ error: 'Email already in use' });
      }
    }

    const updatedAgent = await prisma.agent.update({
      where: { id: agentId },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(phone !== undefined && { phone }),
        ...(avatar !== undefined && { avatar }),
        ...(role && { role }),
        ...(companyId !== undefined && { companyId }),
        ...(isActive !== undefined && { isActive }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        phone: true,
        companyId: true,
        company: {
          select: {
            id: true,
            name: true,
          }
        },
        isActive: true,
        createdAt: true,
      }
    });

    return res.json({ agent: updatedAgent });
  } catch (error) {
    console.error('Update agent error:', error);
    return res.status(500).json({ error: 'Failed to update agent' });
  }
};

// Delete agent (Super Admin only)
export const deleteAgent = async (req: Request, res: Response) => {
  try {
    const currentAgentId = req.user?.id;
    const { agentId } = req.params;

    // Prevent deleting yourself
    if (agentId === currentAgentId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await prisma.agent.delete({
      where: { id: agentId }
    });

    return res.json({ message: 'Agent deleted successfully' });
  } catch (error) {
    console.error('Delete agent error:', error);
    return res.status(500).json({ error: 'Failed to delete agent' });
  }
};

// Update agent role (Super Admin only)
export const updateAgentRole = async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const { role } = req.body;

    if (!['SUPER_ADMIN', 'ADMIN', 'AGENT'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const updatedAgent = await prisma.agent.update({
      where: { id: agentId },
      data: { role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        phone: true,
      }
    });

    return res.json({ agent: updatedAgent });
  } catch (error) {
    console.error('Update agent role error:', error);
    return res.status(500).json({ error: 'Failed to update agent role' });
  }
};
