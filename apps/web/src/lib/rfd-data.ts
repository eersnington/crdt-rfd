export type RfdState = "published" | "discussion" | "draft" | "committed" | "abandoned";

export type Rfd = {
  number: number;
  title: string;
  state: RfdState;
  author: string;
  updated: string;
  labels: string[];
};

export const rfds: Rfd[] = [
  {
    number: 284,
    title: "Workers Cache in front of Worker entrypoints",
    state: "published",
    author: "Dan Lapid",
    updated: "2026-07-06T18:04:00Z",
    labels: ["workers", "cache"],
  },
  {
    number: 419,
    title: "Saga-style rollbacks for Cloudflare Workflows",
    state: "published",
    author: "Vaishnav Kavitha",
    updated: "2026-06-25T09:48:00Z",
    labels: ["workflows", "durable-execution"],
  },
  {
    number: 3,
    title: "Temporary Cloudflare accounts for AI agents",
    state: "published",
    author: "Sid Chatterjee",
    updated: "2026-06-19T08:51:00Z",
    labels: ["agents", "workers"],
  },
  {
    number: 38,
    title: "Precursor continuous signals for agentic bot detection",
    state: "published",
    author: "Marina Elmore",
    updated: "2026-07-13T20:53:00Z",
    labels: ["bot-management", "security"],
  },
  {
    number: 502,
    title: "Region-aware Smart Tiered Cache selection",
    state: "discussion",
    author: "Chenxi Zhang",
    updated: "2026-07-10T14:12:00Z",
    labels: ["cache", "performance"],
  },
  {
    number: 197,
    title: "Meerkat as a globally consistent Durable Objects primitive",
    state: "committed",
    author: "James Larisch",
    updated: "2026-07-08T11:36:00Z",
    labels: ["durable-objects", "consensus"],
  },
  {
    number: 421,
    title: "Per-tool pricing for remote MCP servers with x402",
    state: "draft",
    author: "Rohin Lohe",
    updated: "2026-07-01T16:20:00Z",
    labels: ["mcp", "monetization"],
  },
  {
    number: 156,
    title: "Fine-grained controls for search, agent, and training bots",
    state: "published",
    author: "Jin-Hee Lee",
    updated: "2026-07-01T07:05:00Z",
    labels: ["ai", "bot-management"],
  },
  {
    number: 88,
    title: "Automatic semantic caching in AI Gateway",
    state: "abandoned",
    author: "Priya Anand",
    updated: "2026-06-28T22:41:00Z",
    labels: ["ai-gateway", "cache"],
  },
  {
    number: 310,
    title: "Attribution insights for AI crawler traffic",
    state: "discussion",
    author: "Oliver Payne",
    updated: "2026-07-01T13:58:00Z",
    labels: ["analytics", "ai"],
  },
  {
    number: 245,
    title: "Self-managed OAuth for every Cloudflare application",
    state: "published",
    author: "Sam Cabell",
    updated: "2026-06-24T10:02:00Z",
    labels: ["oauth", "developer-platform"],
  },
  {
    number: 401,
    title: "Zero-copy pipelines from Queues into R2 Data Catalog",
    state: "draft",
    author: "Elena Rossi",
    updated: "2026-06-20T18:47:00Z",
    labels: ["queues", "r2"],
  },
  {
    number: 63,
    title: "EDE 33 visibility for DNSSEC validation bypasses",
    state: "committed",
    author: "Sebastiaan Neuteboom",
    updated: "2026-07-14T09:19:00Z",
    labels: ["dns", "security"],
  },
  {
    number: 178,
    title: "Post-quantum signatures at the Workers edge",
    state: "published",
    author: "Bas Westerbaan",
    updated: "2026-07-09T15:33:00Z",
    labels: ["cryptography", "workers"],
  },
  {
    number: 466,
    title: "D1 change streams delivered through Cloudflare Queues",
    state: "discussion",
    author: "Dana Lin",
    updated: "2026-06-16T12:11:00Z",
    labels: ["d1", "queues"],
  },
];

export const stateLabels: Record<RfdState, string> = {
  published: "Published",
  discussion: "Discussion",
  draft: "Draft",
  committed: "Committed",
  abandoned: "Abandoned",
};
