export function getHealthMemberId(member) {
  const value = member?.id || member?.memberId || member?.member_id || member?.phone || member?.email;
  return value == null ? 'unknown-member' : String(value);
}

export function getHealthConsentStorageKeys(memberId) {
  const scope = encodeURIComponent(String(memberId || 'unknown-member'));
  return {
    configured: `health_permissions_configured:${scope}`,
    selected: `health_permissions_selected:${scope}`,
  };
}
