import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const host = process.env.MUNACK_ADMIN_HOST || "127.0.0.1";
const port = Number(process.env.MUNACK_ADMIN_PORT || "8791");
const cacheTtlMs = 5 * 60 * 1000;

const config = {
  productName: "Munack",
  gumroadUrl: "https://balkanbrs.gumroad.com/l/munack",
  openVsxNamespace: "balkanbrs",
  openVsxExtension: "munack",
  vsMarketplaceItemName: "balkanbrs.munack",
  npmPackages: [
    "munack-cli",
    "@balkanbrs/munack-core"
  ]
};

let metricsCache = {
  expiresAt: 0,
  payload: null
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sendHtml(response, html) {
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(html);
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatCurrency(cents) {
  if (typeof cents !== "number") {
    return null;
  }
  return `$${(cents / 100).toFixed(2)}`;
}

function percent(numerator, denominator) {
  if (!numerator || !denominator) {
    return null;
  }
  return Number(((numerator / denominator) * 100).toFixed(2));
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function fetchJson(url, options = {}) {
  try {
    const response = await fetch(url, options);
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    return {
      ok: response.ok,
      status: response.status,
      data
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      error: String(error)
    };
  }
}

async function fetchText(url, options = {}) {
  try {
    const response = await fetch(url, options);
    return {
      ok: response.ok,
      status: response.status,
      text: await response.text()
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      error: String(error),
      text: ""
    };
  }
}

async function loadLocalMetadata() {
  const [workspacePackage, extensionPackage] = await Promise.all([
    readJsonIfExists(path.join(rootDir, "package.json")),
    readJsonIfExists(path.join(rootDir, "packages", "munack-vscode", "package.json"))
  ]);

  return {
    workspaceVersion: workspacePackage?.version ?? null,
    extensionVersion: extensionPackage?.version ?? null,
    publisher: extensionPackage?.publisher ?? null,
    itemName: extensionPackage ? `${extensionPackage.publisher}.${extensionPackage.name}` : null
  };
}

async function loadNpmPackageMetrics(packageName) {
  const encoded = encodeURIComponent(packageName);
  const [registryResult, downloadsResult] = await Promise.all([
    fetchJson(`https://registry.npmjs.org/${encoded}`),
    fetchJson(`https://api.npmjs.org/downloads/point/last-month/${encoded}`)
  ]);

  return {
    packageName,
    registryVisible: Boolean(registryResult.ok && registryResult.data),
    latestVersion: registryResult.ok ? registryResult.data?.["dist-tags"]?.latest ?? null : null,
    publishedVersions: registryResult.ok ? Object.keys(registryResult.data?.versions ?? {}).slice(-5) : [],
    lastMonthDownloads: downloadsResult.ok ? numberOrNull(downloadsResult.data?.downloads) : null,
    status: registryResult.ok ? "visible" : "unavailable",
    notes: registryResult.ok
      ? null
      : `Registry visibility unavailable (${registryResult.status ?? registryResult.error ?? "unknown error"}).`
  };
}

async function loadOpenVsxMetrics() {
  const latestUrl = `https://open-vsx.org/api/${config.openVsxNamespace}/${config.openVsxExtension}/latest`;
  const versionsUrl = `https://open-vsx.org/api/${config.openVsxNamespace}/${config.openVsxExtension}/versions`;
  const [latestResult, versionsResult] = await Promise.all([
    fetchJson(latestUrl),
    fetchJson(versionsUrl)
  ]);

  return {
    latestVisibleVersion: latestResult.ok ? latestResult.data?.version ?? null : null,
    downloadCount: latestResult.ok ? numberOrNull(latestResult.data?.downloadCount) : null,
    publishedVersionsVisible: versionsResult.ok ? Object.keys(versionsResult.data?.versions ?? {}) : [],
    status: latestResult.ok ? "visible" : "unavailable",
    notes: latestResult.ok
      ? null
      : `Open VSX latest metadata unavailable (${latestResult.status ?? latestResult.error ?? "unknown error"}).`
  };
}

async function loadVsMarketplaceMetrics() {
  const url = `https://marketplace.visualstudio.com/items?itemName=${config.vsMarketplaceItemName}`;
  const result = await fetchText(url, {
    headers: {
      "user-agent": "Munack Admin Panel"
    }
  });

  if (!result.ok) {
    return {
      status: "not_published",
      installs: null,
      rating: null,
      notes: `Marketplace page unavailable (${result.status ?? result.error ?? "unknown error"}).`
    };
  }

  const installMatch =
    result.text.match(/"installCount"\s*:\s*([0-9]+)/) ||
    result.text.match(/([0-9][0-9,]*)\s+installs/i);
  const ratingMatch = result.text.match(/"averageRating"\s*:\s*([0-9.]+)/);

  return {
    status: installMatch ? "visible" : "visible_but_unparsed",
    installs: installMatch ? Number(String(installMatch[1]).replace(/,/g, "")) : null,
    rating: ratingMatch ? Number(ratingMatch[1]) : null,
    notes: installMatch ? null : "Marketplace page loaded, but install count could not be parsed from public HTML."
  };
}

async function loadGumroadMetrics() {
  const result = await fetchText(config.gumroadUrl, {
    headers: {
      "user-agent": "Munack Admin Panel"
    }
  });

  if (!result.ok) {
    return {
      status: "unavailable",
      notes: `Gumroad page unavailable (${result.status ?? result.error ?? "unknown error"}).`
    };
  }

  const match = result.text.match(/data-page="([^"]+)"/);
  if (!match) {
    return {
      status: "unavailable",
      notes: "Gumroad product payload could not be parsed from the public page."
    };
  }

  try {
    const payload = JSON.parse(decodeHtmlEntities(match[1]));
    const product = payload?.props?.product;
    const options = Array.isArray(product?.options) ? product.options : [];
    const freeOption = Number(product?.price_cents ?? 0) === 0;

    return {
      status: "visible",
      productId: product?.id ?? null,
      productName: product?.name ?? null,
      freeOptionEnabled: freeOption,
      productBasePrice: formatCurrency(product?.price_cents),
      publicButtonText: product?.custom_view_content_button_text ?? null,
      paidPlans: options.map((option) => ({
        name: option.name?.trim() ?? "Unnamed plan",
        monthlyPrice: formatCurrency(option.price_difference_cents),
        descriptionPreview: option.description?.trim()?.slice(0, 140) ?? null
      })),
      notes: null
    };
  } catch (error) {
    return {
      status: "unavailable",
      notes: `Gumroad payload parse failed (${String(error)}).`
    };
  }
}

async function loadOverrides() {
  const overridesPath = path.join(rootDir, "admin", "overrides.json");
  return (await readJsonIfExists(overridesPath)) ?? {};
}

function buildFunnel(overrides) {
  const funnel = overrides?.funnel ?? {};
  const productViews = numberOrNull(funnel.productViews);
  const checkoutOpens = numberOrNull(funnel.checkoutOpens);
  const paidOrders = numberOrNull(funnel.paidOrders);
  const freeClaims = numberOrNull(funnel.freeClaims);

  return {
    productViews,
    checkoutOpens,
    paidOrders,
    freeClaims,
    checkoutRatePercent: percent(checkoutOpens, productViews),
    paidConversionPercent: percent(paidOrders, checkoutOpens),
    notes: funnel.notes ?? "Set values in admin/overrides.json to track payment funnel metrics that public APIs do not expose."
  };
}

function buildSummary(local, npmPackages, openVsx, marketplace, gumroad, overrides) {
  const observableDownloads =
    (npmPackages.find((item) => item.packageName === "munack-cli")?.lastMonthDownloads ?? 0) +
    (openVsx.downloadCount ?? 0);

  return {
    product: config.productName,
    workspaceVersion: local.workspaceVersion,
    extensionVersion: local.extensionVersion,
    publisher: local.publisher,
    observableDownloads,
    freeOptionEnabled: gumroad.freeOptionEnabled ?? true,
    publicSources: {
      npm: npmPackages.some((item) => item.registryVisible),
      openVsx: openVsx.status === "visible",
      vsMarketplace: marketplace.status === "visible",
      gumroad: gumroad.status === "visible"
    },
    manualOverridesLoaded: Object.keys(overrides ?? {}).length > 0
  };
}

async function collectMetrics(forceRefresh = false) {
  if (!forceRefresh && metricsCache.payload && Date.now() < metricsCache.expiresAt) {
    return metricsCache.payload;
  }

  const [local, npmPackages, openVsx, marketplace, gumroad, overrides] = await Promise.all([
    loadLocalMetadata(),
    Promise.all(config.npmPackages.map((packageName) => loadNpmPackageMetrics(packageName))),
    loadOpenVsxMetrics(),
    loadVsMarketplaceMetrics(),
    loadGumroadMetrics(),
    loadOverrides()
  ]);

  const payload = {
    generatedAt: new Date().toISOString(),
    summary: buildSummary(local, npmPackages, openVsx, marketplace, gumroad, overrides),
    local,
    npm: npmPackages,
    openVsx,
    vsMarketplace: {
      ...marketplace,
      itemName: config.vsMarketplaceItemName
    },
    gumroad,
    funnel: buildFunnel(overrides),
    overrides
  };

  metricsCache = {
    expiresAt: Date.now() + cacheTtlMs,
    payload
  };

  return payload;
}

const htmlTemplate = await fs.readFile(path.join(rootDir, "admin", "dashboard.html"), "utf8");

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `${host}:${port}`}`);

  if (url.pathname === "/api/health") {
    sendJson(response, 200, { ok: true, service: "munack-admin", time: new Date().toISOString() });
    return;
  }

  if (url.pathname === "/api/metrics") {
    try {
      const payload = await collectMetrics(url.searchParams.get("refresh") === "1");
      sendJson(response, 200, payload);
    } catch (error) {
      sendJson(response, 500, {
        ok: false,
        error: String(error)
      });
    }
    return;
  }

  if (url.pathname === "/" || url.pathname === "/index.html") {
    sendHtml(response, htmlTemplate);
    return;
  }

  response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  response.end("Not found");
});

server.listen(port, host, () => {
  console.log(`Munack admin panel running at http://${host}:${port}`);
});
