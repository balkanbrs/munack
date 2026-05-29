import { getCurrentMonthKey, loadCache, saveCache } from "./config";
import { LicenseCache, LicensePlan, LicenseStatus } from "./types";

const GUMROAD_VERIFY_URL = "https://api.gumroad.com/v2/licenses/verify";
const DEFAULT_GUMROAD_PRODUCT_ID = "qHus0ABlM9o8mhVLxqjVoA==";
const FREE_MONTHLY_LIMIT = 5;
const DEFAULT_CACHE_TTL_HOURS = 12;

function maskKey(key?: string): string | undefined {
  if (!key || key.length < 4) {
    return undefined;
  }
  return key.slice(-4);
}

function inferPlan(text: string): LicensePlan {
  const normalized = text.toLowerCase();
  if (normalized.includes("team")) {
    return "team";
  }
  return "pro";
}

export function getFreeMonthlyLimit(): number {
  return FREE_MONTHLY_LIMIT;
}

export function getConfiguredLicenseKey(): string | undefined {
  return process.env.MUNACK_LICENSE_KEY?.trim() || undefined;
}

export function getConfiguredProductId(): string | undefined {
  return process.env.MUNACK_GUMROAD_PRODUCT_ID?.trim() || DEFAULT_GUMROAD_PRODUCT_ID;
}

export function getConfiguredLicenseApiUrl(): string | undefined {
  return process.env.MUNACK_LICENSE_API_URL?.trim() || undefined;
}

export function getConfiguredLicenseApiToken(): string | undefined {
  return process.env.MUNACK_LICENSE_API_TOKEN?.trim() || undefined;
}

function getLicenseCacheTtlMs(): number {
  const raw = process.env.MUNACK_LICENSE_CACHE_TTL_HOURS?.trim();
  const parsed = raw ? Number(raw) : DEFAULT_CACHE_TTL_HOURS;
  const safeHours = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CACHE_TTL_HOURS;
  return safeHours * 60 * 60 * 1000;
}

function canUseCachedStatus(cache: LicenseCache, productId?: string, licenseKey?: string): boolean {
  if (!cache.licenseStatus?.checkedAt) {
    return false;
  }
  if (productId && cache.productId && cache.productId !== productId) {
    return false;
  }
  if (licenseKey && cache.licenseKey && cache.licenseKey !== licenseKey) {
    return false;
  }

  const checkedAt = Date.parse(cache.licenseStatus.checkedAt);
  if (Number.isNaN(checkedAt)) {
    return false;
  }

  return Date.now() - checkedAt <= getLicenseCacheTtlMs();
}

export function getCachedLicenseState(): LicenseCache {
  return loadCache();
}

export async function verifyLicense(options: {
  licenseKey?: string;
  fetchImpl?: typeof fetch;
  forceRefresh?: boolean;
}): Promise<LicenseStatus> {
  const cache = loadCache();
  const fetchImpl = options.fetchImpl ?? fetch;
  const productId = getConfiguredProductId();
  const licenseApiUrl = getConfiguredLicenseApiUrl();
  const licenseApiToken = getConfiguredLicenseApiToken();
  const licenseKey = options.licenseKey ?? getConfiguredLicenseKey() ?? cache.licenseKey;

  if (!licenseKey) {
    return {
      active: false,
      plan: "free",
      source: "free",
      detail: "No license key configured."
    };
  }

  if (!productId) {
    const cached = cache.licenseStatus;
    if (cached?.active) {
      return {
        ...cached,
        source: "cache",
        offline: true,
        detail: "Gumroad product ID is missing; using cached paid license state."
      };
    }
    return {
      active: false,
      plan: "free",
      source: "free",
      licenseKeyLast4: maskKey(licenseKey),
      detail: "No Gumroad product ID is configured for license verification."
    };
  }

  if (!options.forceRefresh && canUseCachedStatus(cache, productId, licenseKey) && cache.licenseStatus) {
    return {
      ...cache.licenseStatus,
      source: "cache",
      detail: cache.licenseStatus.active ? "Using recently verified cached license state." : cache.licenseStatus.detail
    };
  }

  try {
    if (licenseApiUrl) {
      const response = await fetchImpl(licenseApiUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(licenseApiToken ? { authorization: `Bearer ${licenseApiToken}` } : {})
        },
        body: JSON.stringify({
          product: "munack",
          productId,
          licenseKey
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as {
        ok?: boolean;
        active?: boolean;
        plan?: LicensePlan;
        productName?: string;
        detail?: string;
      };

      const status: LicenseStatus = {
        active: Boolean(payload.ok && payload.active),
        plan: payload.ok && payload.active ? payload.plan ?? "pro" : "free",
        source: "gumroad",
        checkedAt: new Date().toISOString(),
        licenseKeyLast4: maskKey(licenseKey),
        productName: payload.productName,
        detail: payload.detail ?? "Verified via custom license API."
      };

      saveCache({
        ...cache,
        licenseKey,
        productId,
        licenseStatus: status
      });

      return status;
    }

    const body = new URLSearchParams({
      product_id: productId,
      license_key: licenseKey,
      increment_uses_count: "false"
    });

    const response = await fetchImpl(GUMROAD_VERIFY_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      body
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = (await response.json()) as {
      success?: boolean;
      purchase?: {
        product_name?: string;
        variants?: string;
        variants_and_quantity?: string;
        refunded?: boolean;
        disputed?: boolean;
      };
    };

    if (!payload.success || payload.purchase?.refunded || payload.purchase?.disputed) {
      const invalidStatus: LicenseStatus = {
        active: false,
        plan: "free",
        source: "gumroad",
        checkedAt: new Date().toISOString(),
        licenseKeyLast4: maskKey(licenseKey),
        detail: "Gumroad rejected the license or marked the purchase as refunded/disputed."
      };
      saveCache({
        ...cache,
        licenseKey,
        productId,
        licenseStatus: invalidStatus
      });
      return invalidStatus;
    }

    const planSource =
      payload.purchase?.variants_and_quantity ||
      payload.purchase?.variants ||
      payload.purchase?.product_name ||
      "pro";

    const status: LicenseStatus = {
      active: true,
      plan: inferPlan(planSource),
      source: "gumroad",
      checkedAt: new Date().toISOString(),
      licenseKeyLast4: maskKey(licenseKey),
      productName: payload.purchase?.product_name,
      detail: "Verified with Gumroad."
    };

    saveCache({
      ...cache,
      licenseKey,
      productId,
      licenseStatus: status
    });

    return status;
  } catch (error) {
    if (cache.licenseStatus?.active) {
      return {
        ...cache.licenseStatus,
        source: "cache",
        offline: true,
        detail: `Gumroad verification unavailable; using cached license state (${String(error)}).`
      };
    }

    return {
      active: false,
      plan: "free",
      source: "free",
      licenseKeyLast4: maskKey(licenseKey),
      detail: `Gumroad verification unavailable (${String(error)}).`
    };
  }
}

export function canRunScan(status: LicenseStatus, now = new Date()): {
  allowed: boolean;
  remainingScans: number | null;
} {
  if (status.active && status.plan !== "free") {
    return {
      allowed: true,
      remainingScans: null
    };
  }

  const cache = loadCache();
  const monthKey = getCurrentMonthKey(now);
  const used = cache.scanUsageByMonth[monthKey] ?? 0;
  return {
    allowed: used < FREE_MONTHLY_LIMIT,
    remainingScans: Math.max(FREE_MONTHLY_LIMIT - used, 0)
  };
}

export function incrementScanUsage(now = new Date()): number {
  const cache = loadCache();
  const monthKey = getCurrentMonthKey(now);
  const nextValue = (cache.scanUsageByMonth[monthKey] ?? 0) + 1;
  saveCache({
    ...cache,
    scanUsageByMonth: {
      ...cache.scanUsageByMonth,
      [monthKey]: nextValue
    }
  });
  return nextValue;
}

export function saveLicenseKey(licenseKey: string): void {
  const cache = loadCache();
  saveCache({
    ...cache,
    licenseKey
  });
}

export function clearStoredLicense(): void {
  const cache = loadCache();
  saveCache({
    ...cache,
    licenseKey: undefined,
    productId: undefined,
    licenseStatus: undefined
  });
}
