export class MemberController {
  constructor(service) {
    this.service = service;
  }

  async profile(request, response) {
    const member = await this.service.getProfile(request.memberId);
    response.json(member);
  }

  async updateProfile(request, response) {
    const updated = await this.service.updateProfile(request.memberId, request.body);
    response.json(updated);
  }

  async consent(request, response) {
    const record = await this.service.recordConsent(request.memberId, request.body);
    response.status(201).json(record);
  }

  async profileHistory(request, response) {
    const history = await this.service.getProfileHistory(request.memberId, request.query);
    response.json(history);
  }

  async weightProgress(request, response) {
    const progress = await this.service.getWeightProgress(request.memberId);
    response.json(progress);
  }

  async deleteAccount(request, response) {
    const result = await this.service.deleteAccount(request.memberId);
    response.status(200).json({ data: result });
  }
}
