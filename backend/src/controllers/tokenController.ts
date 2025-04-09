import { Request, Response } from 'express';
import { catchAsync } from '../utils/errorHandler';
import { transferTokens, getUserTokens, getAllUsers, getUserTransactions } from '../models/userModel';

// Get the current user's token balance
export const getMyTokens = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  
  const tokens = await getUserTokens(userId);
  
  if (tokens === null) {
    return res.status(404).json({
      status: 'fail',
      message: 'User not found'
    });
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      tokens
    }
  });
});

// Transfer tokens to another user
export const transferUserTokens = catchAsync(async (req: Request, res: Response) => {
  const senderId = (req as any).user.id;
  const { receiverId, amount } = req.body;
  
  // Validate input
  if (!receiverId) {
    return res.status(400).json({
      status: 'fail',
      message: 'Please provide a receiver ID'
    });
  }
  
  const tokenAmount = parseInt(amount);
  
  if (!tokenAmount || isNaN(tokenAmount) || tokenAmount <= 0) {
    return res.status(400).json({
      status: 'fail',
      message: 'Please provide a valid positive amount of tokens'
    });
  }
  
  // Prevent transferring to self
  if (senderId === receiverId) {
    return res.status(400).json({
      status: 'fail',
      message: 'Cannot transfer tokens to yourself'
    });
  }
  
  try {
    const success = await transferTokens(senderId, receiverId, tokenAmount);
    
    if (!success) {
      return res.status(400).json({
        status: 'fail',
        message: 'Token transfer failed. This may be due to insufficient tokens.'
      });
    }
    
    // Get updated token balance
    const updatedTokens = await getUserTokens(senderId);
    
    res.status(200).json({
      status: 'success',
      message: `Successfully transferred ${tokenAmount} tokens`,
      data: {
        currentBalance: updatedTokens
      }
    });
  } catch (error: any) {
    let message = 'An error occurred during the transfer';
    
    // Extract more specific error messages if available
    if (error.message && typeof error.message === 'string') {
      if (error.message.includes('Insufficient tokens')) {
        message = 'You do not have enough tokens for this transfer';
      } else if (error.message.includes('Sender not found')) {
        message = 'Sender account not found';
      } else if (error.message.includes('Receiver not found')) {
        message = 'Receiver account not found';
      }
    }
    
    res.status(400).json({
      status: 'fail',
      message
    });
  }
});

// Get all users (for the dropdown in the frontend)
export const getUsers = catchAsync(async (req: Request, res: Response) => {
  const users = await getAllUsers();
  
  // Format for the frontend dropdown
  const formattedUsers = users.map(user => ({
    id: user.id,
    username: user.username
  }));
  
  res.status(200).json({
    status: 'success',
    data: {
      users: formattedUsers
    }
  });
});

// Get user's transaction history
export const getTransactionHistory = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
  
  const transactions = await getUserTransactions(userId, limit);
  
  res.status(200).json({
    status: 'success',
    data: {
      transactions
    }
  });
}); 
