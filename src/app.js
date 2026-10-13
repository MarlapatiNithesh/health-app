import express from 'express';
import path from 'path';
import { loadConfig } from './config/env.js';
import { createDatabasePool } from './database/pool.js';
import { createRepositories } from './repositories/index.js';
import { HealthService } from './services/health-service.js';
import { MemberService } from './services/member-service.js';
import { WearableService } from './services/wearable-service.js';
import { WebhookService } from './services/webhook-service.js';
import { HealthController } from './controllers/health-controller.js';
import { MemberController } from './controllers/member-controller.js';
import { WearableController } from './controllers/wearable-controller.js';
import { PhoneController } from './controllers/phone-controller.js';
import { createHealthRouter, createPhoneHealthRouter } from './routes/health-routes.js';
import { createMemberRouter } from './routes/member-routes.js';
import { createWearableRouter } from './routes/wearable-routes.js';
import { createWebhookRouter } from './routes/webhook-routes.js';
import { createPhoneRouter } from './routes/phone-routes.js';
import { OpenWearablesClient } from './integrations/open-wearables-client.js';
import { TwilioVerifyClient } from './integrations/twilio-verify-client.js';
import { PhoneVerificationService } from './services/phone-verification-service.js';
import { PhoneVerificationRepository } from './repositories/phone-verification-repository.js';
import { ApplicationError } from './errors/application-error.js';
import { requestContext } from './middleware/request-context.js';
import { createPhoneAuthLimiter } from './middleware/phone-auth-limiter.js';
import { logger } from './logger.js';
import {
  createMedibotRouter,
  createChatRouter,
  createDocumentRouter,
  createEncounterRouter,
  createClinicalRouter,
} from './routes/medibot-routes.js';
import { ClinicalRecordRepository, EncounterRepository, DocumentRepository } from './repositories/index.js';
import { ClinicalController } from './controllers/clinical-controller.js';
import { EncounterController } from './controllers/encounter-controller.js';
import { DocumentController } from './controllers/document-controller.js';
import { OrchestratorController } from './controllers/orchestrator-controller.js';
import { ClinicalRulesService } from './services/clinical-rules-service.js';
import { DocumentProcessorService } from './services/document-processor-service.js';
import { LLMService } from './services/llm-service.js';
import { ClinicalOrchestratorService } from './services/clinical-orchestrator-service.js';
import { setupSwaggerDocs } from './docs/swagger-config.js';
import { createAppContainer } from './di/app-container.js';

export function createApp(config = loadConfig()) {
  if (!config.jwtSecret) throw new Error('JWT_SECRET is required');

  const pool = config.pool ?? (config.databaseUrl ? createDatabasePool(config.databaseUrl) : null);
  const repositories = config.repositories ?? (pool ? createRepositories(pool) : null);

  if (!repositories) {
    throw new Error('DATABASE_URL or pre-configured repositories are required to create the app.');
  }

  const {
    memberRepo,
    phoneHealthRepo,
    wearableRepo,
    healthSampleRepo,
    timeseriesRepo = repositories.timeseriesRepo ?? null,
    syncLogRepo = repositories.syncLogRepo ?? null,
    openWearablesRepo = repositories.owRepo ?? null,
    phoneVerificationRepo = pool ? new PhoneVerificationRepository(pool) : null,
  } = repositories;

  const openWearablesClient = config.openWearablesClient ?? new OpenWearablesClient({
    baseUrl: config.openWearablesBaseUrl,
    apiKey: config.openWearablesApiKey,
    appId: config.openWearablesAppId,
    appSecret: config.openWearablesAppSecret,
    mobileBaseUrl: config.openWearablesMobileBaseUrl,
  });

  const twilioVerifyClient = config.twilioVerifyClient ?? new TwilioVerifyClient({
    accountSid: config.twilioAccountSid,
    authToken: config.twilioAuthToken,
    serviceSid: config.twilioVerifyServiceSid,
  });

  const healthService = new HealthService(
    { phoneHealthRepo, healthSampleRepo, memberRepo, wearableRepo, openWearablesRepo },
    { batchLimit: config.healthBatchLimit },
  );
  const memberService = new MemberService(memberRepo, config.jwtSecret, openWearablesClient);
  const wearableService = new WearableService(wearableRepo, memberRepo, openWearablesClient, openWearablesRepo);
  const phoneService = config.phoneService ?? (phoneVerificationRepo ? new PhoneVerificationService(
    phoneVerificationRepo,
    twilioVerifyClient,
    {
      jwtSecret: config.jwtSecret,
      memberRepo,
      openWearablesClient,
      wearableService,
      cooldownSeconds: config.phoneCooldownSeconds ?? (config.pool ? 0 : 60),
    },
  ) : null);

  const webhookService = new WebhookService(pool, {
    memberRepo,
    wearableRepo,
    syncLogRepo,
    timeseriesRepo,
    openWearablesClient,
    wearableService,
  });

  const healthController = new HealthController(healthService, {
    openWearablesClient,
    memberRepo,
    openWearablesRepo,
    wearableRepo,
    webhookService,
  });
  const memberController = new MemberController(memberService);
  const wearableController = new WearableController(wearableService);
  const phoneController = phoneService ? new PhoneController(phoneService) : null;

  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', true);

  // CORS middleware for Swagger UI, browser clients, and cross-origin requests
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With, x-request-id, origin, Idempotency-Key, idempotency-key');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length, Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    next();
  });

  app.use(requestContext);
  app.use(express.json({
    limit: '1mb',
    verify: (request, _response, buffer) => {
      request.rawBody = buffer;
    },
  }));

  app.use('/v1/me', createMemberRouter(memberController, config.jwtSecret, memberRepo));
  const healthRouter = createHealthRouter(healthController, config.jwtSecret);
  app.use('/v1/me', healthRouter);
  app.use('/v1/health', healthRouter);
  app.use('/health', healthRouter);
  const wearableRouter = createWearableRouter(wearableController, config.jwtSecret);
  app.use('/v1/me/wearables', wearableRouter);
  app.use('/v1/wearables', wearableRouter);
  app.use('/wearables', wearableRouter);

  if (phoneController) {
    const authLimiter = config.authLimiter ?? createPhoneAuthLimiter();
    const phoneRouter = createPhoneRouter(phoneController, config.jwtSecret);
    app.use('/phone', authLimiter, phoneRouter);
    app.use('/v1/phone', authLimiter, phoneRouter);
  }

  if (config.webhookSecret) {
    const webhookRouter = createWebhookRouter(healthController, config.webhookSecret);
    app.use('/api/webhooks', webhookRouter);
    app.use('/v1/webhooks', webhookRouter);
    app.use('/api/v1', webhookRouter);
    logger.info('Webhook routes registered at /api/webhooks, /v1/webhooks, and /api/v1');
  }

  const container = config.container ?? createAppContainer({
    ...config,
    pool,
    repositories,
    jwtSecret: config.jwtSecret,
    uploadDir: config.uploadDir || process.env.UPLOAD_DIR || './uploads/documents',
    healthBatchLimit: config.healthBatchLimit,
    openWearablesRepo,
  });

  const clinicalController = config.clinicalController ?? container.resolve('clinicalController');
  const encounterController = config.encounterController ?? container.resolve('encounterController');
  const documentController = config.documentController ?? container.resolve('documentController');
  const orchestratorController = config.orchestratorController ?? container.resolve('orchestratorController');

  const clinicalRepo = config.clinicalRepo ?? container.resolve('clinicalRepo');

  const medibotRouter = createMedibotRouter({
    jwtSecret: config.jwtSecret,
    memberRepo,
    clinicalRepo,
    clinicalController,
    encounterController,
    documentController,
    orchestratorController,
  });

  app.use('/medibot', medibotRouter);
  app.use('/api/medibot', medibotRouter);
  app.use('/v1/medibot', medibotRouter);
  app.use('/v1', medibotRouter);
  logger.info('MediBot clinical routes registered in-process at /medibot, /v1/medibot, and /v1');

  // Serve built production mobile-app static assets directly on port 4000
  const distPath = path.join(process.cwd(), 'mobile-app/dist');
  app.use('/app', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });
  app.use('/app', express.static(distPath, { etag: false, lastModified: false }));
  app.use('/assets', express.static(path.join(distPath, 'assets')));
  app.use(express.static(distPath));
  app.use('/app', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(distPath, 'index.html'));
  });

  app.get('/', (_request, response) => {
    response.redirect('/docs');
  });

  app.get('/health', async (request, response) => {
    try {
      if (pool) {
        await pool.query('SELECT 1');
      }
      response.json({ status: 'ok', database: 'ok' });
    } catch {
      response.status(503).json({ status: 'degraded', database: 'unavailable' });
    }
  });

  setupSwaggerDocs(app);

  app.use((request, response) => {
    response.status(404).json({
      error: { code: 'not_found', message: 'The requested endpoint does not exist.' },
      requestId: request.requestId,
    });
  });

  app.use((error, request, response, next) => {
    if (response.headersSent) return next(error);

    const isAppError = error instanceof ApplicationError ||
      error?.name === 'ApplicationError' ||
      (typeof error?.status === 'number' && error.status >= 400 && error.status < 500);

    const applicationError = isAppError
      ? error
      : error instanceof SyntaxError && error.status === 400
        ? new ApplicationError('Request body must be valid JSON', 400, 'invalid_json')
        : new ApplicationError('Unexpected server error', 500, 'internal_error');

    if (applicationError.status >= 500) {
      logger.error('Unhandled server error', { err: error.message, stack: error.stack, requestId: request.requestId });
    }

    const payload = {
      error: {
        code: applicationError.code,
        message: applicationError.message,
        ...(applicationError.details ? { details: applicationError.details } : {}),
      },
      requestId: request.requestId,
    };

    response.status(applicationError.status).json(payload);
  });

  return { app, pool, repositories };
}
