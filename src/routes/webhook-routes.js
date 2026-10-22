import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { verifyWebhookSignature, matchesSecret } from '../security/webhook-secrets.js';
import { ApplicationError } from '../errors/application-error.js';

export function createWebhookRouter(controller, webhookSecret) {
  const router = Router();

  const verifySignature = (request, _response, next) => {
    if (!verifyWebhookSignature(request.headers, request.rawBody, webhookSecret)) {
      return next(new ApplicationError('Webhook secret or signature is invalid', 401, 'webhook_unauthorized'));
    }
    return next();
  };

  const handleWebhook = [
    verifySignature,
    asyncHandler((request, response) =>
      controller.processProviderWebhook(request, response)),
  ];

  const handleProviderWebhook = [
    verifySignature,
    asyncHandler((request, response) => {
      if (request.params.provider) {
        request.body = request.body || {};
        if (!request.body.provider && !request.body.data?.provider) {
          request.body.provider = request.params.provider;
        }
      }
      return controller.processProviderWebhook(request, response);
    }),
  ];

  router.post(['/health', '/open-wearables'], ...handleWebhook);

  router.get('/providers/:provider/webhooks', (request, response) => {
    const { provider } = request.params;
    const configuredToken = process.env.WEBHOOK_VERIFY_TOKEN;

    if (process.env.NODE_ENV === 'production' && configuredToken) {
      const verifyToken = request.query['hub.verify_token'] || request.query.verification_token;
      if (!verifyToken || !matchesSecret(verifyToken, configuredToken)) {
        return response.status(403).json({ error: 'invalid_verification_token' });
      }
    }

    if (request.query.verification_token) {
      return response.status(200).json({ verification_token: request.query.verification_token });
    }

    if (request.query['hub.challenge']) {
      return response.status(200).json({ 'hub.challenge': request.query['hub.challenge'] });
    }

    return response.status(200).json({ status: 'ok', provider });
  });

  router.head('/providers/:provider/webhooks', (_request, response) => {
    response.status(200).end();
  });

  router.post('/providers/:provider/webhooks', ...handleProviderWebhook);

  return router;
}
