import { logger } from '../logger.js';

export class TwilioVerifyClient {
  constructor({ accountSid = null, authToken = null, serviceSid = null, timeoutMs = 10000 } = {}) {
    this.accountSid = accountSid;
    this.authToken = authToken;
    this.serviceSid = serviceSid;
    this.timeoutMs = timeoutMs;
  }

  isConfigured() {
    return Boolean(this.accountSid && this.authToken && this.serviceSid);
  }

  async sendVerification({ to, channel = 'sms' }) {
    if (!this.isConfigured()) {
      throw new Error('TwilioVerifyClient is not configured. Missing accountSid, authToken, or serviceSid.');
    }
    const allowedChannels = ['sms', 'whatsapp', 'call'];
    const normalizedChannel = allowedChannels.includes(channel) ? channel : 'sms';
    const url = `https://verify.twilio.com/v2/Services/${encodeURIComponent(this.serviceSid)}/Verifications`;
    const authHeader = 'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

    const body = new URLSearchParams({
      To: to,
      Channel: normalizedChannel,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error('Twilio sendVerification failed', { status: response.status, errText, to });
      throw new Error(`Twilio Verify send failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    logger.info('Twilio sendVerification dispatched', {
      to: data.to,
      sid: data.sid,
      channel: data.channel,
      status: data.status,
    });
    return {
      success: true,
      sid: data.sid,
      serviceSid: data.service_sid,
      to: data.to,
      channel: data.channel,
      status: data.status,
    };
  }

  async checkVerification({ to, code }) {
    if (!this.isConfigured()) {
      throw new Error('TwilioVerifyClient is not configured. Missing accountSid, authToken, or serviceSid.');
    }

    const url = `https://verify.twilio.com/v2/Services/${encodeURIComponent(this.serviceSid)}/VerificationCheck`;
    const authHeader = 'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

    const body = new URLSearchParams({
      To: to,
      Code: String(code).trim(),
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      if (response.status === 404) {
        logger.warn('Twilio checkVerification returned 404 (session expired or superseded)', { to });
        return {
          success: false,
          status: 'not_found',
          valid: false,
        };
      }
      const errText = await response.text();
      logger.error('Twilio checkVerification failed', { status: response.status, errText, to });
      throw new Error(`Twilio Verify check failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    logger.info('Twilio checkVerification result from API', {
      to: data.to,
      status: data.status,
      valid: data.status === 'approved',
      sid: data.sid,
    });
    return {
      success: true,
      sid: data.sid,
      to: data.to,
      channel: data.channel,
      status: data.status,
      valid: data.status === 'approved',
    };
  }

  async cancelVerification({ to }) {
    if (!this.isConfigured()) {
      return { success: false, status: 'unconfigured' };
    }

    const url = `https://verify.twilio.com/v2/Services/${encodeURIComponent(this.serviceSid)}/Verifications/${encodeURIComponent(to)}`;
    const authHeader = 'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

    const body = new URLSearchParams({
      Status: 'canceled',
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: body.toString(),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        return { success: false, status: response.status === 404 ? 'not_found' : 'error' };
      }

      const data = await response.json();
      return {
        success: true,
        sid: data.sid,
        to: data.to,
        status: data.status,
      };
    } catch {
      return { success: false, status: 'error' };
    }
  }
}

