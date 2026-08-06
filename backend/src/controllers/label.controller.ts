import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { emitContactLabelUpdate, getContactWithLabels } from '../services/label.service';

const prisma = new PrismaClient();

export const labelController = {
  // Get all labels
  async getLabels(req: Request, res: Response) {
    try {
      const labels = await prisma.label.findMany({
        orderBy: { createdAt: 'asc' },
        include: {
          _count: {
            select: { contacts: true }
          }
        }
      });
      res.json({ labels });
    } catch (err: unknown) {
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
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2002') {
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
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2025') {
        return res.status(404).json({ error: 'Label not found' });
      }
      if ((err as { code?: string }).code === 'P2002') {
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
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2025') {
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

      const contact = await getContactWithLabels(contactId);
      await emitContactLabelUpdate(contactId);

      res.json({ contact });
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2002') {
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

      const contact = await getContactWithLabels(contactId);
      await emitContactLabelUpdate(contactId);

      res.json({ contact });
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2025') {
        return res.status(404).json({ error: 'Label assignment not found' });
      }
      res.status(500).json({ error: 'Failed to remove label' });
    }
  },

  // Get contact labels
  async getContactLabels(req: Request, res: Response) {
    try {
      const { contactId } = req.params;

      const contact = await getContactWithLabels(contactId);

      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      const labels = contact.labels.map((cl) => cl.label);
      res.json({ labels });
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to fetch contact labels' });
    }
  },

  // Assign label to contact, looked up by WhatsApp phone number (for external integrations like n8n)
  async assignLabelToContactByPhone(req: Request, res: Response) {
    try {
      const { phoneNumber, labelId } = req.body;

      if (!phoneNumber || !labelId) {
        return res.status(400).json({ error: 'phoneNumber and labelId are required' });
      }

      const existingContact = await prisma.contact.findUnique({ where: { phoneNumber } });
      if (!existingContact) {
        return res.status(404).json({ error: 'Contact not found for this phoneNumber' });
      }

      await prisma.contactLabel.create({
        data: { contactId: existingContact.id, labelId },
      });

      const contact = await getContactWithLabels(existingContact.id);
      await emitContactLabelUpdate(existingContact.id);

      res.json({ contact });
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2002') {
        return res.status(400).json({ error: 'Label already assigned to this contact' });
      }
      res.status(500).json({ error: 'Failed to assign label' });
    }
  },

  // Remove label from contact, looked up by WhatsApp phone number (for external integrations like n8n)
  async removeLabelFromContactByPhone(req: Request, res: Response) {
    try {
      const { phoneNumber, labelId } = req.body;

      if (!phoneNumber || !labelId) {
        return res.status(400).json({ error: 'phoneNumber and labelId are required' });
      }

      const existingContact = await prisma.contact.findUnique({ where: { phoneNumber } });
      if (!existingContact) {
        return res.status(404).json({ error: 'Contact not found for this phoneNumber' });
      }

      await prisma.contactLabel.delete({
        where: {
          contactId_labelId: {
            contactId: existingContact.id,
            labelId,
          },
        },
      });

      const contact = await getContactWithLabels(existingContact.id);
      await emitContactLabelUpdate(existingContact.id);

      res.json({ contact });
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2025') {
        return res.status(404).json({ error: 'Label assignment not found' });
      }
      res.status(500).json({ error: 'Failed to remove label' });
    }
  },

  // Get labels for a contact, looked up by WhatsApp phone number (for external integrations like n8n)
  async getContactLabelsByPhone(req: Request, res: Response) {
    try {
      const { phoneNumber } = req.params;

      const contact = await prisma.contact.findUnique({
        where: { phoneNumber },
        include: {
          labels: {
            include: {
              label: true,
            },
          },
        },
      });

      if (!contact) {
        return res.status(404).json({ error: 'Contact not found for this phoneNumber' });
      }

      const labels = contact.labels.map((cl) => cl.label);
      res.json({ labels });
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to fetch contact labels' });
    }
  },
};
