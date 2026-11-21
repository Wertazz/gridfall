// ─────────────────────────────────────────────────────────────────────────────
// GRIDFALL V2 — world constants. Changing any value here changes the world.
// ─────────────────────────────────────────────────────────────────────────────

/** 2026-11-21T00:00:00Z — tick 0 of the world. */
export const GENESIS_MS = 1795219200000;
export const WORLD_SEED = 0x47524446; // "GRDF"

/** 1 real minute = 12 world minutes. */
export const WORLD_RATIO = 12;
/** Real milliseconds per world minute (5 000). */
export const MINUTE_MS = 60_000 / WORLD_RATIO;
export const HOUR_MINUTES = 60;
export const DAY_HOURS = 24;
/** One macro step = one world hour = 5 real minutes. */
export const HOUR_MS = MINUTE_MS * HOUR_MINUTES;

/** One checkpoint per real day = 12 world days = 288 world hours. */
export const CHECKPOINT_HOURS = 288;

/** Agent slots. Population is kept between MIN_ALIVE and N_MAX. */
export const N_MAX = 32;
export const MIN_ALIVE = 8;
export const BIRTH_CAP = 28;

export const LOG_SIZE = 96;
export const MEM_SIZE = 8;
export const HIST_DAYS = 14;
export const VOTE_HIST = 6;
export const MAX_ARCS = 16;
export const MAX_TOKENS = 8;
export const MAX_GRAVES = 24;
export const MAX_STORYLETS_PER_HOUR = 3;

export const ELECTION_DAYS = 7;
export const MONEY_MAX = 2_000_000_000; // cents

/** Oracle mode horizon (real ms). */
export const ORACLE_MS = 10 * 60_000;
