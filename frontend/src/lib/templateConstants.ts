import type { TemplateCategory } from '@/types';

export const CATEGORIES: { value: TemplateCategory; label: string; description: string }[] = [
  { value: 'MARKETING', label: 'Marketing', description: 'Promote your products, services or business.' },
  { value: 'UTILITY', label: 'Utility', description: 'Send account updates, order updates, alerts, and more.' },
  { value: 'AUTHENTICATION', label: 'Authentication', description: 'Send codes that allow your customers to access their accounts.' },
];

export type MarketingMessageType = 'GENERAL' | 'CAROUSEL';

export const MARKETING_MESSAGE_TYPES: { value: MarketingMessageType; label: string; description: string }[] = [
  { value: 'GENERAL', label: 'General', description: 'Promote using various text, media, and interactive components.' },
  { value: 'CAROUSEL', label: 'Carousel', description: 'Promote using a variety of product carousel cards with interactive components.' },
];
