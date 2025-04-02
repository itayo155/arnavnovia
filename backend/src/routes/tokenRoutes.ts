import express from 'express';
import { getMyTokens, transferUserTokens, getUsers } from '../controllers/tokenController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

// All routes are protected and require authentication
router.use(protect);

// Get current user's token balance
router.get('/balance', getMyTokens);

// Transfer tokens to another user
router.post('/transfer', transferUserTokens);

// Get all users (for dropdown selection)
router.get('/users', getUsers);

export default router; 
