import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/db';
import { AppError } from '../utils/errorHandler';
import { findUserById } from '../models/userModel';

// Middleware to protect routes
export const protect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token;
    
    // Get token from Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    // Check if token exists
    if (!token) {
      return next(new AppError('You are not logged in. Please log in to get access.', 401));
    }
    
    try {
      // Verify token with Supabase
      const { data, error } = await supabase.auth.getUser(token);
      
      if (error || !data?.user) {
        return next(new AppError('Invalid token or user not found', 401));
      }
      
      // Get user details from our users table
      const currentUser = await findUserById(data.user.id);
      
      if (!currentUser) {
        return next(new AppError('User associated with this token no longer exists', 401));
      }
      
      // Add user to request object for use in protected routes
      (req as any).user = currentUser;
      
      next();
    } catch (err) {
      return next(new AppError('Invalid token or session expired', 401));
    }
  } catch (error) {
    next(error);
  }
}; 
