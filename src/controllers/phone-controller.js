export class PhoneController {
  constructor(phoneService) {
    this.service = phoneService;
  }

  async sendOtp(request, response) {
    const { phone, country, channel } = request.body || {};
    const result = await this.service.sendVerificationOtp({
      rawPhone: phone,
      defaultCountry: country || 'US',
      channel: channel || 'sms',
      memberId: request.memberId ?? null,
      requestIp: request.ip,
      userAgent: request.get('user-agent'),
    });
    response.status(200).json(result);
  }

  async verifyOtp(request, response) {
    const { phone, code, otp, country, name, fullName, dob, gender, heightCm, weightKg } = request.body || {};
    const result = await this.service.verifyOtp({
      rawPhone: phone,
      otp: code || otp,
      memberId: request.memberId ?? null,
      defaultCountry: country || 'US',
      profile: {
        fullName: fullName || name || null,
        dob: dob || null,
        gender: gender || null,
        heightCm: heightCm !== undefined && heightCm !== null ? Number(heightCm) : null,
        weightKg: weightKg !== undefined && weightKg !== null ? Number(weightKg) : null,
      },
    });
    response.status(200).json(result);
  }
}
