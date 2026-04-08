# brave-image-mcp

An MCP (Model Context Protocol) server for [Brave Image Search API](https://brave.com/search/api/). Search images directly from AI assistants like Claude.

**Author:** Ilker Tosun
**License:** MIT

---

## Features

- `search_images` — Search images with full filter support (country, language, safesearch, spellcheck)
- `search_images_batch` — Run multiple image searches in a single call (up to 10 queries)
- Returns image URLs, thumbnails, dimensions, source pages, and confidence scores
- Proper error handling for rate limits, invalid keys, and bad parameters

---

## Requirements

- Node.js >= 18
- A Brave Search API key → [Get one here](https://api-dashboard.search.brave.com)

---

## Installation

```bash
git clone https://github.com/your-username/brave-image-mcp.git
cd brave-image-mcp
npm install
npm run build
```

---

## Configuration

Set your API key as an environment variable:

```bash
export BRAVE_API_KEY=your_api_key_here
```

Or add it to your MCP client config (see below).

---

## Usage with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "brave-image-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/brave-image-mcp/dist/index.js"],
      "env": {
        "BRAVE_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## Usage with n8n (MCP Client Node)

1. Build the project (`npm run build`)
2. In n8n, add an **MCP Client** node
3. Set transport to **stdio**
4. Command: `node /absolute/path/to/brave-image-mcp/dist/index.js`
5. Add environment variable: `BRAVE_API_KEY=your_api_key_here`

---

## Tools

### `search_images`

Search images for a single query.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | ✅ | Search query (max 400 chars, 50 words) |
| `count` | number | ❌ | Results to return (1–200, default: 20) |
| `country` | string | ❌ | 2-letter country code or `ALL` |
| `search_lang` | string | ❌ | Language code (e.g. `en`, `tr`) |
| `safesearch` | `off` \| `strict` | ❌ | Content filter level |
| `spellcheck` | boolean | ❌ | Enable spell checking (default: true) |

### `search_images_batch`

Search images for multiple queries at once.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `queries` | string[] | ✅ | Array of queries (max 10) |
| `count` | number | ❌ | Results per query (1–200, default: 10) |
| `country` | string | ❌ | 2-letter country code or `ALL` |
| `search_lang` | string | ❌ | Language code |
| `safesearch` | `off` \| `strict` | ❌ | Content filter level |
| `spellcheck` | boolean | ❌ | Enable spell checking |

---

## Rate Limits

| Plan | Limit |
|------|-------|
| Free | 1 req/sec |
| Pro | 20 req/sec |

---

## License

MIT © Ilker Tosun
