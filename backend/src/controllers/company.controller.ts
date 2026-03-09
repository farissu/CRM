import { Request, Response } from 'express';
import prisma from '../config/database';

// Get all companies (filtered by user's company for non-Super Admin)
export const getAllCompanies = async (req: Request, res: Response) => {
  try {
    const userRole = req.user?.role;
    const userCompanyId = req.user?.companyId;

    // Super Admin sees all companies, others see only their company
    const whereClause = userRole === 'SUPER_ADMIN' ? {} : { id: userCompanyId };

    const companies = await prisma.company.findMany({
      where: whereClause,
      include: {
        agents: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return res.json({ companies });
  } catch (error) {
    console.error('Get companies error:', error);
    return res.status(500).json({ error: 'Failed to get companies' });
  }
};

// Get company by ID
export const getCompanyById = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        agents: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            avatar: true,
            phone: true,
            createdAt: true,
          }
        }
      }
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    return res.json({ company });
  } catch (error) {
    console.error('Get company error:', error);
    return res.status(500).json({ error: 'Failed to get company' });
  }
};

// Create company (Super Admin only)
export const createCompany = async (req: Request, res: Response) => {
  try {
    const { name, brand, address, businessEntities, businessType, email, phone, logo } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    const company = await prisma.company.create({
      data: {
        name,
        brand,
        address,
        businessEntities,
        businessType,
        email,
        phone,
        logo,
      }
    });

    return res.status(201).json({ company });
  } catch (error) {
    console.error('Create company error:', error);
    return res.status(500).json({ error: 'Failed to create company' });
  }
};

// Update company (Super Admin only)
export const updateCompany = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const { name, brand, address, businessEntities, businessType, email, phone, logo, webhookUrl, webhookCallbackUrl, isActive } = req.body;

    const company = await prisma.company.update({
      where: { id: companyId },
      data: {
        ...(name && { name }),
        ...(brand !== undefined && { brand }),
        ...(address !== undefined && { address }),
        ...(businessEntities !== undefined && { businessEntities }),
        ...(businessType !== undefined && { businessType }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(logo !== undefined && { logo }),
        ...(webhookUrl !== undefined && { webhookUrl }),
        ...(webhookCallbackUrl !== undefined && { webhookCallbackUrl }),
        ...(isActive !== undefined && { isActive }),
      }
    });

    return res.json({ company });
  } catch (error) {
    console.error('Update company error:', error);
    return res.status(500).json({ error: 'Failed to update company' });
  }
};

// Delete company (Super Admin only)
export const deleteCompany = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;

    // Check if company has agents
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        agents: true
      }
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    if (company.agents.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete company with active agents. Please reassign or remove agents first.' 
      });
    }

    await prisma.company.delete({
      where: { id: companyId }
    });

    return res.json({ message: 'Company deleted successfully' });
  } catch (error) {
    console.error('Delete company error:', error);
    return res.status(500).json({ error: 'Failed to delete company' });
  }
};
