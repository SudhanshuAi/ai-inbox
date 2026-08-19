import { Router, Request, Response, NextFunction } from 'express';
import { QueryRequestSchema } from '@ai-inbox/contracts';
import { answerQuestion } from '../services/answer.js';

export const queryRouter = Router();

// POST /query
queryRouter.post('/query', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = QueryRequestSchema.parse(req.body);
    const result = await answerQuestion(parsed, req.requestId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
