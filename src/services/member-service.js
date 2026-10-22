import { ApplicationError } from '../errors/application-error.js';
import { validateConsent, validateProfileUpdate } from '../validation/input.js';
import { logger } from '../logger.js';
import { MemberMapper } from '../mappers/member-mapper.js';

export class MemberService {
  constructor(memberRepo, jwtSecret, openWearablesClient = null) {
    this.memberRepo = memberRepo?.memberRepo ? memberRepo.memberRepo : memberRepo;
    this.jwtSecret = jwtSecret;
    this.openWearables = openWearablesClient;
  }

  async getProfile(memberId) {
    const member = await this.requireMember(memberId);
    return MemberMapper.toProfileDto(member);
  }

  async updateProfile(memberId, input) {
    await this.requireMember(memberId);
    const validProfile = validateProfileUpdate(input);
    const updated = await this.memberRepo.updateProfile(memberId, validProfile);
    return MemberMapper.toProfileUpdateDto(updated);
  }

  async recordConsent(memberId, input) {
    await this.requireMember(memberId);
    const validConsent = validateConsent(input);
    const recorded = await this.memberRepo.recordConsent(memberId, validConsent);
    return MemberMapper.toConsentDto(recorded);
  }

  async getConsent(memberId, scope) {
    await this.requireMember(memberId);
    return this.memberRepo.getConsent(memberId, scope);
  }

  async getProfileHistory(memberId, options = {}) {
    await this.requireMember(memberId);
    return this.memberRepo.getProfileHistory(memberId, options);
  }

  async getWeightProgress(memberId) {
    const member = await this.requireMember(memberId);
    const history = await this.memberRepo.getProfileHistory(memberId, { limit: 100 });
    const weightEntries = history.filter((h) => h.weightKg != null);

    const currentWeightKg = member?.profile?.weightKg ?? member?.weightKg ?? weightEntries[0]?.weightKg ?? null;
    const initialWeightKg = weightEntries.length > 0
      ? (weightEntries.at(-1).previousWeightKg ?? weightEntries.at(-1).weightKg)
      : currentWeightKg;
    const netWeightChangeKg = currentWeightKg != null && initialWeightKg != null
      ? Math.round((currentWeightKg - initialWeightKg) * 100) / 100
      : 0;

    return MemberMapper.toWeightProgressDto({
      currentWeightKg,
      initialWeightKg,
      netWeightChangeKg,
      trend: netWeightChangeKg < 0 ? 'loss' : netWeightChangeKg > 0 ? 'gain' : 'unchanged',
      totalEntries: history.length,
      history,
    });
  }

  async deleteAccount(memberId) {
    let member = null;
    try {
      member = await this.memberRepo.findMemberById(memberId);
    } catch {

    }
    if (member?.owUserId && this.openWearables?.deleteUser) {
      try {
        await this.openWearables.deleteUser(member.owUserId);
      } catch (err) {
        logger.warn('Failed to delete remote Open Wearables user', { err: err.message, owUserId: member.owUserId });
      }
    }
    if (this.memberRepo?.deleteMember) {
      await this.memberRepo.deleteMember(memberId);
    }
    return { status: 'deleted', memberId };
  }

  async requireMember(memberId) {
    const member = await this.memberRepo.findMemberById(memberId);
    if (!member) throw new ApplicationError('User not found', 404, 'user_not_found');
    if (['deleted', 'suspended', 'deletion_requested'].includes(member.status)) {
      throw new ApplicationError(`Member account is ${member.status}`, 403, 'member_inactive');
    }
    return member;
  }
}

