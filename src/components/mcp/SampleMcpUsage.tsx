"use client";

import { useState } from "react";
import { Check, Copy, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
} from "@/components/ui/primitives";
import {
  SAMPLE_MCP_PROMPTS,
  SAMPLE_MCP_TOOL_EXAMPLES,
  formatToolExampleCall,
} from "@/lib/mcp/sample-usage";
import { cn } from "@/lib/utils";

export function SampleMcpUsage({
  compact = false,
  className,
}: {
  /** Tighter layout for onboarding. */
  compact?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      /* ignore */
    }
  }

  if (compact) {
    return (
      <div className={cn("space-y-3 rounded-xl border border-line bg-canvas p-3", className)}>
        <div className="flex items-center gap-2">
          <MessageSquareText className="size-4 text-ink-soft" />
          <p className="text-sm font-medium">Try asking</p>
        </div>
        <ul className="space-y-2">
          {SAMPLE_MCP_PROMPTS.slice(0, 2).map((item) => (
            <li key={item.title} className="space-y-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-ink-soft">{item.title}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 px-2"
                  onClick={() => copy(item.title, item.prompt)}
                >
                  {copied === item.title ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </Button>
              </div>
              <p className="text-xs leading-relaxed text-ink-faint">
                “{item.prompt}”
              </p>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start gap-2">
          <MessageSquareText className="mt-0.5 size-4 shrink-0 text-ink-soft" />
          <div>
            <CardTitle>Sample usage</CardTitle>
            <p className="text-xs text-ink-soft">
              After you connect Cursor or Claude to this sample MCP, try these
              prompts — or call the tools directly.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardBody className="space-y-5">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Example prompts
          </p>
          <ul className="space-y-2">
            {SAMPLE_MCP_PROMPTS.map((item) => (
              <li
                key={item.title}
                className="rounded-xl border border-line bg-canvas px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{item.title}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 px-2"
                    onClick={() => copy(`prompt:${item.title}`, item.prompt)}
                  >
                    {copied === `prompt:${item.title}` ? (
                      <Check className="size-3.5" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                    <span className="sr-only">Copy prompt</span>
                  </Button>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                  “{item.prompt}”
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3 border-t border-line pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Example tool calls
          </p>
          <ul className="space-y-2">
            {SAMPLE_MCP_TOOL_EXAMPLES.map((example) => {
              const call = formatToolExampleCall(example);
              return (
                <li
                  key={example.tool}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-line px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <code className="font-mono text-xs text-ink">{call}</code>
                    <p className="mt-1 text-xs text-ink-faint">
                      {example.description}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 px-2"
                    onClick={() => copy(`tool:${example.tool}`, call)}
                  >
                    {copied === `tool:${example.tool}` ? (
                      <Check className="size-3.5" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      </CardBody>
    </Card>
  );
}
