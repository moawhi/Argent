import { Badge } from "@/components/ui/primitives";
import { describeParam } from "@/lib/docs/generate";
import type { ParameterDescriptor } from "@/lib/openapi/types";

const TYPE_LABEL: Record<string, string> = {
  integer: "whole number",
  number: "number",
  string: "text",
  boolean: "yes / no",
  array: "list",
  object: "object",
  unknown: "text",
};

/**
 * Renders parameters as a plain-language reference rather than a raw schema
 * dump: types are spelled out, and allowed values are listed inline.
 */
export function ParamTable({ params }: { params: ParameterDescriptor[] }) {
  if (params.length === 0) {
    return <p className="text-xs text-ink-faint">None.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[28rem] text-left text-xs">
        <thead className="bg-canvas text-ink-soft">
          <tr>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">What it does</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {params.map((param) => (
            <tr key={`${param.in}:${param.name}`} className="align-top">
              <td className="whitespace-nowrap px-3 py-2">
                <code className="font-mono text-[11px] text-ink">
                  {param.name}
                </code>
                {param.required ? (
                  <span className="ml-1 text-danger" title="Required">
                    *
                  </span>
                ) : null}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-ink-soft">
                {param.enumValues?.length
                  ? "choice"
                  : (TYPE_LABEL[param.type] ?? param.type)}
                {param.default !== undefined && param.default !== null ? (
                  <div className="mt-0.5 text-[10px] text-ink-faint">
                    default {String(param.default)}
                  </div>
                ) : null}
              </td>
              <td className="px-3 py-2 text-ink-soft">
                {describeParam(param)}
                {param.enumValues?.length ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {param.enumValues.map((value) => (
                      <Badge key={value} tone="outline">
                        {value}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
