import {
  CalendarHeart,
  Flag,
  Fingerprint,
  Frame,
  Megaphone,
  MonitorPlay,
  Share2,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "logo-design": Fingerprint,
  "poster-design": Frame,
  "commercial-design": Megaphone,
  "youtube-thumbnails": MonitorPlay,
  "event-banners": Flag,
  "event-planning": CalendarHeart,
  "social-media-management": Share2,
};

export function serviceIcon(slug: string): LucideIcon {
  return ICONS[slug] ?? Sparkles;
}
