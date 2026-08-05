import { Request, Response } from 'express';
import { broadcastService } from '../services/broadcast.service';

type AuthRequest = Request & { user?: { id?: string; companyId?: string } };
type UploadRequest = Request & { file?: { buffer: Buffer } };

const VALID_AUDIENCE_TYPES = new Set(['SINGLE_NUMBER', 'CSV']);

export const broadcastController = {
  async getBroadcasts(req: Request, res: Response) {
    try {
      const companyId = (req as AuthRequest).user?.companyId;
      if (!companyId) return res.status(400).json({ error: 'Company ID required' });

      const { status, search, page, limit } = req.query as {
        status?: string;
        search?: string;
        page?: string;
        limit?: string;
      };

      const result = await broadcastService.getBroadcasts(companyId, {
        status,
        search,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      return res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to get broadcasts';
      return res.status(500).json({ error: message });
    }
  },

  async getBroadcastById(req: Request, res: Response) {
    try {
      const companyId = (req as AuthRequest).user?.companyId;
      if (!companyId) return res.status(400).json({ error: 'Company ID required' });

      const broadcast = await broadcastService.getBroadcastById(req.params.id, companyId);
      return res.json({ broadcast });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to get broadcast';
      const status = message === 'Broadcast not found' ? 404 : 500;
      return res.status(status).json({ error: message });
    }
  },

  async createBroadcast(req: Request, res: Response) {
    try {
      const authReq = req as AuthRequest & UploadRequest;
      const companyId = authReq.user?.companyId;
      if (!companyId) return res.status(400).json({ error: 'Company ID required' });

      const { name, label, templateId, audienceType, phoneNumber, recipientName, variables, csvSeparator, scheduledAt } =
        req.body as {
          name?: string;
          label?: string;
          templateId?: string;
          audienceType?: string;
          phoneNumber?: string;
          recipientName?: string;
          variables?: string;
          csvSeparator?: string;
          scheduledAt?: string;
        };

      if (!name || !templateId || !audienceType) {
        return res.status(400).json({ error: 'name, templateId, and audienceType are required' });
      }

      if (!VALID_AUDIENCE_TYPES.has(audienceType)) {
        return res.status(400).json({ error: 'audienceType must be SINGLE_NUMBER or CSV' });
      }

      const broadcast = await broadcastService.createBroadcast({
        companyId,
        createdById: authReq.user?.id,
        name,
        label,
        templateId,
        audienceType: audienceType as 'SINGLE_NUMBER' | 'CSV',
        phoneNumber,
        recipientName,
        variables: variables ? (JSON.parse(variables) as Record<string, string>) : undefined,
        csvBuffer: authReq.file?.buffer,
        csvSeparator,
        scheduledAt,
      });

      return res.status(201).json({ broadcast });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create broadcast';
      return res.status(400).json({ error: message });
    }
  },

  async sendTest(req: Request, res: Response) {
    try {
      const companyId = (req as AuthRequest).user?.companyId;
      if (!companyId) return res.status(400).json({ error: 'Company ID required' });

      const { templateId, to, bodyParams } = req.body as { templateId?: string; to?: string; bodyParams?: string[] };
      if (!templateId || !to) {
        return res.status(400).json({ error: 'templateId and to are required' });
      }

      const result = await broadcastService.sendTestMessage({ templateId, companyId, to, bodyParams });
      return res.json(result);
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: { message?: string } } } };
      const metaMessage = axiosError.response?.data?.error?.message;
      const message = metaMessage ?? (error instanceof Error ? error.message : 'Failed to send test message');
      return res.status(400).json({ error: message });
    }
  },

  async downloadCsvTemplate(req: Request, res: Response) {
    try {
      const companyId = (req as AuthRequest).user?.companyId;
      if (!companyId) return res.status(400).json({ error: 'Company ID required' });

      const { filename, content } = await broadcastService.getCsvTemplateContent(req.params.templateId, companyId);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(content);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to build CSV template';
      const status = message === 'Template not found' ? 404 : 500;
      return res.status(status).json({ error: message });
    }
  },

  async cancelBroadcast(req: Request, res: Response) {
    try {
      const companyId = (req as AuthRequest).user?.companyId;
      if (!companyId) return res.status(400).json({ error: 'Company ID required' });

      const broadcast = await broadcastService.cancelBroadcast(req.params.id, companyId);
      return res.json({ broadcast });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to cancel broadcast';
      const status = message === 'Broadcast not found' ? 404 : 400;
      return res.status(status).json({ error: message });
    }
  },
};
