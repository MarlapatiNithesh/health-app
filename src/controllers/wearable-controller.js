export class WearableController {
  constructor(service) {
    this.service = service;
  }

  async createConnectSession(request, response) {
    const { brand, redirectUrl } = request.body;
    const session = await this.service.generateConnectSession(
      request.memberId,
      brand,
      redirectUrl,
    );
    response.status(200).json(session);
  }

  async listProviders(_request, response) {
    const providers = await this.service.listProviders();
    response.json({ data: providers });
  }

  async listConnections(request, response) {
    const connections = await this.service.listConnections(request.memberId);
    response.json({ data: connections });
  }

  async disconnectConnection(request, response) {
    await this.service.disconnectRemoteProvider(request.memberId, request.params.provider);
    response.status(204).end();
  }

  async syncProvider(request, response) {
    const result = await this.service.triggerRemoteSync(
      request.memberId,
      request.params.provider,
      request.query,
    );
    response.json(result);
  }

  async getSyncRuns(request, response) {
    const runs = await this.service.getSyncRuns(request.memberId, request.query?.limit);
    response.json({ data: runs });
  }

  async getSyncRecent(request, response) {
    const recent = await this.service.getSyncRecent(request.memberId, request.query?.limit);
    response.json({ data: recent });
  }

  async listDevices(request, response) {
    const devices = await this.service.listDevices(request.memberId);
    response.json({ data: devices });
  }

  async addDevice(request, response) {
    const device = await this.service.addDevice(request.memberId, request.body);
    response.status(201).json(device);
  }

  async updateDevice(request, response) {
    const device = await this.service.updateDevice(
      request.memberId,
      request.params.deviceId,
      request.body,
    );
    response.json(device);
  }

  async removeDevice(request, response) {
    await this.service.removeDevice(request.memberId, request.params.deviceId);
    response.status(204).end();
  }

  async syncDevice(request, response) {
    const result = await this.service.syncDevice(request.memberId, request.params.deviceId);
    response.json(result);
  }

  async listTimeseries(request, response) {
    const data = await this.service.listTimeseries(request.memberId, request.query);
    response.json({ data });
  }

  async listWorkouts(request, response) {
    const data = await this.service.listWorkouts(request.memberId, request.query);
    response.json({ data });
  }

  async listSleepSessions(request, response) {
    const data = await this.service.listSleepSessions(request.memberId, request.query);
    response.json({ data });
  }

  async listHealthScores(request, response) {
    const data = await this.service.listHealthScores(request.memberId, request.query);
    response.json({ data });
  }

  async getSyncLogs(request, response) {
    const data = await this.service.getSyncLogs(request.memberId, request.query);
    response.json({ data });
  }
}
