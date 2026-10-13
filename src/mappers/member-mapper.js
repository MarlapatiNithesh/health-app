export class MemberMapper {
  static toMemberDto(member) {
    if (!member) return null;
    const fullName = member.fullName || member.full_name || member.profile?.fullName || null;
    const nameParts = (fullName || '').trim().split(/\s+/);
    const firstName = nameParts[0] || null;
    const lastName = nameParts.slice(1).join(' ') || null;
    const dob = member.dob || member.profile?.dob || null;
    const gender = member.gender || member.profile?.gender || null;
    const heightCm = member.heightCm != null ? Number(member.heightCm) : (member.height_cm != null ? Number(member.height_cm) : (member.profile?.heightCm != null ? Number(member.profile.heightCm) : null));
    const weightKg = member.weightKg != null ? Number(member.weightKg) : (member.weight_kg != null ? Number(member.weight_kg) : (member.profile?.weightKg != null ? Number(member.profile.weightKg) : null));
    const insuranceTier = member.insuranceTier || member.insurance_tier || member.profile?.insuranceTier || member.wellnessTier || 'bronze';
    const wellnessScore = Number(member.wellnessScore ?? member.wellness_score ?? member.profile?.wellnessScore ?? 30);

    const profile = member.profile || {
      fullName,
      dob,
      gender,
      heightCm,
      weightKg,
      insuranceTier,
      wellnessScore,
    };
    return {
      id: member.id,
      phone: member.phoneE164 || member.phone,
      phoneE164: member.phoneE164 || member.phone,
      phoneVerified: member.phoneVerified ?? true,
      phoneVerifiedAt: member.phoneVerifiedAt ?? null,
      status: member.status || 'active',
      fullName,
      firstName,
      lastName,
      dob,
      gender,
      biologicalSex: gender,
      heightCm,
      weightKg,
      insuranceTier,
      wellnessScore,
      createdAt: member.createdAt || member.created_at,
      owUserId: member.owUserId ?? null,
      timezone: member.timezone || 'Asia/Kolkata',
      healthConsentAt: member.healthConsentAt ?? null,
      healthConsentVersion: member.healthConsentVersion ?? null,
      wellnessUpdatedAt: member.wellnessUpdatedAt ?? null,
      profile,
    };
  }

  static toProfileDto(member) {
    return MemberMapper.toMemberDto(member);
  }

  static toProfileUpdateDto(updated) {
    if (!updated) return null;
    return {
      fullName: updated.fullName ?? null,
      dob: updated.dob ?? null,
      gender: updated.gender ?? null,
      heightCm: updated.heightCm != null ? Number(updated.heightCm) : null,
      weightKg: updated.weightKg != null ? Number(updated.weightKg) : null,
      timezone: updated.timezone ?? 'Asia/Kolkata',
      insuranceTier: updated.insuranceTier || updated.wellnessTier || 'bronze',
      wellnessScore: Number(updated.wellnessScore ?? 30),
    };
  }

  static toWeightProgressDto({ currentWeightKg, initialWeightKg, netWeightChangeKg, trend, totalEntries, history }) {
    return {
      currentWeightKg,
      initialWeightKg,
      netWeightChangeKg,
      trend,
      totalEntries,
      history,
    };
  }

  static toConsentDto(consent) {
    if (!consent) return null;
    return {
      id: consent.id,
      memberId: consent.memberId || consent.member_id,
      scope: consent.scope,
      granted: Boolean(consent.granted),
      revokedAt: consent.revokedAt || consent.revoked_at || null,
      createdAt: consent.createdAt || consent.created_at,
    };
  }
}
