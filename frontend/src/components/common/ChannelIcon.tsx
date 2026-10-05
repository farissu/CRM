import type { ComponentType } from 'react';
import { Instagram } from 'lucide-react';
import WhatsAppIcon from './WhatsAppIcon';
import type { Channel } from '@/types';

interface ChannelIconProps {
  // Optional: payloads from older endpoints/socket events may not carry `channel` yet;
  // every contact predating Instagram support is WhatsApp.
  channel?: Channel;
  className?: string;
}

const CHANNEL_STYLES: Record<Channel, { Icon: ComponentType<{ className?: string; strokeWidth?: number | string }>; bg: string; label: string }> = {
  WHATSAPP: { Icon: WhatsAppIcon, bg: 'bg-green-500', label: 'WhatsApp' },
  INSTAGRAM: { Icon: Instagram, bg: 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400', label: 'Instagram' },
};

export default function ChannelIcon({ channel, className = 'w-5 h-5' }: ChannelIconProps) {
  const { Icon, bg, label } = CHANNEL_STYLES[channel ?? 'WHATSAPP'] ?? CHANNEL_STYLES.WHATSAPP;

  return (
    <div
      className={`${className} ${bg} rounded-full flex items-center justify-center border-2 border-white shadow-soft-sm`}
      title={label}
    >
      <Icon className="w-[60%] h-[60%] text-white" strokeWidth={2.5} />
    </div>
  );
}
