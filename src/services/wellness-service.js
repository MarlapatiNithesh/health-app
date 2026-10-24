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
    const memberTz = member?.timezone || 'Asia/Kolkata';

    let todayLocalDate;
    try {
      todayLocalDate = new Intl.DateTimeFormat('en-CA', { timeZone: memberTz }).format(new Date());
    } catch {
      todayLocalDate = new Date().toISOString().split('T')[0];
    }

    let targetDate = todayLocalDate;
    const checkToday = await client.query(
      `SELECT 1 FROM timeseries WHERE member_id = $1 AND local_date = $2::date LIMIT 1`,
      [memberId, todayLocalDate],
    );
    if (checkToday.rows.length === 0) {
      const latestDateRes = await client.query(
        `SELECT local_date FROM timeseries
         WHERE member_id = $1 AND local_date IS NOT NULL
         ORDER BY local_date DESC LIMIT 1`,
        [memberId],
      );
      if (latestDateRes.rows[0]?.local_date) {
        targetDate = new Date(latestDateRes.rows[0].local_date).toISOString().split('T')[0];
      }
    }

    const activityRes = await client.query(
      `SELECT metric_type, aggregation, SUM(value) AS total_val, MAX(value) AS max_val
       FROM timeseries
       WHERE member_id = $1
         AND local_date = $2::date
         AND metric_type IN ('steps', 'step_count', 'calories', 'active_calories', 'active_energy_burned', 'workout', 'active_minutes')
       GROUP BY metric_type, aggregation`,
      [memberId, targetDate],
    );

    let steps = 0;
    let activeCalories = 0;
    let workoutMins = 0;

    for (const r of activityRes.rows) {
      if (r.metric_type === 'steps' || r.metric_type === 'step_count') {
        if (r.aggregation === 'daily_total') {
          steps = Math.max(steps, Number(r.max_val || 0));
        } else {
          steps = Math.max(steps, Number(r.total_val || 0));
        }
      }
      if (r.metric_type === 'calories' || r.metric_type === 'active_calories' || r.metric_type === 'active_energy_burned') {
        activeCalories = Math.max(activeCalories, Number(r.total_val || r.max_val || 0));
      }
      if (r.metric_type === 'workout' || r.metric_type === 'active_minutes') {
        workoutMins = Math.max(workoutMins, Number(r.total_val || r.max_val || 0));
      }
    }

    let sleepMinutes = 0;
    const sleepSessionRes = await client.query(
      `SELECT sleep_total_duration_mins AS mins
       FROM sleep_sessions
       WHERE member_id = $1
         AND started_at >= now() - interval '2 days'
       ORDER BY started_at DESC LIMIT 1`,
      [memberId],
    );
    if (sleepSessionRes.rows[0]?.mins) {
      sleepMinutes = Number(sleepSessionRes.rows[0].mins);
    } else {
      const sleepTsRes = await client.query(
        `SELECT SUM(value) AS total_mins, MAX(value) AS max_mins, aggregation
         FROM timeseries
         WHERE member_id = $1
           AND metric_type = 'sleep'
           AND (local_date = $2::date OR recorded_at >= now() - interval '2 days')
         GROUP BY aggregation
         ORDER BY total_mins DESC LIMIT 1`,
        [memberId, targetDate],
      );
      if (sleepTsRes.rows[0]) {
        sleepMinutes = sleepTsRes.rows[0].aggregation === 'daily_total'
          ? Number(sleepTsRes.rows[0].max_mins)
          : Number(sleepTsRes.rows[0].total_mins);
      }
    }

    const vitalsRes = await client.query(
      `SELECT
         AVG(CASE WHEN metric_type IN ('resting_heart_rate', 'heart_rate') THEN value END) AS avg_hr,
         AVG(CASE WHEN metric_type IN ('spo2', 'blood_oxygen') THEN value END) AS avg_spo2,
         MAX(CASE WHEN metric_type IN ('hrv', 'heart_rate_variability') THEN value END) AS max_hrv
       FROM timeseries
       WHERE member_id = $1
         AND recorded_at >= now() - interval '3 days'`,
      [memberId],
    );
    const vitals = vitalsRes.rows[0] ?? {};
    const restingHr = vitals.avg_hr ? Math.round(Number(vitals.avg_hr)) : null;
    const spo2 = vitals.avg_spo2 ? Math.round(Number(vitals.avg_spo2)) : null;
    const hrv = vitals.max_hrv ? Math.round(Number(vitals.max_hrv)) : null;

    let earnedPoints = 0;
    let possiblePoints = 0;

    let activityScore = 0;
    if (steps > 0 || activeCalories > 0 || workoutMins > 0) {
      const stepPoints = Math.min(30, Math.round((steps / 10000) * 30));
      let bonusPoints = 0;
      if (activeCalories >= 300 || workoutMins >= 30) {
        bonusPoints = 5;
      } else if (activeCalories >= 150 || workoutMins >= 15) {
        bonusPoints = 3;
      } else if (steps >= 10000) {
        bonusPoints = 5;
      }
      activityScore = Math.min(35, stepPoints + bonusPoints);
      earnedPoints += activityScore;
      possiblePoints += 35;
    }

    let sleepScore = 0;
    if (sleepMinutes > 0) {
      if (sleepMinutes >= 420 && sleepMinutes <= 540) sleepScore += 25;
      else if (sleepMinutes >= 360 && sleepMinutes < 420) sleepScore += 20;
      else if (sleepMinutes >= 300 && sleepMinutes < 360) sleepScore += 14;
      else sleepScore += 8;

      if (hrv && hrv >= 40) sleepScore += 5;
      else if (hrv && hrv >= 30) sleepScore += 3;
      else if (sleepMinutes >= 420) sleepScore += 5;

      sleepScore = Math.min(30, sleepScore);
      earnedPoints += sleepScore;
      possiblePoints += 30;
    }

    let vitalsScore = 0;
    if (restingHr !== null || spo2 !== null) {
      if (restingHr !== null) {
        if (restingHr >= 50 && restingHr <= 72) vitalsScore += 15;
        else if (restingHr > 72 && restingHr <= 82) vitalsScore += 11;
        else if (restingHr > 82 && restingHr <= 95) vitalsScore += 7;
        else vitalsScore += 3;
      } else {
        vitalsScore += 11;
      }

      if (spo2 !== null) {
        if (spo2 >= 96) vitalsScore += 10;
        else if (spo2 >= 94) vitalsScore += 7;
        else vitalsScore += 3;
      } else {
        vitalsScore += 7;
      }

      vitalsScore = Math.min(25, vitalsScore);
      earnedPoints += vitalsScore;
      possiblePoints += 25;
    }

    let biometricsScore = 0;
    const heightCm = member?.height_cm != null ? Number(member.height_cm) : null;
    const weightKg = member?.weight_kg != null ? Number(member.weight_kg) : null;
    if (heightCm && weightKg) {
      biometricsScore += 5;
      const heightM = heightCm / 100;
      const bmi = weightKg / (heightM * heightM);
      if (bmi >= 18.5 && bmi <= 24.9) {
        biometricsScore += 5;
      } else if (bmi > 24.9 && bmi <= 27.5) {
        biometricsScore += 3;
      } else {
        biometricsScore += 2;
      }
      earnedPoints += biometricsScore;
      possiblePoints += 10;
    }

    let finalScore = 50;
    if (possiblePoints > 0) {
      finalScore = Math.round((earnedPoints / possiblePoints) * 100);
    }
    finalScore = Math.max(10, Math.min(100, finalScore));

    let tier = 'bronze';
    if (finalScore >= 85) tier = 'platinum';
    else if (finalScore >= 70) tier = 'gold';
    else if (finalScore >= 50) tier = 'silver';

    return {
      score: finalScore,
      overallScore: finalScore,
      tier,
      categoryScores: {
        activity: possiblePoints > 0 ? Math.round((activityScore / 35) * 100) : 50,
        sleep: sleepMinutes > 0 ? Math.round((sleepScore / 30) * 100) : 75,
        vitals: (restingHr !== null || spo2 !== null) ? Math.round((vitalsScore / 25) * 100) : 80,
        biometrics: biometricsScore > 0 ? Math.round((biometricsScore / 10) * 100) : 50,
      },
      metrics: {
        steps,
        sleepMinutes,
        activeCalories,
        workoutMins,
        restingHeartRate: restingHr,
        spo2,
        hrv,
        date: targetDate,
      },
    };
  }
}
