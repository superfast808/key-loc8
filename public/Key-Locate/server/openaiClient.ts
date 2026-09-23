import OpenAI from "openai";

let cachedSettings: { apiKey: string; baseURL?: string; expiresAt: number } | null = null;

async function fetchOpenAISettings(): Promise<{ apiKey: string; baseURL?: string }> {
  // Brief cache to avoid hammering the connector proxy on every request
  if (cachedSettings && cachedSettings.expiresAt > Date.now()) {
    return { apiKey: cachedSettings.apiKey, baseURL: cachedSettings.baseURL };
  }

  // Allow a manual override via plain env vars (useful for local dev / CI)
  const envKey = process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (envKey) {
    return {
      apiKey: envKey,
      baseURL: process.env.OPENAI_BASE_URL || process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    };
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error(
      "Missing Replit connector environment. Connect the OpenAI integration via the Integrations tab.",
    );
  }

  const resp = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=openai`,
    {
      headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken },
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!resp.ok) {
    throw new Error(`Failed to fetch OpenAI credentials: ${resp.status} ${resp.statusText}`);
  }

  const data: any = await resp.json();
  const settings = data.items?.[0]?.settings;
  // The connector exposes credentials under a few possible field names depending on version.
  const apiKey =
    settings?.api_key ??
    settings?.apiKey ??
    settings?.secret_key ??
    settings?.access_token ??
    settings?.token;
  const baseURL = settings?.base_url ?? settings?.baseURL ?? settings?.endpoint;

  if (!apiKey) {
    throw new Error(
      "OpenAI integration not connected or missing API key. Connect OpenAI via the Integrations tab.",
    );
  }

  // Cache for 5 minutes
  cachedSettings = { apiKey, baseURL, expiresAt: Date.now() + 5 * 60 * 1000 };
  return { apiKey, baseURL };
}

/**
 * Returns a fresh OpenAI client. Don't cache the returned client across requests —
 * tokens can rotate. The credentials themselves are briefly cached internally.
 */
export async function getUncachableOpenAIClient(): Promise<OpenAI> {
  const { apiKey, baseURL } = await fetchOpenAISettings();
  return new OpenAI({ apiKey, baseURL });
}
