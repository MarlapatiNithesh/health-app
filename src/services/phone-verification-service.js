import { ApplicationError } from '../errors/application-error.js';
import { normalizeAndValidateGlobalPhone } from '../validation/phone.js';
import { createAccessToken } from '../security/tokens.js';
import { logger } from '../logger.js';

export class PhoneVerificationService {
  constructor(phoneVerificationRepo, verifyClient, options = {}) {
    this.repo = phoneVerificationRepo;
    this.verifyClient = verifyClient;
    this.memberRepo = options.memberRepo || null;
    this.openWearables = options.openWearablesClient || null;
    this.wearableService = options.wearableService || null;
    this.jwtSecret = options.jwtSecret || process.env.JWT_SECRET;
    this.cooldownSeconds = options.cooldownSeconds ?? 60;
    this.otpTtlSeconds = options.otpTtlSeconds ?? 600;
    this.maxVerifyAttempts = options.maxVerifyAttempts ?? 5;
    this.maxResendCount = options.maxResendCount ?? 3;
  }

  async checkNumber(rawPhone, defaultCountry = 'US') {
    const normalized = normalizeAndValidateGlobalPhone(rawPhone, defaultCountry);
    return {
      phoneE164: normalized.e164,
      countryCode: normalized.countryCode,
      nationalFormat: normalized.nationalFormat,
      isValid: true,
      e164: normalized.e164,
    };
  }

  async sendVerificationOtp({ rawPhone, defaultCountry = 'US', channel = 'sms', memberId = null, requestIp = null, userAgent = null }) {
    const normalized = normalizeAndValidateGlobalPhone(rawPhone, defaultCountry);

    if (this.cooldownSeconds > 0) {
      const recent = await this.repo.getRecentSession(normalized.e164, this.cooldownSeconds);
      if (recent) {
        throw new ApplicationError(
          `Please wait ${this.cooldownSeconds} seconds before requesting another code.`,
          429,
          'rate_limited',
        );
      }
    }

    const normalizedChannel = (channel === 'whatsapp' || channel === 'call') ? channel : 'sms';
    let result;
    let isTrialDevFallback = false;

    if (typeof this.verifyClient.cancelVerification === 'function') {
      try {
        await this.verifyClient.cancelVerification({ to: normalized.e164 });
      } catch (cancelErr) {
        logger.debug('No existing verification to cancel or cancellation failed', { err: cancelErr.message });
      }
    }

    try {
      result = await this.verifyClient.sendVerification({
        to: normalized.e164,
        channel: normalizedChannel,
      });
    } catch (err) {
      let msg = err.message || 'Failed to dispatch verification code';
      try {
        const jsonStart = msg.indexOf('{');
        if (jsonStart !== -1) {
          const parsed = JSON.parse(msg.slice(jsonStart));
          if (parsed.message) msg = parsed.message;
        }
      } catch (parseErr) {
      }

      if (msg.includes('verified tester') || msg.includes('21608')) {
        isTrialDevFallback = true;
        result = { sid: 'trial-dev-fallback', status: 'pending' };
      } else {
        throw new ApplicationError(msg, 400, 'twilio_verify_error');
      }
    }

    const session = await this.repo.createVerificationSession({
      memberId,
      phoneE164: normalized.e164,
      channel: normalizedChannel,
      maxVerifyAttempts: this.maxVerifyAttempts,
      maxResendCount: this.maxResendCount,
      requestIp,
      userAgent,
      providerMessageId: result?.sid || result?.id || null,
      expiresAt: new Date(Date.now() + this.otpTtlSeconds * 1000),
    });

    let isExistingMember = false;
    let existingMemberName = null;
    let existingProfile = null;
    if (this.memberRepo?.findMemberByPhone) {
      try {
        const existing = await this.memberRepo.findMemberByPhone(normalized.e164);
        if (existing && existing.status !== 'deleted' && (existing.fullName || existing.profile?.fullName)) {
          isExistingMember = true;
          existingMemberName = existing.fullName || existing.profile?.fullName;
          existingProfile = existing.profile || existing;
        }
      } catch (e) {

      }
    }

    return {
      status: 'sent',
      sessionId: session.id,
      phone: normalized.e164,
      phoneE164: normalized.e164,
      channel: result?.channel || normalizedChannel,
      cooldownSeconds: this.cooldownSeconds,
      expiresAt: session.expiresAt,
      isExistingMember,
      existingMemberName,
      existingProfile,
    };
  }

  async verifyOtp({ rawPhone, otp, memberId = null, defaultCountry = 'US', profile = {} }) {
    const normalized = normalizeAndValidateGlobalPhone(rawPhone, defaultCountry);

    const cleanOtp = String(otp || '').replace(/[\s-]+/g, '');

    if (!cleanOtp) {
      throw new ApplicationError('Verification code is required.', 422, 'missing_otp', [
        { field: 'code', message: 'Verification code is required.' },
      ]);
    }

    const allowDevOtp = process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_OTP === 'true';
    const validDevCodes = ['123456', '805296', process.env.DEV_OTP_CODE].filter(Boolean);
    const isDevCode = allowDevOtp && validDevCodes.includes(cleanOtp);

    let session = await this.repo.findPendingSession(normalized.e164, true);
    if (!session) {
      if (isDevCode) {
        session = await this.repo.createVerificationSession({
          memberId,
          phoneE164: normalized.e164,
          channel: 'sms',
          maxVerifyAttempts: this.maxVerifyAttempts,
          maxResendCount: this.maxResendCount,
          requestIp: null,
          userAgent: 'demo-dev-client',
          providerMessageId: 'dev_mock_verify',
          expiresAt: new Date(Date.now() + 600 * 1000).toISOString(),
        });
      } else {
        throw new ApplicationError(
          'No active verification session found. Please request a new code.',
          404,
          'session_not_found',
        );
      }
    }

    let checkResult;
    if (isDevCode) {
      checkResult = { valid: true, status: 'approved' };
    } else {
      try {
        checkResult = await this.verifyClient.checkVerification({
          to: normalized.e164,
          code: cleanOtp,
        });
      } catch (err) {
        let msg = err.message || 'Failed to verify code';
        try {
          const jsonStart = msg.indexOf('{');
          if (jsonStart !== -1) {
            const parsed = JSON.parse(msg.slice(jsonStart));
            if (parsed.message) msg = parsed.message;
          }
        } catch (parseErr) {
        }
        throw new ApplicationError(msg, 400, 'twilio_verify_error');
      }
    }

    if (!checkResult?.valid) {
      const newAttempts = session.verifyAttempts + 1;
      const isLocked = newAttempts >= session.maxVerifyAttempts;
      await this.repo.recordFailedAttempt(session.id, isLocked ? 'failed' : null);

      if (isLocked) {
        throw new ApplicationError(
          'Maximum verification attempts exceeded. Please request a new code.',
          429,
          'too_many_attempts',
        );
      }

      const remainingAttempts = Math.max(0, session.maxVerifyAttempts - newAttempts);
      throw new ApplicationError(
        `Invalid verification code. ${remainingAttempts} attempt(s) remaining.`,
        400,
        'invalid_otp_code',
        [{ field: 'code', message: `Invalid verification code. ${remainingAttempts} attempt(s) remaining.` }],
      );
    }

    const completed = await this.repo.completeVerification(
      session.id,
      normalized.e164,
      memberId || session.memberId,
    );

    let member = completed.member;

    if (this.memberRepo && profile && (profile.fullName || profile.dob || profile.gender || profile.heightCm || profile.weightKg)) {
      try {
        const updated = await this.memberRepo.updateProfile(member.id, {
          fullName: profile.fullName || null,
          dob: profile.dob || null,
          gender: profile.gender || null,
          heightCm: profile.heightCm ?? null,
          weightKg: profile.weightKg ?? null,
        });
        member = { ...member, ...updated };
      } catch (profileErr) {
        logger.warn('Failed to update initial profile during OTP verification', { err: profileErr.message, memberId: member.id });
      }
    }

    if (this.openWearables?.isConfigured?.()) {
      try {
        const nameParts = (member.fullName || profile?.fullName || '').trim().split(/\s+/);
        const owUser = await this.openWearables.findOrCreateUser({
          externalUserId: member.id,
          phone: normalized.e164,
          email: `${member.id}@phone.health`,
          firstName: nameParts[0] || 'Member',
          lastName: nameParts.slice(1).join(' ') || '',
        });
        if (this.wearableService?.syncMemberDataFromOpenWearables) {
          await this.wearableService.syncMemberDataFromOpenWearables(member.id, owUser?.id).catch((syncErr) => {
            logger.warn('Background sync failed on login', { err: syncErr.message, memberId: member.id });
          });
        }
      } catch (owErr) {
        logger.warn('Failed to register member in Open Wearables on login', { err: owErr.message, memberId: member.id });
      }
    }

    const accessToken = createAccessToken(member.id, this.jwtSecret);

    const isExistingMember = Boolean(completed.member?.fullName || member?.fullName);

    return {
      status: 'verified',
      verified: true,
      memberId: member.id,
      phone: normalized.e164,
      phoneE164: normalized.e164,
      token: accessToken,
      accessToken,
      tokenType: 'Bearer',
      isNewMember: !isExistingMember,
      isExistingMember,
      member,
    };
  }
}

