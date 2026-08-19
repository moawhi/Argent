"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import {
  updateWidgetBlockAction,
} from "@/app/sites/actions";
import { Input, Textarea } from "@/components/ui/primitives";
import type {
  HeadingBlockConfig,
  ImageBlockConfig,
  RichTextBlockConfig,
} from "@/lib/sites/types";

function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern =
    /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      parts.push(<em key={key++}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("`")) {
      parts.push(
        <code key={key++} className="font-mono text-[0.9em]">
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        parts.push(
          <a
            key={key++}
            href={link[2]}
            className="text-brand underline"
            target="_blank"
            rel="noreferrer"
          >
            {link[1]}
          </a>,
        );
      } else {
        parts.push(token);
      }
    }
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function SimpleMarkdown({ markdown }: { markdown: string }) {
  const blocks = markdown.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <div className="space-y-2 text-sm leading-relaxed text-ink">
      {blocks.map((block, index) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
        if (heading) {
          const level = heading[1].length;
          const Tag = (`h${level}` as unknown) as "h1" | "h2" | "h3";
          const cls =
            level === 1
              ? "text-xl font-semibold"
              : level === 2
                ? "text-lg font-semibold"
                : "text-sm font-semibold";
          return (
            <Tag key={index} className={cls}>
              {renderInline(heading[2])}
            </Tag>
          );
        }
        if (trimmed.startsWith("- ")) {
          const items = trimmed.split("\n").filter((line) => line.startsWith("- "));
          return (
            <ul key={index} className="list-disc space-y-1 pl-5">
              {items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item.slice(2))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index} className="whitespace-pre-wrap text-ink-soft">
            {trimmed.split("\n").map((line, lineIndex) => (
              <span key={lineIndex}>
                {lineIndex > 0 ? <br /> : null}
                {renderInline(line.replace(/^\d+\.\s+/, ""))}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export function ContentBlock({
  widgetId,
  blockKind,
  blockConfig,
  editing,
}: {
  widgetId: string;
  blockKind: "heading" | "richtext" | "image";
  blockConfig: unknown;
  editing: boolean;
}) {
  if (blockKind === "heading") {
    return (
      <HeadingBlock
        widgetId={widgetId}
        config={(blockConfig ?? {}) as HeadingBlockConfig}
        editing={editing}
      />
    );
  }
  if (blockKind === "image") {
    return (
      <ImageBlock
        widgetId={widgetId}
        config={(blockConfig ?? {}) as ImageBlockConfig}
        editing={editing}
      />
    );
  }
  return (
    <RichTextBlock
      widgetId={widgetId}
      config={(blockConfig ?? {}) as RichTextBlockConfig}
      editing={editing}
    />
  );
}

function HeadingBlock({
  widgetId,
  config,
  editing,
}: {
  widgetId: string;
  config: HeadingBlockConfig;
  editing: boolean;
}) {
  const [text, setText] = useState(config.text ?? "Heading");
  const [level, setLevel] = useState<1 | 2 | 3>(config.level ?? 2);
  const Tag = (`h${level}` as unknown) as "h1" | "h2" | "h3";
  const cls =
    level === 1
      ? "text-2xl font-semibold tracking-tight"
      : level === 2
        ? "text-xl font-semibold"
        : "text-base font-semibold";

  if (!editing) {
    return (
      <div className="flex h-full items-center px-4">
        <Tag className={cls}>{config.text || "Heading"}</Tag>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col justify-center gap-2 p-3">
      <Input
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={() =>
          void updateWidgetBlockAction(widgetId, { text, level })
        }
        className="h-9 text-base font-semibold"
      />
      <select
        value={level}
        onChange={(event) => {
          const next = Number(event.target.value) as 1 | 2 | 3;
          setLevel(next);
          void updateWidgetBlockAction(widgetId, { text, level: next });
        }}
        className="h-8 w-32 rounded-md border border-line bg-surface px-2 text-xs"
      >
        <option value={1}>Heading 1</option>
        <option value={2}>Heading 2</option>
        <option value={3}>Heading 3</option>
      </select>
    </div>
  );
}

function RichTextBlock({
  widgetId,
  config,
  editing,
}: {
  widgetId: string;
  config: RichTextBlockConfig;
  editing: boolean;
}) {
  const [markdown, setMarkdown] = useState(config.markdown ?? "");
  if (!editing) {
    return (
      <div className="h-full overflow-auto p-4">
        <SimpleMarkdown markdown={config.markdown || ""} />
      </div>
    );
  }
  return (
    <div className="h-full p-3">
      <Textarea
        value={markdown}
        onChange={(event) => setMarkdown(event.target.value)}
        onBlur={() => void updateWidgetBlockAction(widgetId, { markdown })}
        className="h-full min-h-[6rem] resize-none text-sm"
        placeholder="Markdown: **bold**, lists, [links](url)"
      />
    </div>
  );
}

function ImageBlock({
  widgetId,
  config,
  editing,
}: {
  widgetId: string;
  config: ImageBlockConfig;
  editing: boolean;
}) {
  const [src, setSrc] = useState(config.src ?? "");
  const [alt, setAlt] = useState(config.alt ?? "");
  const srcValue = config.src || src;

  return (
    <div className="relative h-full w-full overflow-hidden bg-canvas">
      {srcValue ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={srcValue}
          alt={config.alt || alt || ""}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <p className="flex h-full items-center justify-center text-xs text-ink-faint">
          Paste an image URL
        </p>
      )}
      {editing ? (
        <div className="absolute inset-x-0 bottom-0 space-y-1.5 bg-surface/95 p-2 backdrop-blur-sm">
          <Input
            value={src}
            onChange={(event) => setSrc(event.target.value)}
            onBlur={() => void updateWidgetBlockAction(widgetId, { src, alt })}
            placeholder="https://…"
            className="h-8 text-xs"
          />
          <Input
            value={alt}
            onChange={(event) => setAlt(event.target.value)}
            onBlur={() => void updateWidgetBlockAction(widgetId, { src, alt })}
            placeholder="Alt text"
            className="h-8 text-xs"
          />
        </div>
      ) : null}
    </div>
  );
}
