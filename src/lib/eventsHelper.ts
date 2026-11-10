import { EventOpportunity } from '../types';

/**
 * Returns a high-fidelity thematic banner image for any event/grant.
 * If the event has an explicit banner_image, it is returned.
 * If the event has a linked_post with a cover_image, that is returned.
 * Otherwise, a curated high-resolution, thematic Unsplash banner is returned
 * based on the opportunity type.
 */
export function getEventBanner(event?: Partial<EventOpportunity> | null): string {
  if (event?.banner_image && typeof event.banner_image === 'string' && event.banner_image.trim()) {
    return event.banner_image.trim();
  }
  if (
    event?.linked_post?.cover_image &&
    typeof event.linked_post.cover_image === 'string' &&
    event.linked_post.cover_image.trim()
  ) {
    return event.linked_post.cover_image.trim();
  }

  const type = String(event?.opportunity_type || '').toLowerCase().trim();

  switch (type) {
    case 'grant':
      // Non-dilutive grant / venture funding
      return 'https://images.unsplash.com/photo-1553729459-efe14ef6055d?auto=format&fit=crop&q=80&w=1200&h=630';
    case 'accelerator':
    case 'incubator':
      // Startup accelerator & incubator lab
      return 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&q=80&w=1200&h=630';
    case 'fellowship':
      // Founder fellowship cohort & mentorship
      return 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=1200&h=630';
    case 'pitch_competition':
    case 'hackathon':
      // Pitch competition, demo day & developer hackathon
      return 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&q=80&w=1200&h=630';
    case 'conference':
      // Technology summit, keynote & industry conference
      return 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&q=80&w=1200&h=630';
    default:
      // Global opportunity ecosystem banner
      return 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&q=80&w=1200&h=630';
  }
}

/**
 * Returns preset thematic banners for selection in the publishing modal
 */
export const EVENT_BANNER_PRESETS: { label: string; url: string; type: string }[] = [
  {
    label: 'Non-Dilutive Grant',
    type: 'grant',
    url: 'https://images.unsplash.com/photo-1553729459-efe14ef6055d?auto=format&fit=crop&q=80&w=1200&h=630',
  },
  {
    label: 'Venture Accelerator',
    type: 'accelerator',
    url: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&q=80&w=1200&h=630',
  },
  {
    label: 'Founder Fellowship',
    type: 'fellowship',
    url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=1200&h=630',
  },
  {
    label: 'Hackathon & Build',
    type: 'hackathon',
    url: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&q=80&w=1200&h=630',
  },
  {
    label: 'Global Conference',
    type: 'conference',
    url: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&q=80&w=1200&h=630',
  },
  {
    label: 'DeepTech & AI Lab',
    type: 'general',
    url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=1200&h=630',
  },
];
