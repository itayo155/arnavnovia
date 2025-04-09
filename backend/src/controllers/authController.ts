import { Request, Response } from 'express';
import { supabase } from '../config/db';
import { catchAsync } from '../utils/errorHandler';
import { findUserByUsername, findUserById } from '../models/userModel';

// Controller for user login
export const login = catchAsync(async (req: Request, res: Response) => {
  const { username, password } = req.body;

  // Validate input
  if (!username || !password) {
    return res.status(400).json({
      status: 'fail',
      message: 'Please provide username and password'
    });
  }

  try {
    // Use Supabase auth with email/password
    // Since we're using usernames, we need to first find the user to get their email
    const user = await findUserByUsername(username);
    
    if (!user) {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid credentials'
      });
    }
    
    // If user doesn't have an email (shouldn't happen with Supabase auth), return error
    if (!user.email) {
      return res.status(400).json({
        status: 'fail',
        message: 'User account is not properly configured'
      });
    }
    
    // Attempt to sign in with Supabase auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: password
    });
    
    if (error) {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid credentials'
      });
    }
    
    // Return user info and token
    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          username: user.username,
          tokens: user.tokens
        },
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred during login'
    });
  }
});

// Get email by username (for direct Supabase auth)
export const getEmailByUsername = catchAsync(async (req: Request, res: Response) => {
  const { username } = req.body;
  
  if (!username) {
    return res.status(400).json({
      status: 'fail',
      message: 'Please provide a username'
    });
  }
  
  try {
    console.log(`Looking up email for username: ${username}`);
    
    // If the input looks like an email, return it directly
    if (username.includes('@')) {
      console.log(`Input appears to be an email address: ${username}`);
      return res.status(200).json({
        status: 'success',
        data: {
          email: username,
          isEmail: true
        }
      });
    }
    
    // Attempt to find the user
    const user = await findUserByUsername(username);
    
    // If we found the user and they have an email, return it
    if (user && user.email) {
      console.log(`Found email for user ${username}: ${user.email}`);
      return res.status(200).json({
        status: 'success',
        data: {
          email: user.email,
          isEmail: false
        }
      });
    }
    
    // User not found or no email available
    return res.status(404).json({
      status: 'fail',
      message: 'User not found or email not available'
    });
  } catch (error) {
    console.error('Error fetching email:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred while fetching user email'
    });
  }
});

// Get current user info
export const getCurrentUser = catchAsync(async (req: Request, res: Response) => {
  // User should be available from auth middleware
  const user = (req as any).user;
  
  if (!user) {
    return res.status(401).json({
      status: 'fail',
      message: 'Not authenticated'
    });
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      user
    }
  });
});

// Create user in custom table if not exists
export const createUserIfNotExists = catchAsync(async (req: Request, res: Response) => {
  try {
    // Get auth token from request
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'fail',
        message: 'No token provided'
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token with Supabase
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData?.user) {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid token'
      });
    }
    
    const supabaseUserId = userData.user.id;
    const email = userData.user.email;
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({
        status: 'fail',
        message: 'Username is required'
      });
    }
    
    // Check if user already exists in our custom table
    const existingUser = await findUserById(supabaseUserId);
    
    if (existingUser) {
      // User already exists, return success
      return res.status(200).json({
        status: 'success',
        message: 'User already exists',
        data: {
          user: existingUser
        }
      });
    }
    
    // Insert user into our custom users table
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        id: supabaseUserId,
        username: username,
        email: email,
        tokens: 100 // Default starting tokens
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('Error creating user:', insertError);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to create user',
        error: insertError.message
      });
    }
    
    res.status(201).json({
      status: 'success',
      message: 'User created successfully',
      data: {
        user: newUser
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred while creating user'
    });
  }
}); 
