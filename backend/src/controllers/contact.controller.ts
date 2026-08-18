import { Request, Response } from 'express';
import { contactService } from '../services/contact.service';

export const contactController = {
  /**
   * GET /api/contacts/export
   */
  async exportContacts(req: Request, res: Response) {
    try {
      const { labelId } = req.query as { labelId?: string };
      const buffer = await contactService.exportContacts({ labelId });

      const filename = `contacts_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(buffer);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to export contacts';
      return res.status(500).json({ error: message });
    }
  },
};
