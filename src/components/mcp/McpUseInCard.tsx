import Link from "next/link";
import { Cable } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
} from "@/components/ui/primitives";

export function McpUseInCard({
  connectionId,
  connectionName,
}: {
  connectionId: string;
  connectionName: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Use in MCP</CardTitle>
          <p className="text-xs text-ink-soft">
            Add endpoints from {connectionName} to a hosted MCP server that can
            also include tools from your other API sets.
          </p>
        </div>
      </CardHeader>
      <CardBody className="flex flex-wrap gap-2">
        <Link href={`/mcp/new?connection=${connectionId}`}>
          <Button size="sm">
            <Cable className="size-3.5" />
            New MCP with this API
          </Button>
        </Link>
        <Link href={`/mcp?connection=${connectionId}`}>
          <Button size="sm" variant="secondary">
            Browse MCP servers
          </Button>
        </Link>
      </CardBody>
    </Card>
  );
}
