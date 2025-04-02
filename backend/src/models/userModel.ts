import { supabase } from '../config/db';

// User interface matching Supabase schema
export interface User {
  id: string;
  username: string;
  email?: string;
  tokens: number;
  created_at?: string;
}

// Function to get all users
export const getAllUsers = async (): Promise<User[]> => {
  try {
    console.log('Attempting to get all users from users table');
    
    // Try with simple table name first
    const { data, error } = await supabase
      .from('users')
      .select('id, username, email, tokens, created_at');
    
    if (error) {
      console.error('Error fetching users:', error);
      
      // Try an RPC call as fallback
      console.log('Falling back to RPC method');
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_all_users');
      
      if (rpcError) {
        console.error('Error in RPC call:', rpcError);
        
        // Last resort: Try direct SQL
        console.log('Trying direct SQL query...');
        const { data: sqlData, error: sqlError } = await supabase
          .rpc('execute_sql', { query: 'SELECT id, username, email, tokens, created_at FROM users' });
        
        if (sqlError) {
          console.error('All methods failed to retrieve users:', sqlError);
          return [];
        }
        
        console.log(`Retrieved ${sqlData?.length || 0} users via direct SQL`);
        return sqlData || [];
      }
      
      console.log(`Retrieved ${rpcData?.length || 0} users via RPC`);
      return rpcData || [];
    }
    
    console.log(`Retrieved ${data?.length || 0} users`);
    if (data && data.length > 0) {
      console.log('First user sample:', JSON.stringify(data[0]));
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getAllUsers:', error);
    return [];
  }
};

// Function to get user by ID
export const findUserById = async (id: string): Promise<User | null> => {
  try {
    console.log(`Looking for user with ID: ${id}`);
    
    const { data, error } = await supabase
      .from('users')
      .select('id, username, email, tokens, created_at')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error(`Error fetching user with ID ${id}:`, error);
      return null;
    }
    
    console.log(`Found user: ${data?.username}`);
    return data;
  } catch (error) {
    console.error(`Error in findUserById for ID ${id}:`, error);
    return null;
  }
};

// Function to get user by username
export const findUserByUsername = async (username: string): Promise<User | null> => {
  try {
    console.log(`Looking for user with username: ${username}`);
    
    const { data, error } = await supabase
      .from('users')
      .select('id, username, email, tokens, created_at')
      .eq('username', username)
      .single();
    
    if (error) {
      console.error(`Error fetching user with username ${username}:`, error);
      console.error('Full error object:', JSON.stringify(error));
      return null;
    }
    
    if (data) {
      console.log(`Found user ID: ${data.id}, Email: ${data.email}`);
      return data;
    } else {
      console.log(`No user found with username: ${username}`);
      return null;
    }
  } catch (error) {
    console.error(`Error in findUserByUsername for username ${username}:`, error);
    return null;
  }
};

// Function to transfer tokens between users
export const transferTokens = async (
  senderId: string,
  receiverId: string,
  amount: number
): Promise<boolean> => {
  try {
    console.log(`Transferring ${amount} tokens from ${senderId} to ${receiverId}`);
    
    // Start a Supabase transaction
    const { error: transactionError } = await supabase.rpc('transfer_tokens', {
      sender_id: senderId,
      receiver_id: receiverId,
      amount_to_transfer: amount
    });
    
    if (transactionError) {
      console.error('Error transferring tokens:', transactionError);
      return false;
    }
    
    console.log('Token transfer successful');
    return true;
  } catch (error) {
    console.error('Error in transferTokens:', error);
    return false;
  }
};

// Function to get user's token balance
export const getUserTokens = async (userId: string): Promise<number | null> => {
  try {
    console.log(`Getting token balance for user ${userId}`);
    
    const { data, error } = await supabase
      .from('users')
      .select('tokens')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error(`Error fetching tokens for user ${userId}:`, error);
      return null;
    }
    
    console.log(`User ${userId} has ${data?.tokens} tokens`);
    return data?.tokens || null;
  } catch (error) {
    console.error(`Error in getUserTokens for user ${userId}:`, error);
    return null;
  }
}; 
