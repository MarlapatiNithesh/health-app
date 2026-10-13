export class WellnessService {
  constructor(pool) {
    this.pool = pool;
  }

  async calculateWellnessMetrics(memberId, client = this.pool) {
    const memRes = await client.query(
      `SELECT height_cm, weight_kg, timezone, wellness_updated_at FROM members WHERE id = $1`,
      [memberId],
    );
    const member = memRes.rows[0];
    const memberTz = member?.timezone || 'UTC';

    let todayLocalDate;
    try {
      todayLocalDate = new Intl.DateTimeFormat('en-CA', { timeZone: memberTz }).format(new Date());
    } catch {
      todayLocalDate = new Date().toISOString().split('T')[0];
    }

    let sleepMinutes = 0;
    const sleepRes = await client.query(
      `SELECT
         COALESCE(sleep_total_duration_mins, 0) AS total_sleep_mins
       FROM sleep_sessions
       WHERE member_id = $1
         AND started_at >= now() - interval '2 days'
       ORDER BY started_at DESC
       LIMIT 1`,
      [memberId],
    );
    if (sleepRes?.rows?.[0]?.total_sleep_mins) {
      sleepMinutes = Number(sleepRes.rows[0].total_sleep_mins);
    }

    const todayRes = await client.query(
      `SELECT local_date, metric_type, aggregation, SUM(value) AS total_val, MAX(value) AS max_val
       FROM timeseries
       WHERE member_id = $1
         AND local_date >= (CURRENT_DATE - INTERVAL '1 day')
       GROUP BY local_date, metric_type, aggregation
       ORDER BY local_date DESC`,
      [memberId],
    );

    let steps = 0;
    let hrv = 0;

    for (const r of todayRes.rows) {
      if (r.metric_type === 'steps' || r.metric_type === 'step_count') {
        if (r.aggregation === 'daily_total') {
          steps = Math.max(steps, Number(r.max_val));
        } else {
          steps = Math.max(steps, Number(r.total_val));
        }
      }
      if (r.metric_type === 'sleep' && sleepMinutes === 0) {
        sleepMinutes = Math.max(sleepMinutes, Number(r.total_val));
      }
      if (r.metric_type === 'hrv' || r.metric_type === 'heart_rate_variability') {
        hrv = Math.max(hrv, Number(r.max_val));
      }
    }

    if (steps === 0 && sleepMinutes === 0 && hrv === 0) {
      const recentRes = await client.query(
        `SELECT metric_type, MAX(value) AS max_val
         FROM timeseries
         WHERE member_id = $1
         GROUP BY metric_type`,
        [memberId],
      );
      for (const s of recentRes.rows) {
        if (s.metric_type === 'steps' || s.metric_type === 'step_count') steps = Number(s.max_val);
        if (s.metric_type === 'sleep' && sleepMinutes === 0) sleepMinutes = Number(s.max_val);
        if (s.metric_type === 'hrv' || s.metric_type === 'heart_rate_variability') hrv = Number(s.max_val);
      }
    }

    let score = 30;
    if (member?.height_cm && member?.weight_kg) score += 10;
    if (steps >= 10000) score += 30;
    else if (steps >= 7000) score += 20;
    else if (steps >= 4000) score += 10;

    if (sleepMinutes >= 420) score += 20;
    else if (sleepMinutes >= 360) score += 10;

    if (hrv >= 50) score += 10;

    score = Math.min(100, score);

    let tier = 'bronze';
    if (steps >= 10000 && sleepMinutes >= 450 && hrv >= 50) tier = 'platinum';
    else if (steps >= 10000 && sleepMinutes >= 420) tier = 'gold';
    else if (steps >= 7000 || sleepMinutes >= 390) tier = 'silver';

    return { score, tier };
  }
}
