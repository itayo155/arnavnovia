import { supabase } from '../config/db';

// User interface matching Supabase schema
export interface User {
  id: string;
  username: string;
  email?: string;
  tokens: number;
  created_at?: string;
  is_visible: boolean;
}

// Interface for transactions
export interface Transaction {
  id: string;
  from_user_id: string;
  to_user_id: string;
  points: number;
  created_at: string;
  from_username?: string; // Will be populated after database query
  to_username?: string; // Will be populated after database query
}

// Function to get all users
export const getAllUsers = async (visibleOnly: boolean = true): Promise<User[]> => {
  try {
    console.log(`Attempting to get all users from users table (visibleOnly = ${visibleOnly})`);
    
    // Try with simple table name first
    let { data, error } = await supabase
      .from('users')
      .select('id, username, email, tokens, created_at, is_visible');

    if (visibleOnly && data) {
      data = data?.filter(user => user.is_visible);
    }
    
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
// only returns visible users
export const findUserById = async (id: string): Promise<User | null> => {
  try {
    console.log(`Looking for user with ID: ${id}`);
    
    const { data, error } = await supabase
      .from('users')
      .select('id, username, email, tokens, created_at, is_visible')
      .eq('id', id)
      .eq('is_visible', true)
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
// only returns visible users
export const findUserByUsername = async (username: string): Promise<User | null> => {
  try {
    console.log(`Looking for user with username: ${username}`);
    
    const { data, error } = await supabase
      .from('users')
      .select('id, username, email, tokens, created_at, is_visible')
      .eq('username', username)
      .eq('is_visible', true)
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
    
    // Log the transaction to the transactions table
    const { error: logError } = await supabase
      .from('transactions')
      .insert({
        from_user_id: senderId,
        to_user_id: receiverId,
        points: amount,
        // created_at will be set automatically by Supabase
      });
    
    if (logError) {
      // Log error but don't fail the transaction as the tokens were already transferred
      console.error('Error logging transaction:', logError);
      console.error('Transaction was successful but not logged to history');
    } else {
      console.log('Transaction logged to history successfully');
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

// Function to get user's transaction history
export const getUserTransactions = async (userId: string, limit: number = 20): Promise<Transaction[]> => {
  try {
    console.log(`Getting transaction history for user ${userId}`);
    
    // Query transactions where user is either sender or receiver
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error(`Error fetching transactions for user ${userId}:`, error);
      return [];
    }
    
    if (!data || data.length === 0) {
      console.log(`No transactions found for user ${userId}`);
      return [];
    }
    
    console.log(`Found ${data.length} transactions for user ${userId}`);
    
    // Get all unique user IDs from the transactions
    const userIds = new Set<string>();
    data.forEach(transaction => {
      userIds.add(transaction.from_user_id);
      userIds.add(transaction.to_user_id);
    });
    
    // Get usernames for all users involved in transactions
    const userIdArray = Array.from(userIds);
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, username')
      .in('id', userIdArray);
    
    if (userError || !userData) {
      console.error('Error fetching usernames for transactions:', userError);
      return data; // Return transactions without usernames
    }
    
    // Create a map of user IDs to usernames
    const usernameMap: Record<string, string> = {};
    userData.forEach(user => {
      usernameMap[user.id] = user.username;
    });
    
    // Add usernames to each transaction
    const transactionsWithUsernames = data.map(transaction => ({
      ...transaction,
      from_username: usernameMap[transaction.from_user_id] || 'Unknown',
      to_username: usernameMap[transaction.to_user_id] || 'Unknown'
    }));
    
    return transactionsWithUsernames;
  } catch (error) {
    console.error(`Error in getUserTransactions for user ${userId}:`, error);
    return [];
  }
}; 
