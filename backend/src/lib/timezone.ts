// The household runs on India time. The bill schedule works in the server's
// local time (see lib/billSchedule.ts), so pin it: due dates must not shift by a
// day when the server runs elsewhere (e.g. a UTC host). Import this first.
process.env.TZ = process.env.APP_TIMEZONE || 'Asia/Kolkata';
export {};
