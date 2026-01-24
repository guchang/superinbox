import { Router } from 'express';
import * as oauthController from '../controllers/oauth.controller.js';

const router = Router();

router.get('/:provider/authorize', oauthController.authorize);
router.get('/:provider/callback', oauthController.callback);

export default router;
