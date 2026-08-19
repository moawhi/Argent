import type { ObjectKind } from "@/lib/objects/types";

export type BlockKind = "object" | "heading" | "richtext" | "image";

export const BLOCK_KIND_LABEL: Record<BlockKind, string> = {
  object: "Object",
  heading: "Heading",
  richtext: "Text",
  image: "Image",
};

export const BLOCK_KIND_SIZE: Record<BlockKind, { w: number; h: number }> = {
  object: { w: 6, h: 8 },
  heading: { w: 12, h: 3 },
  richtext: { w: 6, h: 6 },
  image: { w: 6, h: 8 },
};

export interface HeadingBlockConfig {
  text: string;
  level: 1 | 2 | 3;
}

export interface RichTextBlockConfig {
  markdown: string;
}

export interface ImageBlockConfig {
  src: string;
  alt: string;
}

export type BlockConfig =
  | HeadingBlockConfig
  | RichTextBlockConfig
  | ImageBlockConfig
  | Record<string, never>;

export function defaultBlockConfig(kind: BlockKind): BlockConfig {
  if (kind === "heading") return { text: "Heading", level: 2 };
  if (kind === "richtext")
    return { markdown: "Write a short introduction or note here." };
  if (kind === "image")
    return { src: "", alt: "" };
  return {};
}

export interface TemplateLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TemplateContentWidget {
  key: string;
  blockKind: Exclude<BlockKind, "object">;
  title?: string;
  layout: TemplateLayout;
  blockConfig: BlockConfig;
}

export interface TemplateObjectWidget {
  key: string;
  blockKind: "object";
  title?: string;
  layout: TemplateLayout;
  /** Lookup in the object-id map built while applying the template. */
  objectKey: string;
  linkedToKey?: string;
}

export type TemplateWidget = TemplateContentWidget | TemplateObjectWidget;

export interface TemplateTab {
  name: string;
  widgets: TemplateWidget[];
}

export interface TemplatePage {
  name: string;
  slug: string;
  isHome?: boolean;
  showTabs?: boolean;
  tabs: TemplateTab[];
}

export interface TemplateMenuItem {
  label: string;
  pageSlug: string;
  children?: { label: string; pageSlug: string }[];
}

export interface TemplateFilter {
  key: string;
  label: string;
  kind: string;
  defaultValue?: unknown;
  options?: unknown;
  sortOrder?: number;
}

export interface SiteTemplate {
  key: string;
  name: string;
  description: string;
  category: string;
  /** When true, applying the template also creates campaign demo objects. */
  createsCampaignObjects?: boolean;
  withDefaultFilters?: boolean;
  filters?: TemplateFilter[];
  pages: TemplatePage[];
  menu: TemplateMenuItem[];
}

export interface ObjectHint {
  kind: ObjectKind;
  nameIncludes?: string;
}
