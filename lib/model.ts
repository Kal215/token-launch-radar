export interface Protocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: Protocol[];
  watchlist: string[];
}

export interface FarmInput {
  action: string;
  cost: string;
  time: string;
}

export interface BoardRow {
  slug: string;
  name: string;
  rank: number;
  implied_value_usd: number;
  farm_steps: string[];
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number;
  growth_pct: number;
  growth_mult: number;
  maturity_mult: number;
  breadth_mult: number;
  category_mult: number;
}

export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  age_days: number;
}

export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  model: typeof MODEL;
  watchlist_count: number;
  early_count: number;
  categories: string[];
  rows: BoardRow[];
  live_rows: LiveRow[];
}

export const MODEL = {
  base_multiple: 0.25,
  growth_weight: 0.45,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 365,
  unknown_age_days: 365,
  chain_weight: 0.04,
  chain_cap: 8,
  category_default: 1,
  category_factors: {
    bridge: 0.96,
    'canonical bridge': 0.96,
    cdp: 1.08,
    'cross chain bridge': 0.96,
    dexs: 1.02,
    lending: 1.12,
    'liquid restaking': 1.06,
    'onchain capital allocator': 1.06,
    'prediction market': 1.02,
    restaking: 1.04,
    'risk curators': 1.08,
    rwa: 1.04,
    'uncollateralized lending': 1.1,
    'yield aggregator': 1.03,
  } as Record<string, number>,
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function requireNumber(value: unknown, label: string, nullable = false): number | null {
  if (nullable && value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`snapshot: ${label} must be ${nullable ? 'a finite number or null' : 'a finite number'}`);
  }
  return value;
}

/** Parse and validate the frozen snapshot before any ranking work begins. */
export function parseSnapshot(value: unknown): Snapshot {
  if (!isRecord(value)) throw new Error('snapshot: expected a JSON object');
  if (!isDate(value.as_of)) throw new Error('snapshot: as_of must be a real UTC date in YYYY-MM-DD form');
  if (typeof value.source !== 'string' || value.source.length === 0) throw new Error('snapshot: source must be a non-empty string');
  const floor = requireNumber(value.floor_usd, 'floor_usd');
  if (!Array.isArray(value.protocols)) throw new Error('snapshot: protocols must be an array');
  if (!Array.isArray(value.watchlist) || value.watchlist.some((slug) => typeof slug !== 'string')) {
    throw new Error('snapshot: watchlist must be an array of protocol slugs');
  }

  const expected = ['slug', 'name', 'category', 'chains', 'tvl_usd', 'change_7d', 'mcap_usd', 'listed_at', 'gecko_id', 'symbol'];
  const seen = new Set<string>();
  const protocols = value.protocols.map((entry, index): Protocol => {
    if (!isRecord(entry)) throw new Error(`snapshot: protocols[${index}] must be an object`);
    const keys = Object.keys(entry);
    if (keys.length !== expected.length || expected.some((key) => !Object.hasOwn(entry, key))) {
      throw new Error(`snapshot: protocols[${index}] must contain exactly the ten protocol fields`);
    }
    if (typeof entry.slug !== 'string' || entry.slug.length === 0 || seen.has(entry.slug)) {
      throw new Error(`snapshot: protocols[${index}].slug must be non-empty and unique`);
    }
    seen.add(entry.slug);
    if (typeof entry.name !== 'string' || entry.name.trim().length === 0) throw new Error(`snapshot: protocols[${index}].name must be non-empty`);
    if (!(typeof entry.category === 'string' || entry.category === null)) throw new Error(`snapshot: protocols[${index}].category must be a string or null`);
    if (!Array.isArray(entry.chains) || entry.chains.some((chain) => typeof chain !== 'string')) {
      throw new Error(`snapshot: protocols[${index}].chains must be an array of strings`);
    }
    if (entry.listed_at !== null && !isDate(entry.listed_at)) throw new Error(`snapshot: protocols[${index}].listed_at must be a real date or null`);
    for (const key of ['gecko_id', 'symbol'] as const) {
      if (!(typeof entry[key] === 'string' || entry[key] === null)) throw new Error(`snapshot: protocols[${index}].${key} must be a string or null`);
    }
    return {
      slug: entry.slug,
      name: entry.name,
      category: entry.category,
      chains: [...entry.chains] as string[],
      tvl_usd: requireNumber(entry.tvl_usd, `protocols[${index}].tvl_usd`)!,
      change_7d: requireNumber(entry.change_7d, `protocols[${index}].change_7d`, true),
      mcap_usd: requireNumber(entry.mcap_usd, `protocols[${index}].mcap_usd`, true),
      listed_at: entry.listed_at,
      gecko_id: entry.gecko_id,
      symbol: entry.symbol,
    };
  });

  const watchlist = [...value.watchlist] as string[];
  for (const slug of watchlist) {
    if (!seen.has(slug)) throw new Error(`snapshot: watchlist slug "${slug}" has no matching protocol`);
  }
  if (new Set(watchlist).size !== watchlist.length) throw new Error('snapshot: watchlist contains duplicate slugs');
  return { as_of: value.as_of, source: value.source, floor_usd: floor!, protocols, watchlist };
}

export function isPreToken(protocol: Protocol): boolean {
  return protocol.mcap_usd === null && protocol.gecko_id === null && protocol.symbol === null;
}

export function ageDays(asOf: string, listedAt: string | null): number {
  if (listedAt === null) return MODEL.unknown_age_days;
  return Math.floor((Date.parse(`${asOf}T00:00:00.000Z`) - Date.parse(`${listedAt}T00:00:00.000Z`)) / 86_400_000);
}

function scoreParts(protocol: Protocol, asOf: string) {
  const rawGrowth = protocol.change_7d ?? 0;
  const growth_pct = Math.min(MODEL.growth_cap, Math.max(MODEL.growth_floor, rawGrowth));
  const growth_mult = Math.exp((growth_pct / 100) * MODEL.growth_weight);
  const age_days = ageDays(asOf, protocol.listed_at);
  const maturity_mult = MODEL.maturity_floor + (age_days / (age_days + MODEL.maturity_days)) * MODEL.maturity_range;
  const breadth_mult = 1 + Math.min(protocol.chains.length, MODEL.chain_cap) * MODEL.chain_weight;
  const category_mult = protocol.category === null
    ? MODEL.category_default
    : MODEL.category_factors[protocol.category.toLowerCase()] ?? MODEL.category_default;
  return { age_days, growth_pct, growth_mult, maturity_mult, breadth_mult, category_mult };
}

export function impliedValue(protocol: Protocol, asOf: string): number {
  const score = scoreParts(protocol, asOf);
  const base = protocol.tvl_usd * MODEL.base_multiple;
  return Math.max(1, Math.round(base * score.growth_mult * score.maturity_mult * score.breadth_mult * score.category_mult));
}

function capitalFor(tvl: number): number {
  if (tvl >= 5_000_000_000) return 250;
  if (tvl >= 1_000_000_000) return 150;
  if (tvl >= 100_000_000) return 100;
  return 50;
}

function holdDays(age: number, listedAt: string | null): number {
  if (listedAt === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

function activityFor(category: string | null, chain: string, name: string): string {
  const c = (category ?? '').toLowerCase();
  if (/lend|cdp|collateral/.test(c)) return `Supply USDC to ${name} on ${chain} and leave the position open`;
  if (/dex|yield|leveraged farm/.test(c)) return `Provide a modest USDC pair on ${name} using ${chain}`;
  if (/bridge/.test(c)) return `Bridge USDC to ${name} on ${chain} and use the bridged funds`;
  if (/staking|restaking/.test(c)) return `Stake the native asset through ${name} on ${chain}`;
  if (/perpetual|derivative/.test(c)) return `Deposit USDC as margin on ${name} and open one small hedge`;
  if (/prediction/.test(c)) return `Fund ${name} on ${chain} and place one small market position`;
  if (/curator|allocator/.test(c)) return `Deposit USDC into a vault managed by ${name} on ${chain}`;
  if (/stable/.test(c)) return `Mint or deposit the relevant stable asset through ${name} on ${chain}`;
  if (/rwa/.test(c)) return `Mint ${name}'s yield asset on ${chain} if eligibility permits`;
  if (/insurance/.test(c)) return `Buy a small amount of cover through ${name} on ${chain}`;
  return `Deposit USDC into ${name} on ${chain} and keep the position open`;
}

function farmPlan(protocol: Protocol, asOf: string): string[] {
  const age = ageDays(asOf, protocol.listed_at);
  const hold = holdDays(age, protocol.listed_at);
  const capital = capitalFor(protocol.tvl_usd);
  const chain = protocol.chains[0] ?? 'the protocol’s supported network';
  const entries: FarmInput[] = [
    { action: activityFor(protocol.category, chain, protocol.name), cost: `$${capital} of capital and about $4 of gas`, time: '15 minutes to set up' },
    { action: 'Create a fresh dedicated wallet for this activity and keep its seed phrase offline', cost: '$0 beyond normal wallet setup', time: '10 minutes once' },
    { action: `Perform one qualifying action on ${chain} each week, checking current protocol guidance first`, cost: `about $${capital} of working capital and $2–$8 of gas per visit`, time: '10–20 minutes weekly' },
    { action: `Keep the position active for at least ${hold} days so activity can appear in more than one snapshot`, cost: `$${capital} remains deployed; no additional planned fee`, time: `${hold} days of monitoring` },
    { action: 'Check the protocol’s own points or eligibility page before withdrawing, and never pay anyone to claim', cost: '$0 to check; reject paid claims', time: '5 minutes before exit' },
    { action: 'Record the wallet, action dates, amounts and transaction identifiers in a private farm log', cost: '$0 using a local record', time: '2 minutes after each action' },
  ];
  return entries.map((step) => `${step.action}. Cost: ${step.cost}. Time: ${step.time}.`);
}

export function radarRow(protocol: Protocol, asOf: string, rank: number): BoardRow {
  const score = scoreParts(protocol, asOf);
  const base = protocol.tvl_usd * MODEL.base_multiple;
  const implied_value_usd = Math.max(1, Math.round(base * score.growth_mult * score.maturity_mult * score.breadth_mult * score.category_mult));
  return {
    slug: protocol.slug,
    name: protocol.name,
    rank,
    implied_value_usd,
    farm_steps: farmPlan(protocol, asOf),
    category: protocol.category,
    chains: protocol.chains,
    tvl_usd: protocol.tvl_usd,
    change_7d: protocol.change_7d,
    listed_at: protocol.listed_at,
    age_days: score.age_days,
    growth_pct: score.growth_pct,
    growth_mult: score.growth_mult,
    maturity_mult: score.maturity_mult,
    breadth_mult: score.breadth_mult,
    category_mult: score.category_mult,
  };
}

export function buildBoard(snapshot: Snapshot): BoardRow[] {
  const preToken = snapshot.protocols.filter(isPreToken);
  const bySlug = new Map(preToken.map((protocol) => [protocol.slug, protocol]));
  const required = snapshot.watchlist.map((slug) => {
    const protocol = bySlug.get(slug);
    if (!protocol) throw new Error(`snapshot: watchlist slug "${slug}" is not pre-token`);
    return protocol;
  });
  const chosen = new Map(required.map((protocol) => [protocol.slug, protocol]));
  const candidates = preToken
    .filter((protocol) => protocol.tvl_usd < snapshot.floor_usd && !chosen.has(protocol.slug))
    .sort((a, b) => b.tvl_usd - a.tvl_usd || a.slug.localeCompare(b.slug));
  for (const protocol of candidates) {
    if (chosen.size >= 200) break;
    chosen.set(protocol.slug, protocol);
  }
  if (chosen.size < 200) {
    for (const protocol of preToken.sort((a, b) => b.tvl_usd - a.tvl_usd || a.slug.localeCompare(b.slug))) {
      if (chosen.size >= 200) break;
      chosen.set(protocol.slug, protocol);
    }
  }
  const ranked = [...chosen.values()].map((protocol) => ({
    protocol,
    value: impliedValue(protocol, snapshot.as_of),
  })).sort((a, b) => b.value - a.value || a.protocol.slug.localeCompare(b.protocol.slug));
  return ranked.map(({ protocol }, index) => radarRow(protocol, snapshot.as_of, index + 1));
}

export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols.filter((protocol) => !isPreToken(protocol))
    .map((protocol) => ({ ...protocol, age_days: ageDays(snapshot.as_of, protocol.listed_at) }))
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || a.slug.localeCompare(b.slug));
}

export function buildRadar(snapshot: Snapshot): RadarData {
  const rows = buildBoard(snapshot);
  return {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: 'radar-1',
    model: MODEL,
    watchlist_count: snapshot.watchlist.length,
    early_count: rows.filter((row) => row.tvl_usd < snapshot.floor_usd).length,
    categories: [...new Set(snapshot.protocols.map((protocol) => protocol.category ?? 'Other'))].sort((a, b) => a.localeCompare(b)),
    rows,
    live_rows: liveRows(snapshot),
  };
}

export function dataScript(snapshot: Snapshot): string {
  return `window.RADAR=${JSON.stringify(buildRadar(snapshot))};\n`;
}

export function boardIssue(snapshot: Snapshot, rows: BoardRow[]): string | null {
  if (rows.length < 100 || rows.length > 4000) return `board has ${rows.length} rows; expected 100 to 4000`;
  const known = new Set(snapshot.protocols.map((protocol) => protocol.slug));
  const found = new Set(rows.map((row) => row.slug));
  for (const slug of snapshot.watchlist) {
    if (!found.has(slug)) return `board is missing watchlist slug "${slug}"`;
  }
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index]!;
    if (!known.has(row.slug)) return `board row ${index + 1} has unknown slug "${row.slug}"`;
    if (row.rank !== index + 1) return `board ranks must be exactly 1..N; expected ${index + 1}, found ${row.rank}`;
    if (!Number.isSafeInteger(row.rank) || row.rank <= 0) return `board row ${index + 1} has an invalid rank`;
    if (typeof row.name !== 'string' || row.name.trim() === '') return `board row ${index + 1} has an empty name`;
    if (!Number.isSafeInteger(row.implied_value_usd) || row.implied_value_usd <= 0 || row.implied_value_usd > 100_000_000_000_000) {
      return `board row ${index + 1} has an invalid implied value`;
    }
    if (index > 0 && row.implied_value_usd > rows[index - 1]!.implied_value_usd) {
      return `implied value rises at rank ${row.rank}`;
    }
    if (!Array.isArray(row.farm_steps) || row.farm_steps.length < 3 || row.farm_steps.length > 12) {
      return `board row ${index + 1} must have 3 to 12 farm steps`;
    }
    if (row.farm_steps.some((step) => typeof step !== 'string' || step.trim().length < 20 || step.trim().length > 600)) {
      return `board row ${index + 1} has a farm step outside the 20 to 600 character limit`;
    }
  }
  if (new Set(rows.map((row) => row.implied_value_usd)).size === 1) return 'all board rows have the same implied value';
  return null;
}