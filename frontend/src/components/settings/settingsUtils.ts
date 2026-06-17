import type { Role } from '@/types';

export const PREDEFINED_COLORS = [
  '#EF4444',
  '#F59E0B',
  '#10B981',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#6366F1',
  '#14B8A6',
];

export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  let formatted = phone.replace(/[-\s]/g, '');
  if (formatted.startsWith('62')) {
    formatted = '0' + formatted.substring(2);
  }
  return formatted;
}

export function getRoleBadgeColor(role: Role): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'bg-gradient-to-br from-purple-500 to-purple-600';
    case 'ADMIN':
      return 'bg-gradient-to-br from-blue-500 to-blue-600';
    case 'AGENT':
      return 'bg-gradient-to-br from-green-500 to-green-600';
    default:
      return 'bg-gray-500';
  }
}

export function getRoleLabel(role: Role): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'Super Admin';
    case 'ADMIN':
      return 'Admin';
    case 'AGENT':
      return 'Agent';
    default:
      return role;
  }
}
