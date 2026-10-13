export function validateRequest(schema) {
  return async (req, res, next) => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      req.body = parsed.body;
      req.query = parsed.query;
      req.params = parsed.params;
      
      next();
    } catch (error) {
      return res.status(400).json({
        error: {
          code: 'validation_failed',
          message: 'Invalid request data',
          details: error.errors,
        }
      });
    }
  };
}
