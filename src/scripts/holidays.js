const NAGER_BASE_URL = "https://date.nager.at/api/v3";
const HOLIDAY_CACHE_PREFIX = "nager-public-holidays";
const HOLIDAY_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 14;

const memoryCache = new Map();

function toCountryCode(countryCode) {
    const normalized = (countryCode || "BR").toString().trim().toUpperCase();
    return normalized || "BR";
}

function getYear(value) {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return new Date().getFullYear();
    return parsed;
}

function getCacheKey(countryCode, year) {
    return `${HOLIDAY_CACHE_PREFIX}:${countryCode}:${year}`;
}

function safeParseJson(rawValue) {
    try {
        return JSON.parse(rawValue);
    } catch {
        return null;
    }
}

function readCachedHolidays(countryCode, year) {
    const cacheKey = getCacheKey(countryCode, year);
    const now = Date.now();

    const inMemory = memoryCache.get(cacheKey);
    if (inMemory && now - inMemory.savedAt < HOLIDAY_CACHE_TTL_MS) {
        return inMemory.data;
    }

    if (typeof localStorage === "undefined") return null;

    const rawValue = localStorage.getItem(cacheKey);
    if (!rawValue) return null;

    const parsed = safeParseJson(rawValue);
    if (!parsed || !Array.isArray(parsed.data) || typeof parsed.savedAt !== "number") {
        localStorage.removeItem(cacheKey);
        return null;
    }

    if (now - parsed.savedAt >= HOLIDAY_CACHE_TTL_MS) {
        localStorage.removeItem(cacheKey);
        return null;
    }

    memoryCache.set(cacheKey, parsed);
    return parsed.data;
}

function writeCachedHolidays(countryCode, year, data) {
    const cacheKey = getCacheKey(countryCode, year);
    const payload = {
        savedAt: Date.now(),
        data,
    };

    memoryCache.set(cacheKey, payload);

    if (typeof localStorage === "undefined") return;

    try {
        localStorage.setItem(cacheKey, JSON.stringify(payload));
    } catch {
        // Ignore storage quota errors.
    }
}

function normalizeHolidayList(data) {
    if (!Array.isArray(data)) return [];

    return data
        .map(item => ({
            date: (item?.date || "").toString(),
            localName: (item?.localName || item?.name || "").toString(),
            name: (item?.name || item?.localName || "").toString(),
        }))
        .filter(item => /^\d{4}-\d{2}-\d{2}$/.test(item.date));
}

export function getCountryCodeForLanguage(language) {
    if (language === "enUS") return "US";
    return "BR";
}

export async function getPublicHolidays({ year, countryCode = "BR" }) {
    const safeCountryCode = toCountryCode(countryCode);
    const safeYear = getYear(year);

    const cached = readCachedHolidays(safeCountryCode, safeYear);
    if (cached) {
        return cached;
    }

    try {
        const response = await fetch(`${NAGER_BASE_URL}/PublicHolidays/${safeYear}/${safeCountryCode}`);
        if (!response.ok) {
            throw new Error(`Unable to load holidays (${response.status})`);
        }

        const data = normalizeHolidayList(await response.json());
        writeCachedHolidays(safeCountryCode, safeYear, data);
        return data;
    } catch {
        return [];
    }
}

export async function getHolidaysByYears({ years, countryCode = "BR" }) {
    const uniqueYears = Array.from(new Set((years || []).map(getYear)));
    if (uniqueYears.length === 0) return [];

    const results = await Promise.all(
        uniqueYears.map(year => getPublicHolidays({ year, countryCode }))
    );

    return results.flat();
}
