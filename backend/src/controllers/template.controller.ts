import { Request, Response } from 'express';
import { templateService } from '../services/template.service';
import { TemplateCategory } from '@prisma/client';

const VALID_CATEGORIES = new Set<string>(['MARKETING', 'UTILITY', 'AUTHENTICATION']);
const VALID_COMPONENT_TYPES = new Set<string>(['HEADER', 'BODY', 'FOOTER', 'BUTTONS']);

type AuthRequest = Request & { user?: { companyId?: string } };
type UploadRequest = Request & { file?: { buffer: Buffer; mimetype: string } };

const VALID_HEADER_MEDIA_MIME_TYPES = new Set<string>([
  'image/jpeg', 'image/png',
  'video/mp4', 'video/3gpp',
  'application/pdf',
]);

export const templateController = {
  async uploadHeaderMedia(req: Request, res: Response) {
    try {
      const file = (req as UploadRequest).file;
      if (!file) return res.status(400).json({ error: 'file is required' });

      if (!VALID_HEADER_MEDIA_MIME_TYPES.has(file.mimetype)) {
        return res.status(400).json({ error: `Unsupported file type: ${file.mimetype}` });
      }

      const handle = await templateService.uploadHeaderMedia(file.buffer, file.mimetype);
      return res.json({ handle });
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: { message?: string } } } };
      const metaMessage = axiosError.response?.data?.error?.message;
      const message = metaMessage ?? (error instanceof Error ? error.message : 'Failed to upload media');
      return res.status(500).json({ error: message });
    }
  },

  async getTemplates(req: Request, res: Response) {
    try {
      const companyId = (req as AuthRequest).user?.companyId;
      if (!companyId) return res.status(400).json({ error: 'Company ID required' });

      const templates = await templateService.getTemplates(companyId);
      return res.json({ templates });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to get templates';
      return res.status(500).json({ error: message });
    }
  },

  async createTemplate(req: Request, res: Response) {
    try {
      const companyId = (req as AuthRequest).user?.companyId;
      if (!companyId) return res.status(400).json({ error: 'Company ID required' });

      const { name, language, category, components } = req.body as {
        name?: string;
        language?: string;
        category?: string;
        components?: Array<{ type?: string }>;
      };

      if (!name || !language || !category || !components) {
        return res.status(400).json({ error: 'name, language, category, and components are required' });
      }

      if (!/^[a-z0-9_]+$/.test(name)) {
        return res.status(400).json({ error: 'Template name must contain only lowercase letters, numbers, and underscores' });
      }

      if (!VALID_CATEGORIES.has(category)) {
        return res.status(400).json({ error: 'category must be MARKETING, UTILITY, or AUTHENTICATION' });
      }

      if (!Array.isArray(components) || components.length === 0) {
        return res.status(400).json({ error: 'components must be a non-empty array' });
      }

      if (!components.some(c => c.type === 'BODY')) {
        return res.status(400).json({ error: 'Template must have a BODY component' });
      }

      if (components.some(c => !VALID_COMPONENT_TYPES.has(c.type ?? ''))) {
        return res.status(400).json({ error: 'Invalid component type found' });
      }

      const template = await templateService.createTemplate({
        companyId,
        name,
        language,
        category: category as TemplateCategory,
        components: components as Parameters<typeof templateService.createTemplate>[0]['components'],
      });

      return res.status(201).json({ template });
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: { message?: string } } } };
      const metaMessage = axiosError.response?.data?.error?.message;
      const message = metaMessage ?? (error instanceof Error ? error.message : 'Failed to create template');
      return res.status(500).json({ error: message });
    }
  },

  async syncTemplates(req: Request, res: Response) {
    try {
      const companyId = (req as AuthRequest).user?.companyId;
      if (!companyId) return res.status(400).json({ error: 'Company ID required' });

      const templates = await templateService.syncFromMeta(companyId);
      return res.json({ templates });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to sync templates';
      return res.status(500).json({ error: message });
    }
  },

  async deleteTemplate(req: Request, res: Response) {
    try {
      const companyId = (req as AuthRequest).user?.companyId;
      if (!companyId) return res.status(400).json({ error: 'Company ID required' });

      const { id } = req.params;
      await templateService.deleteTemplate(id, companyId);
      return res.json({ message: 'Template deleted successfully' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete template';
      const status = message === 'Template not found' ? 404 : 500;
      return res.status(status).json({ error: message });
    }
  },
};
