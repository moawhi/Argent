import type { ReactNode } from "react";

export type GuideSlug = "api" | "openapi" | "mcp" | "setup";

export type Guide = {
  slug: GuideSlug;
  title: string;
  summary: string;
  sections: { heading: string; body: ReactNode }[];
};

export const GUIDES: Guide[] = [
  {
    slug: "api",
    title: "What is an API?",
    summary:
      "An API is how one program asks another for data or to do work — the door Argent uses to talk to your backend.",
    sections: [
      {
        heading: "In plain language",
        body: (
          <>
            <p>
              An API (Application Programming Interface) is a contract: your
              backend publishes addresses (URLs) and the kinds of requests it
              accepts. Another program — a website, a script, or Argent — sends
              a request and gets data or a confirmation back.
            </p>
            <p>
              Think of it as a menu, not the kitchen. The menu lists what you
              can order (list accounts, update a campaign, fetch yesterday’s
              stats). You never walk into the kitchen; you place an order and
              wait for the plate.
            </p>
          </>
        ),
      },
      {
        heading: "What you will see in Argent",
        body: (
          <>
            <p>
              Each item on that menu is an <strong>endpoint</strong>: an HTTP
              method such as GET (read) or POST (create) plus a path such as{" "}
              <code>/accounts</code>. Argent groups them on a{" "}
              <strong>connection</strong> so credentials stay on the server and
              every call goes through the gateway.
            </p>
            <p>
              You do not have to know HTTP to use sites. You do need an
              API (or a database) before Argent has anything to show or to
              offer as MCP tools.
            </p>
          </>
        ),
      },
    ],
  },
  {
    slug: "openapi",
    title: "What is OpenAPI?",
    summary:
      "OpenAPI (often still called Swagger) is a file that describes every endpoint — Argent reads it instead of you typing them by hand.",
    sections: [
      {
        heading: "The spec file",
        body: (
          <>
            <p>
              OpenAPI is a YAML or JSON document that lists paths, methods,
              parameters, and what a successful response looks like. Teams keep
              it next to the backend so clients stay in sync. If someone says
              “Swagger file,” they usually mean this same format.
            </p>
            <p>
              Argent imports that file, finds login fields, and builds an
              explorer, docs, objects, and MCP tools from the operations it
              finds. You are not writing a new API — you are pointing Argent at
              one you already run.
            </p>
          </>
        ),
      },
      {
        heading: "Where to get one",
        body: (
          <>
            <p>
              Ask whoever owns the backend. Common places: a{" "}
              <code>/openapi.json</code> or <code>/swagger.json</code> URL, a
              repo file named <code>openapi.yaml</code>, or an export from
              Postman / Stoplight. If you have no spec yet, use Argent’s
              bundled sample, or add endpoints later with the request builder.
            </p>
          </>
        ),
      },
    ],
  },
  {
    slug: "mcp",
    title: "What is MCP?",
    summary:
      "MCP is how AI clients such as Cursor and Claude call tools. Argent hosts those tools from your real API — you do not write a server.",
    sections: [
      {
        heading: "Model Context Protocol",
        body: (
          <>
            <p>
              MCP (Model Context Protocol) is a standard so an AI client can
              discover tools and call them with structured arguments. The
              model never talks to your API directly. It picks a tool from a
              catalog; the MCP server runs the call.
            </p>
            <p>
              Without Argent you would implement that server yourself: names,
              schemas, auth, and HTTP. Argent maps OpenAPI operations to tools
              and keeps API keys in the gateway, so Cursor and Claude only see
              a URL and a bearer token.
            </p>
          </>
        ),
      },
      {
        heading: "What the model actually sees",
        body: (
          <>
            <p>
              The client asks Argent for the tool list. Each tool has a name
              (usually the OpenAPI operation id), a short description, and an
              input schema. You ask in natural language; the model chooses a
              tool. You only name the tool when several look alike.
            </p>
          </>
        ),
      },
    ],
  },
  {
    slug: "setup",
    title: "Set up APIs and MCP in Argent",
    summary:
      "Import a spec, save credentials, pick tools, mint a token, and paste the config into Cursor or Claude.",
    sections: [
      {
        heading: "1. Connect the API",
        body: (
          <>
            <p>
              Go to <strong>Connections</strong> → <strong>Connect an API</strong>.
              Upload an OpenAPI / Swagger file or paste its URL. Name the
              connection something you will recognise. Save the API keys when
              Argent prompts — they are encrypted and never sent to the
              browser.
            </p>
            <p>
              New connections start read-only. Leave that on until you have
              tried a few GETs in the explorer. To try the product with no
              external API, load the bundled sample from the home page.
            </p>
          </>
        ),
      },
      {
        heading: "2. Host an MCP server",
        body: (
          <>
            <p>
              Open <strong>MCP</strong> → <strong>New MCP server</strong>. Give
              it a name, then tick the endpoints agents may call. Prefer safe
              reads first (list, get, stats). One server can mix tools from
              several connections.
            </p>
            <p>
              Mint an access token. Copy the JSON snippet into Cursor’s MCP
              settings or Claude’s config. The URL looks like{" "}
              <code>/api/mcp/your-slug</code>; the header is{" "}
              <code>Authorization: Bearer …</code>. The token is shown once.
            </p>
          </>
        ),
      },
      {
        heading: "3. Try it",
        body: (
          <>
            <p>
              In the client, ask something the tools can answer — for example
              “list all accounts and summarise how many there are.” If the
              model picks the wrong tool, name it in the prompt. Sites and
              objects use the same connection; they are the operator view of
              the same data.
            </p>
          </>
        ),
      },
    ],
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((guide) => guide.slug === slug);
}
