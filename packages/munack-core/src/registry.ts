import { RegistryCheckResult, RegistryName } from "./types";

function buildRegistryUrl(name: string, registry: RegistryName): string {
  const encoded = encodeURIComponent(name);
  switch (registry) {
    case "npm":
      return `https://registry.npmjs.org/${name}`;
    case "pypi":
      return `https://pypi.org/pypi/${encoded}/json`;
    case "crates":
      return `https://crates.io/api/v1/crates/${encoded}`;
    case "packagist":
      return `https://repo.packagist.org/p2/${name}.json`;
  }
}

export async function checkRegistry(
  name: string,
  registry: RegistryName,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = Number(process.env.MUNACK_REGISTRY_TIMEOUT_MS ?? "8000")
): Promise<RegistryCheckResult> {
  const url = buildRegistryUrl(name, registry);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      headers: {
        "user-agent": "munack/0.1.4"
      },
      signal: controller.signal
    });

    if (response.status === 404) {
      return {
        result: "not_found",
        reason: `Package not found in ${registry}.`,
        statusCode: response.status,
        url
      };
    }

    if (!response.ok) {
      return {
        result: "unknown",
        reason: `${registry} returned HTTP ${response.status}.`,
        statusCode: response.status,
        url
      };
    }

    return {
      result: "exists",
      reason: `Package exists in ${registry}.`,
      statusCode: response.status,
      url
    };
  } catch (error) {
    return {
      result: "unknown",
      reason: `Registry check failed: ${String(error)}`,
      url
    };
  } finally {
    clearTimeout(timer);
  }
}
