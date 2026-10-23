export interface ParseIssue {
  /** Dotted path into the payload. Empty for whole-document issues. */
  path: string;
  message: string;
  /** 1-based line in the source text, when the format can pinpoint one. */
  line?: number;
}

export type ParseResult<T> = { ok: true; data: T } | { ok: false; issues: ParseIssue[] };
