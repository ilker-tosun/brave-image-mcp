#!/usr/bin/env node

/**
 * Brave Image Search MCP Server
 * Author: Ilker Tosun
 *
 * Provides image search capabilities via the Brave Search API.
 * Requires BRAVE_API_KEY environment variable.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types";

const BRAVE_IMAGE_SEARCH_URL =
  "https://api.search.brave.com/res/v1/images/search";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BraveImageResult {
  title: string;
  url: string;
  source: string;
  thumbnail: { src: string };
  properties: { url: string; width?: number; height?: number };
  meta_url?: {
    scheme: string;
    netloc: string;
    path: string;
    favicon: string;
  };
  confidence?: string;
}

interface BraveImageSearchResponse {
  type: string;
  query: {
    original: string;
    altered?: string;
    spellcheck_off?: boolean;
  };
  results: BraveImageResult[];
}

interface SearchParams {
  query: string;
  count?: number;
  country?: string;
  search_lang?: string;
  safesearch?: "off" | "strict";
  spellcheck?: boolean;
}

// ─── Core search function ─────────────────────────────────────────────────────

async function searchImages(
  params: SearchParams
): Promise<BraveImageSearchResponse> {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      "BRAVE_API_KEY environment variable is not set. Get your key at https://api-dashboard.search.brave.com"
    );
  }

  const url = new URL(BRAVE_IMAGE_SEARCH_URL);
  url.searchParams.set("q", params.query);

  if (params.count !== undefined)
    url.searchParams.set("count", Math.min(params.count, 200).toString());
  if (params.country) url.searchParams.set("country", params.country);
  if (params.search_lang)
    url.searchParams.set("search_lang", params.search_lang);
  if (params.safesearch)
    url.searchParams.set("safesearch", params.safesearch);
  if (params.spellcheck !== undefined)
    url.searchParams.set("spellcheck", params.spellcheck ? "1" : "0");

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    switch (response.status) {
      case 401:
        throw new McpError(
          ErrorCode.InvalidRequest,
          "Invalid or missing Brave API key (401 Unauthorized)"
        );
      case 422:
        throw new McpError(
          ErrorCode.InvalidParams,
          `Invalid request parameters (422): ${body}`
        );
      case 429:
        throw new McpError(
          ErrorCode.InvalidRequest,
          "Rate limit exceeded (429). Check your plan limits and retry after the window resets."
        );
      default:
        throw new McpError(
          ErrorCode.InternalError,
          `Brave API error ${response.status}: ${body}`
        );
    }
  }

  return response.json() as Promise<BraveImageSearchResponse>;
}

// ─── Result formatter ─────────────────────────────────────────────────────────

function formatResults(data: BraveImageSearchResponse): string {
  if (!data.results || data.results.length === 0) {
    return `No image results found for: "${data.query.original}"`;
  }

  const lines: string[] = [];

  if (data.query.altered) {
    lines.push(
      `ℹ Spellcheck: "${data.query.original}" → "${data.query.altered}"\n`
    );
  }

  lines.push(
    `Found ${data.results.length} result(s) for: "${data.query.original}"\n`
  );

  data.results.forEach((result, index) => {
    lines.push(`${index + 1}. ${result.title}`);
    lines.push(`   Source  : ${result.source}`);
    lines.push(`   Page    : ${result.url}`);
    lines.push(`   Image   : ${result.properties.url}`);
    if (result.properties.width && result.properties.height) {
      lines.push(
        `   Size    : ${result.properties.width} × ${result.properties.height} px`
      );
    }
    lines.push(`   Thumb   : ${result.thumbnail.src}`);
    if (result.confidence) lines.push(`   Confidence: ${result.confidence}`);
    lines.push("");
  });

  return lines.join("\n").trimEnd();
}

// ─── MCP Server ───────────────────────────────────────────────────────────────

const server = new Server(
  { name: "brave-image-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_images",
      description:
        "Search for images using the Brave Image Search API. Returns image URLs, thumbnails, dimensions, source pages, and metadata.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Image search query. Max 400 characters and 50 words.",
          },
          count: {
            type: "number",
            description: "Number of results to return (1–200). Default: 20.",
            minimum: 1,
            maximum: 200,
          },
          country: {
            type: "string",
            description:
              "2-letter country code (e.g. 'US', 'TR', 'DE') or 'ALL' for worldwide results.",
          },
          search_lang: {
            type: "string",
            description:
              "Language code for search results (e.g. 'en', 'tr', 'de').",
          },
          safesearch: {
            type: "string",
            enum: ["off", "strict"],
            description:
              "'strict' filters adult content. 'off' allows it (illegal content always blocked).",
          },
          spellcheck: {
            type: "boolean",
            description:
              "Enable spell checking on the query (default: true). If corrected, altered query is shown in results.",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "search_images_batch",
      description:
        "Search for images using multiple queries in a single call. Runs queries sequentially and returns combined results. Useful for collecting images across several topics at once.",
      inputSchema: {
        type: "object",
        properties: {
          queries: {
            type: "array",
            items: { type: "string" },
            description: "Array of image search queries (max 10).",
            minItems: 1,
            maxItems: 10,
          },
          count: {
            type: "number",
            description: "Number of results per query (1–200). Default: 10.",
            minimum: 1,
            maximum: 200,
          },
          country: {
            type: "string",
            description: "2-letter country code or 'ALL'.",
          },
          search_lang: {
            type: "string",
            description: "Language code for search results.",
          },
          safesearch: {
            type: "string",
            enum: ["off", "strict"],
            description: "Content filter level applied to all queries.",
          },
          spellcheck: {
            type: "boolean",
            description: "Enable spell checking on all queries.",
          },
        },
        required: ["queries"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // ── search_images ──────────────────────────────────────────────────────────
  if (name === "search_images") {
    const params = args as unknown as SearchParams;

    if (!params.query?.trim()) {
      throw new McpError(ErrorCode.InvalidParams, "Query cannot be empty");
    }

    const data = await searchImages({
      query: params.query.trim(),
      count: params.count ?? 20,
      country: params.country,
      search_lang: params.search_lang,
      safesearch: params.safesearch,
      spellcheck: params.spellcheck,
    });

    return { content: [{ type: "text", text: formatResults(data) }] };
  }

  // ── search_images_batch ───────────────────────────────────────────────────
  if (name === "search_images_batch") {
    const {
      queries,
      count,
      country,
      search_lang,
      safesearch,
      spellcheck,
    } = args as unknown as {
      queries: string[];
      count?: number;
      country?: string;
      search_lang?: string;
      safesearch?: "off" | "strict";
      spellcheck?: boolean;
    };

    if (!queries || queries.length === 0) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Queries array cannot be empty"
      );
    }

    const sections: string[] = [];

    for (const query of queries) {
      if (!query?.trim()) continue;
      sections.push(`${"═".repeat(60)}`);
      sections.push(`Query: "${query.trim()}"`);
      sections.push(`${"═".repeat(60)}`);
      try {
        const data = await searchImages({
          query: query.trim(),
          count: count ?? 10,
          country,
          search_lang,
          safesearch,
          spellcheck,
        });
        sections.push(formatResults(data));
      } catch (error) {
        sections.push(
          `Error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      sections.push("");
    }

    return { content: [{ type: "text", text: sections.join("\n") }] };
  }

  throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
});

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[brave-image-mcp] Server running on stdio");
}

main().catch((error) => {
  console.error("[brave-image-mcp] Fatal error:", error);
  process.exit(1);
});
