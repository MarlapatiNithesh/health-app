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

  async createSdkSession(request, response) {
    let requestOrigin = null;
    if (process.env.NODE_ENV !== 'production' && !process.env.OPEN_WEARABLES_MOBILE_BASE_URL) {
      const host = `${request.protocol}://${request.get('host')}`;
      requestOrigin = new URL(host);
      if (!requestOrigin.port || requestOrigin.port === String(process.env.PORT || 4000)) {
        requestOrigin.port = process.env.OPEN_WEARABLES_PORT || '8000';
      }
      requestOrigin = requestOrigin.toString();
    }
    const session = await this.service.createSdkSession(request.memberId, requestOrigin);
    response.json(session);
  }

  async syncSdkData(request, response) {
    const result = await this.service.syncSdkDataToHealthLocker(request.memberId);
    response.json(result);
  }

  async disconnectSdkProvider(request, response) {
    const result = await this.service.disconnectSdkProvider(request.memberId, request.params.provider);
    response.json(result);
  }

  async listProviders(_request, response) {
    const providers = await this.service.listProviders();
    response.json({ data: providers });
  }

  async listConnections(request, response) {
    const connections = await this.service.listConnections(request.memberId);
    response.json({ data: connections });
  }

  async connectProvider(request, response) {
    const result = await this.service.connectProvider(
      request.memberId,
      request.params.provider,
      request.body,
    );
    response.status(200).json(result);
  }

  async disconnectConnection(request, response) {
    await this.service.disconnectRemoteProvider(request.memberId, request.params.provider);
    response.status(204).end();
  }

  async disconnectAllConnections(request, response) {
    const result = await this.service.disconnectAllRemoteProviders(request.memberId);
    response.json(result);
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

  async listWomensHealth(request, response) {
    const data = await this.service.listWomensHealth(request.memberId, request.query);
    response.json({ data });
  }

  async getSyncLogs(request, response) {
    const data = await this.service.getSyncLogs(request.memberId, request.query);
    response.json({ data });
  }

  async importAppleXml(request, response) {
    const filename = request.query.filename || request.headers['x-filename'] || 'export.xml';
    let rawBody = request.rawBody;
    if (!rawBody && Buffer.isBuffer(request.body)) {
      rawBody = request.body;
    } else if (!rawBody && typeof request.body === 'string') {
      rawBody = Buffer.from(request.body);
    } else if (!rawBody && request.body && typeof request.body === 'object' && Object.keys(request.body).length > 0) {
      rawBody = Buffer.from(JSON.stringify(request.body));
    }

    if (!rawBody || rawBody.length === 0) {
      return response.status(400).json({
        error: {
          code: 'empty_file',
          message: 'No file body provided for Apple Health XML import. Upload your export.xml or export.zip as the raw request body.',
        },
      });
    }

    const result = await this.service.importAppleXml(request.memberId, rawBody, filename);
    response.status(202).json(result);
  }
}
