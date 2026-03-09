import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { io } from '../index';

const prisma = new PrismaClient();

export const labelController = {
  // Get all labels
  async getLabels(req: Request, res: Response) {
    try {
      const labels = await prisma.label.findMany({
        orderBy: { createdAt: 'asc' },
      });
      res.json({ labels });
    } catch (error) {
      console.error('Error fetching labels:', error);
      res.status(500).json({ error: 'Failed to fetch labels' });
    }
  },

  // Create a new label
  async createLabel(req: Request, res: Response) {
    try {
      const { name, color } = req.body;

      if (!name || !color) {
        return res.status(400).json({ error: 'Name and color are required' });
      }

      const label = await prisma.label.create({
        data: { name, color },
      });

      res.status(201).json({ label });
    } catch (error: any) {
      console.error('Error creating label:', error);
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Label name already exists' });
      }
      res.status(500).json({ error: 'Failed to create label' });
    }
  },

  // Update a label
  async updateLabel(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, color } = req.body;

      const label = await prisma.label.update({
        where: { id },
        data: { name, color },
      });

      res.json({ label });
    } catch (error: any) {
      console.error('Error updating label:', error);
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Label not found' });
      }
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Label name already exists' });
      }
      res.status(500).json({ error: 'Failed to update label' });
    }
  },

  // Delete a label
  async deleteLabel(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await prisma.label.delete({
        where: { id },
      });

      res.json({ message: 'Label deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting label:', error);
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Label not found' });
      }
      res.status(500).json({ error: 'Failed to delete label' });
    }
  },

  // Assign label to contact
  async assignLabelToContact(req: Request, res: Response) {
    try {
      const { contactId, labelId } = req.body;

      if (!contactId || !labelId) {
        return res.status(400).json({ error: 'Contact ID and Label ID are required' });
      }

      await prisma.contactLabel.create({
        data: { contactId, labelId },
      });

      // Get updated contact with labels
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        include: {
          labels: {
            include: {
              label: true,
            },
          },
        },
      });

      // Get conversations for this contact and emit updates
      const conversations = await prisma.conversation.findMany({
        where: { contactId },
        include: {
          contact: {
            include: {
              labels: {
                include: {
                  label: true,
                },
              },
            },
          },
          assignedAgent: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // Emit socket event for each conversation
      conversations.forEach((conv) => {
        const transformedConv = {
          ...conv,
          contact: {
            ...conv.contact,
            labels: conv.contact.labels.map(cl => cl.label),
          },
        };
        io.emit('conversation_updated', transformedConv);
      });

      res.json({ contact });
    } catch (error: any) {
      console.error('Error assigning label:', error);
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Label already assigned to this contact' });
      }
      res.status(500).json({ error: 'Failed to assign label' });
    }
  },

  // Remove label from contact
  async removeLabelFromContact(req: Request, res: Response) {
    try {
      const { contactId, labelId } = req.body;

      if (!contactId || !labelId) {
        return res.status(400).json({ error: 'Contact ID and Label ID are required' });
      }

      await prisma.contactLabel.delete({
        where: {
          contactId_labelId: {
            contactId,
            labelId,
          },
        },
      });

      // Get updated contact with labels
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        include: {
          labels: {
            include: {
              label: true,
            },
          },
        },
      });

      // Get conversations for this contact and emit updates
      const conversations = await prisma.conversation.findMany({
        where: { contactId },
        include: {
          contact: {
            include: {
              labels: {
                include: {
                  label: true,
                },
              },
            },
          },
          assignedAgent: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // Emit socket event for each conversation
      conversations.forEach((conv) => {
        const transformedConv = {
          ...conv,
          contact: {
            ...conv.contact,
            labels: conv.contact.labels.map(cl => cl.label),
          },
        };
        io.emit('conversation_updated', transformedConv);
      });

      res.json({ contact });
    } catch (error: any) {
      console.error('Error removing label:', error);
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Label assignment not found' });
      }
      res.status(500).json({ error: 'Failed to remove label' });
    }
  },

  // Get contact labels
  async getContactLabels(req: Request, res: Response) {
    try {
      const { contactId } = req.params;

      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        include: {
          labels: {
            include: {
              label: true,
            },
          },
        },
      });

      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      const labels = contact.labels.map((cl) => cl.label);
      res.json({ labels });
    } catch (error) {
      console.error('Error fetching contact labels:', error);
      res.status(500).json({ error: 'Failed to fetch contact labels' });
    }
  },
};
