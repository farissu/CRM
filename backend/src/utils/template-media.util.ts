interface RenderableComponent {
  type: string;
  format?: string;
  text?: string;
  example?: { header_handle?: string[] };
  cards?: Array<{ components: RenderableComponent[] }>;
}

export interface HeaderMedia {
  format: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  link: string;
}

export interface CarouselCardMedia {
  format: 'IMAGE' | 'VIDEO';
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

export function hasCarousel(components: unknown): boolean {
  const list = (components as RenderableComponent[] | null) ?? [];
  return list.some(c => c.type === 'CAROUSEL');
}

/**
 * Extracts each carousel card's resolvable header media link, in card order. Returns
 * undefined if the carousel is missing, or if any card's media link isn't ready yet —
 * Meta rejects a template-message send whose carousel cards don't all include a header.
 */
export function extractCarouselCardsMedia(components: unknown): CarouselCardMedia[] | undefined {
  const list = (components as RenderableComponent[] | null) ?? [];
  const carousel = list.find(c => c.type === 'CAROUSEL');
  if (!carousel?.cards?.length) return undefined;

  const media: CarouselCardMedia[] = [];
  for (const card of carousel.cards) {
    const header = card.components.find(cc => cc.type === 'HEADER' && cc.format && cc.format !== 'TEXT');
    const link = header?.example?.header_handle?.[0];
    if (!header?.format || !link?.startsWith('http')) return undefined;
    media.push({ format: header.format as CarouselCardMedia['format'], link });
  }
  return media;
}
