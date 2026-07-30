import { messageService } from './message.service';
import { conversationService } from './conversation.service';

const DEFAULT_BODY_TEXT =
  'Terima kasih telah menjadi bagian dari kebaikan bersama SharingHappiness. ' +
  'Untuk membantu meningkatkan layanan, mohon bantuannya memberikan penilaian. ' +
  'Silahkan berikan penilaian melalui tautan di bawah ini.';
const DEFAULT_BUTTON_TEXT = 'Berikan Penilaian';

export class CsatLinkTypeNotConfiguredError extends Error {
  constructor(type: string) {
    super(`CSAT link type "${type}" is not configured. Set CSAT_LINK_${type.toUpperCase()}_URL in the environment.`);
    this.name = 'CsatLinkTypeNotConfiguredError';
  }
}

interface CsatLinkConfig {
  url: string;
  bodyText: string;
  buttonText: string;
}

/**
 * Looks up the Google Form URL + message text for a given CSAT link type from
 * env vars, e.g. type "penilaian_konfirmasi" reads CSAT_LINK_PENILAIAN_KONFIRMASI_URL
 * (required), CSAT_LINK_PENILAIAN_KONFIRMASI_BODY_TEXT and _BUTTON_TEXT (optional,
 * fall back to defaults). New link types can be added purely via env vars, no code change.
 */
function getCsatLinkConfig(type: string): CsatLinkConfig {
  const envPrefix = `CSAT_LINK_${type.toUpperCase()}_`;
  const url = process.env[`${envPrefix}URL`];
  if (!url) throw new CsatLinkTypeNotConfiguredError(type);

  return {
    url,
    bodyText: process.env[`${envPrefix}BODY_TEXT`] || DEFAULT_BODY_TEXT,
    buttonText: process.env[`${envPrefix}BUTTON_TEXT`] || DEFAULT_BUTTON_TEXT,
  };
}

export class ComplaintService {
  /**
   * Send a WhatsApp interactive cta_url message (linking to a Google Form) for an
   * existing conversation — dashboard agent flow (JWT-authenticated).
   */
  async createForConversation(conversationId: string, agentId: string, type: string) {
    const conversation = await conversationService.getConversationById(conversationId);
    const { url, bodyText, buttonText } = getCsatLinkConfig(type);

    await messageService.sendMessage({
      conversationId: conversation.id,
      senderId: agentId,
      messageType: 'interactive',
      text: bodyText,
      buttonText,
      buttonUrl: url,
    });

    return { type, url };
  }

  /**
   * Send a WhatsApp interactive cta_url message for an external/API-key triggered
   * flow (e.g. n8n), identified by phone number instead of an existing conversationId.
   */
  async createForPhone(params: { phoneNumber: string; name?: string; type: string }) {
    const { url, bodyText, buttonText } = getCsatLinkConfig(params.type);

    await messageService.sendMessageByPhone({
      phoneNumber: params.phoneNumber,
      contactName: params.name,
      messageType: 'interactive',
      text: bodyText,
      buttonText,
      buttonUrl: url,
    });

    return { type: params.type, url };
  }
}

export const complaintService = new ComplaintService();
