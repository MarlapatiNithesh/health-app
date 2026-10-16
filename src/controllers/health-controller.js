import { WebhookService } from '../services/webhook-service.js';

export class HealthController {
  constructor(service, {
    openWearablesClient = null,
    memberRepo = null,
    openWearablesRepo = null,
    wearableRepo = null,
    webhookService = null,
  } = {}) {
    this.service = service;
    this.openWearablesClient = openWearablesClient;
    this.memberRepo = memberRepo || service.memberRepo;
    this.wearableRepo = wearableRepo || service.wearableRepo;
    this.openWearablesRepo = openWearablesRepo || service.openWearablesRepo || this.wearableRepo;

    const pool = this.wearableRepo?.pool || this.memberRepo?.pool || this.service?.healthSampleRepo?.pool;
    this.webhookService = webhookService || new WebhookService(pool, {
      memberRepo: this.memberRepo,
      wearableRepo: this.wearableRepo,
      openWearablesClient: this.openWearablesClient,
    });
  }

  async resolveMemberId(rawId) {
    return this.webhookService.resolveMemberId(rawId);
  }

  async savePhoneConnection(request, response) {
    const connection = await this.service.savePhoneConnection(request.memberId, request.body);
    response.json(connection);
  }

  async getPhoneConnection(request, response) {
    const connection = await this.service.getPhoneConnection(request.memberId);
    response.json({ data: connection });
  }

  async ingestHealthData(request, response) {
    const result = await this.service.ingestHealthData(
      request.memberId,
      request.body,
      request.get('idempotency-key'),
    );
    response.status(202).json(result);
  }

  async ingestManualHealthData(request, response) {
    const result = await this.service.ingestManualHealthData(
      request.memberId,
      request.body,
      request.get('idempotency-key'),
    );
    response.status(201).json(result);
  }

  async getDailySummary(request, response) {
    const { from, to } = request.query;
    const memberId = request.memberId || request.query.memberId;
    const summary = await this.service.getDailySummary(memberId, from, to);
    response.json({ data: summary });
  }

  async processProviderWebhook(request, response) {
    const result = await this.webhookService.handleWebhook(request.body, request.headers);
    return response.status(result.statusCode || 200).json(result);
  }
}
