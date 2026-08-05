interface RenderableComponent {
  type: string;
  format?: string;
  text?: string;
  example?: { header_handle?: string[] };
}

export interface HeaderMedia {
  format: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  link: string;
}

/**
 * Extracts the header's resolvable media link (post-approval, Meta returns a real
 * CDN URL here instead of the ephemeral upload handle used at creation time) so it
 * can be included in a template-message send request — Meta rejects sends for a
 * media-header template that omit the header component.
 */
export function extractHeaderMedia(components: unknown): HeaderMedia | undefined {
  const list = (components as RenderableComponent[] | null) ?? [];
  const header = list.find(c => c.type === 'HEADER' && c.format && c.format !== 'TEXT');
  const link = header?.example?.header_handle?.[0];
  if (header?.format && link?.startsWith('http')) {
    return { format: header.format as HeaderMedia['format'], link };
  }
  return undefined;
}

export function hasMediaHeader(components: unknown): boolean {
  const list = (components as RenderableComponent[] | null) ?? [];
  return list.some(c => c.type === 'HEADER' && c.format && c.format !== 'TEXT');
}
