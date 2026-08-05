import type { TemplateCategory } from '@/types';

export const CATEGORIES: { value: TemplateCategory; label: string; description: string }[] = [
  { value: 'MARKETING', label: 'Marketing', description: 'Promote your products, services or business.' },
  { value: 'UTILITY', label: 'Utility', description: 'Send account updates, order updates, alerts, and more.' },
  { value: 'AUTHENTICATION', label: 'Authentication', description: 'Send codes that allow your customers to access their accounts.' },
];
