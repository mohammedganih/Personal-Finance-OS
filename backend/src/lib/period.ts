import { Request } from 'express';

/** Parses optional ?month=1-12&year=YYYY query params, used by any endpoint
 *  that can be scoped to a specific calendar month. Invalid/out-of-range
 *  values are silently dropped (falls back to "this month" in the service). */
export function parsePeriod(req: Request) {
  const month = req.query.month ? parseInt(req.query.month as string) : undefined;
  const year = req.query.year ? parseInt(req.query.year as string) : undefined;
  return {
    month: month && month >= 1 && month <= 12 ? month : undefined,
    year: year && year >= 2000 && year <= 2100 ? year : undefined,
  };
}
