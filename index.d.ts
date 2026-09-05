export type RiskState = 'UNRATED' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'BLOCKED';

export interface RiskStateStyle {
  label: string;
  bg: string;
  fg: string;
  dot: string;
}

export declare const RISK_STATES: Readonly<Record<RiskState, RiskStateStyle>>;

/** What the server chose to expose. Never `raw`, never engine internals. */
export interface BrowserCheck {
  phone: string;
  verdict: string;
  riskLevel: RiskState;
  riskScore: number;
  trustScore: number;
  confidence: number;
  isRated: boolean;
  isBlacklisted: boolean;
  customerStyle: {
    code: string; label: string; icon: string; color: string; riskSensitivity: number;
  } | null;
}

/**
 * Which visual state a check renders as.
 *
 * Blacklisted outranks the band, and an unrated number is never "Low risk" —
 * both rules exist so a storefront cannot contradict the control panel.
 */
export declare function riskStateFor(check: Partial<BrowserCheck> | null): RiskState | null;

export interface BadgeParts {
  /** LOADING and ERROR are not verdicts and are never a `riskLevel`. */
  state: RiskState | 'LOADING' | 'ERROR';
  label: string;
  score: number | null;
  container: Record<string, string | number>;
  dot: Record<string, string | number>;
  scoreStyle: Record<string, string | number>;
}

/**
 * Everything a badge needs, or null when there is nothing to show.
 *
 * Pass `error` and the badge says the check did not run. Without it a failed
 * lookup renders nothing, which is what an empty field renders too.
 */
export declare function badgeParts(
  check: Partial<BrowserCheck> | null,
  options?: {
    loading?: boolean;
    error?: unknown;
    showScore?: boolean;
    style?: Record<string, unknown>;
  },
): BadgeParts | null;

/** A style object as a CSS string, for templates that cannot take objects. */
export declare function styleString(obj: Record<string, string | number>): string;

export declare class NumraRequestError extends Error {
  readonly code: string;
  readonly status: number;
}

/**
 * Look up a number through YOUR backend. There is no apiKey option, ever.
 *
 * A 200 carrying something that is not a check — a login page, a 204, `{}` —
 * throws with code MALFORMED_RESPONSE rather than being rendered as a verdict.
 */
export declare function checkPhone(
  phone: string,
  options?: { endpoint?: string; signal?: AbortSignal; fetch?: typeof fetch },
): Promise<BrowserCheck>;

export interface CheckState {
  status: 'idle' | 'loading' | 'success' | 'error';
  data: BrowserCheck | null;
  error: NumraRequestError | null;
}

export declare const IDLE: Readonly<CheckState>;

export interface CheckController {
  /** Call whenever the number or the enabled flag changes. */
  set(phone: string | null, enabled?: boolean): void;
  /** Re-run now, skipping the debounce. */
  refetch(): Promise<BrowserCheck | null>;
  /** On unmount. Not optional — a timer would outlive the component. */
  dispose(): void;
}

/**
 * Debounce, abort, stale-answer rejection and the idle reset, as one machine.
 *
 * Shared by every framework binding so none of them can lose a rule. A late
 * answer is dropped by controller identity rather than by catching
 * AbortError, because an abort landing while `res.json()` is still running
 * does not always throw.
 */
export declare function createCheckController(options: {
  endpoint?: string;
  debounceMs?: number;
  onState: (state: CheckState) => void;
  fetch?: typeof fetch;
}): CheckController;
