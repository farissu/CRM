import axios from 'axios';
import { PrismaClient, TemplateCategory, TemplateStatus } from '@prisma/client';

const prisma = new PrismaClient();
const GRAPH_API_URL = 'https://graph.facebook.com/v19.0';

export interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  example?: { header_handle?: string[]; body_text?: string[][] };
  buttons?: Array<{
    type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
    text: string;
    url?: string;
    phone_number?: string;
  }>;
}

export interface CreateTemplateDto {
  companyId: string;
  name: string;
  language: string;
  category: TemplateCategory;
  components: TemplateComponent[];
}

interface MetaTemplateResponse {
  id: string;
  status: string;
}

interface MetaTemplatesListResponse {
  data: Array<{
    id: string;
    name: string;
    language: string;
    status: string;
    category: string;
    components: TemplateComponent[];
    quality_score?: { score: string };
    rejected_reason?: string;
  }>;
}

const TEMPLATE_LIST_FIELDS = 'name,language,status,category,components,quality_score,rejected_reason';

interface MetaUploadSessionResponse {
  id: string;
}

interface MetaUploadResultResponse {
  h: string;
}

export class TemplateService {
  private get wabaId(): string {
    return process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';
  }

  private get accessToken(): string {
    return process.env.WHATSAPP_ACCESS_TOKEN || '';
  }

  private get appId(): string {
    return process.env.WHATSAPP_APP_ID || '';
  }

  /**
   * Uploads header media (image/video/document) via Meta's resumable Upload API and
   * returns a file handle usable as a template's HEADER component.example.header_handle.
   */
  async uploadHeaderMedia(buffer: Buffer, mimeType: string): Promise<string> {
    if (!this.appId || !this.accessToken) {
      throw new Error('WHATSAPP_APP_ID and WHATSAPP_ACCESS_TOKEN must be configured');
    }

    const session = await axios.post<MetaUploadSessionResponse>(
      `${GRAPH_API_URL}/${this.appId}/uploads`,
      null,
      {
        params: { file_length: buffer.length, file_type: mimeType, access_token: this.accessToken },
      }
    );

    const result = await axios.post<MetaUploadResultResponse>(
      `${GRAPH_API_URL}/${session.data.id}`,
      buffer,
      {
        headers: {
          Authorization: `OAuth ${this.accessToken}`,
          file_offset: '0',
          'Content-Type': 'application/octet-stream',
        },
      }
    );

    return result.data.h;
  }

  /**
   * Best-effort fetch of the WABA's message template namespace. Returns null (never
   * throws) if not configured or Meta is unreachable — this is informational only.
   */
  async getWabaNamespace(): Promise<string | null> {
    if (!this.wabaId || !this.accessToken) return null;
    try {
      const response = await axios.get<{ message_template_namespace?: string }>(
        `${GRAPH_API_URL}/${this.wabaId}`,
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
          params: { fields: 'message_template_namespace' },
        }
      );
      return response.data.message_template_namespace ?? null;
    } catch {
      return null;
    }
  }

  async createTemplate(dto: CreateTemplateDto) {
    if (!this.wabaId || !this.accessToken) {
      throw new Error('WHATSAPP_BUSINESS_ACCOUNT_ID and WHATSAPP_ACCESS_TOKEN must be configured');
    }

    const metaPayload = {
      name: dto.name,
      language: dto.language,
      category: dto.category,
      components: dto.components,
    };

    const metaResponse = await axios.post<MetaTemplateResponse>(
      `${GRAPH_API_URL}/${this.wabaId}/message_templates`,
      metaPayload,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const template = await prisma.messageTemplate.create({
      data: {
        companyId: dto.companyId,
        name: dto.name,
        language: dto.language,
        category: dto.category,
        status: (metaResponse.data.status as TemplateStatus) || TemplateStatus.PENDING,
        metaTemplateId: metaResponse.data.id,
        components: dto.components as object[],
      },
    });

    return template;
  }

  async getTemplates(companyId: string) {
    const templates = await prisma.messageTemplate.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });

    if (this.wabaId && this.accessToken && templates.some(t => t.metaTemplateId)) {
      await this.syncTemplateStatuses(
        companyId,
        templates.map(t => t.metaTemplateId).filter(Boolean) as string[]
      );
      return prisma.messageTemplate.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
      });
    }

    return templates;
  }

  async syncFromMeta(companyId: string) {
    if (!this.wabaId || !this.accessToken) {
      throw new Error('WHATSAPP_BUSINESS_ACCOUNT_ID and WHATSAPP_ACCESS_TOKEN must be configured');
    }

    const response = await axios.get<MetaTemplatesListResponse>(
      `${GRAPH_API_URL}/${this.wabaId}/message_templates`,
      {
        headers: { Authorization: `Bearer ${this.accessToken}` },
        params: { fields: TEMPLATE_LIST_FIELDS },
      }
    );

    const upserts = response.data.data.map(metaTemplate =>
      prisma.messageTemplate.upsert({
        where: {
          companyId_name_language: {
            companyId,
            name: metaTemplate.name,
            language: metaTemplate.language,
          },
        },
        update: {
          status: metaTemplate.status as TemplateStatus,
          metaTemplateId: metaTemplate.id,
          components: metaTemplate.components as object[],
          qualityScore: metaTemplate.quality_score?.score,
          rejectedReason: metaTemplate.rejected_reason,
        },
        create: {
          companyId,
          name: metaTemplate.name,
          language: metaTemplate.language,
          category: metaTemplate.category as TemplateCategory,
          status: metaTemplate.status as TemplateStatus,
          metaTemplateId: metaTemplate.id,
          components: metaTemplate.components as object[],
          qualityScore: metaTemplate.quality_score?.score,
          rejectedReason: metaTemplate.rejected_reason,
        },
      })
    );

    await Promise.all(upserts);

    return prisma.messageTemplate.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteTemplate(id: string, companyId: string) {
    const template = await prisma.messageTemplate.findFirst({
      where: { id, companyId },
    });

    if (!template) {
      throw new Error('Template not found');
    }

    if (template.metaTemplateId && this.wabaId && this.accessToken) {
      await axios.delete(
        `${GRAPH_API_URL}/${this.wabaId}/message_templates?name=${template.name}`,
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        }
      );
    }

    await prisma.messageTemplate.delete({ where: { id } });
  }

  private async syncTemplateStatuses(companyId: string, metaIds: string[]) {
    if (!metaIds.length) return;

    try {
      const response = await axios.get<MetaTemplatesListResponse>(
        `${GRAPH_API_URL}/${this.wabaId}/message_templates`,
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
          params: { fields: TEMPLATE_LIST_FIELDS },
        }
      );

      const metaMap = new Map(response.data.data.map(t => [t.id, t]));

      const updates = metaIds
        .filter(id => metaMap.has(id))
        .map(id => {
          const t = metaMap.get(id)!;
          return prisma.messageTemplate.updateMany({
            where: { companyId, metaTemplateId: id },
            data: {
              status: t.status as TemplateStatus,
              qualityScore: t.quality_score?.score,
              rejectedReason: t.rejected_reason,
            },
          });
        });

      await Promise.all(updates);
    } catch {
      // Status sync is best-effort — don't fail the main request
    }
  }
}

export const templateService = new TemplateService();
