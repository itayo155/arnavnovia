// API utility for token transfer app
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = isDevelopment 
  ? 'http://localhost:3001/api'
  : 'https://api.arnavnovia.com/api';

// Supabase configuration
const SUPABASE_URL = 'https://tzkomgshzsmbvodjbglb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6a29tZ3NoenNtYnZvZGpiZ2xiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk0NTM5NzUsImV4cCI6MjA1NTAyOTk3NX0.BXRm_mwxU6UzQL6yWl90onuQ4ZiYixzbcV1UEVwjAlw';

// Load Supabase client dynamically
let supabase = null;
function loadSupabase() {
  if (!supabase) {
    // Check if Supabase client has been loaded
    if (typeof window.supabase === 'undefined') {
      console.error('Supabase client not loaded! Make sure to include the Supabase script.');
      return null;
    }
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabase;
}

// Function to handle API errors
const handleApiError = (error) => {
  console.error('API Error:', error);
  
  if (error.message === 'Failed to fetch') {
    return { error: 'Network error. Please check your connection or the server may be down.' };
  }
  
  return { error: error.message || 'An unknown error occurred' };
};

// Auth API
const auth = {
  // Login user directly with Supabase
  login: async (usernameOrEmail, password) => {
    try {
      const sb = loadSupabase();
      if (!sb) {
        throw new Error('Supabase client not available');
      }
      
      // Check if the input is an email
      const isEmail = usernameOrEmail.includes('@');
      let email;
      let username = usernameOrEmail;
      
      if (isEmail) {
        // If it's an email, use it directly
        console.log('Input appears to be an email, using it directly');
        email = usernameOrEmail;
      } else {
        // Otherwise, get user's email from our backend
        console.log('Getting email for username from backend');
        const emailResponse = await fetch(`${API_BASE_URL}/auth/get-email-by-username`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ username: usernameOrEmail })
        });
        
        if (!emailResponse.ok) {
          // Handle specific error cases
          if (emailResponse.status === 404) {
            throw new Error('שם המשתמש לא נמצא. אנא בדוק את שם המשתמש או השתמש באימייל להתחברות');
          }
          
          const emailData = await emailResponse.json();
          throw new Error(emailData.message || 'Failed to find user');
        }
        
        const emailData = await emailResponse.json();
        email = emailData.data.email;
        
        // If response indicated this was actually an email
        if (emailData.data.isEmail) {
          username = email.split('@')[0]; // Extract username part from email
        }
      }
      
      console.log(`Attempting to sign in with email: ${email}`);
      
      // Sign in with Supabase
      const { data, error } = await sb.auth.signInWithPassword({
        email: email,
        password: password
      });
      
      if (error) {
        // Enhance error messages for better user experience
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('סיסמה שגויה. אנא נסה שוב');
        }
        throw new Error(error.message || 'Login failed');
      }
      
      // New code: Create user in custom table if not exists
      try {
        console.log('Ensuring user exists in custom table...');
        const createUserResponse = await fetch(`${API_BASE_URL}/auth/create-user`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${data.session.access_token}`
          },
          body: JSON.stringify({
            username: isEmail ? email.split('@')[0] : username
          })
        });
        
        const createUserData = await createUserResponse.json();
        
        if (!createUserResponse.ok) {
          console.error('Failed to create user in custom table:', createUserData.message);
        } else {
          console.log('User created or verified in custom table:', createUserData.message);
        }
      } catch (createUserError) {
        console.error('Error creating user in custom table:', createUserError);
      }
      
      // Get user data from our backend or construct a minimal user if not available
      try {
        const userResponse = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${data.session.access_token}`
          }
        });
        
        const userData = await userResponse.json();
        
        if (!userResponse.ok) {
          console.warn('Could not get detailed user info, using minimal user data');
          // Create minimal user data
          const user = {
            id: data.user.id,
            username: isEmail ? email.split('@')[0] : username, // Use part before @ if email was used
            email: email,
            tokens: 0 // Default tokens
          };
          
          // Store auth token in localStorage
          localStorage.setItem('token', data.session.access_token);
          localStorage.setItem('refreshToken', data.session.refresh_token);
          localStorage.setItem('user', JSON.stringify(user));
          
          return { 
            success: true, 
            data: { 
              user: user,
              accessToken: data.session.access_token,
              refreshToken: data.session.refresh_token
            } 
          };
        }
        
        // Store auth token in localStorage
        localStorage.setItem('token', data.session.access_token);
        localStorage.setItem('refreshToken', data.session.refresh_token);
        localStorage.setItem('user', JSON.stringify(userData.data.user));
        
        return { 
          success: true, 
          data: { 
            user: userData.data.user,
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token
          } 
        };
      } catch (profileError) {
        console.error('Error getting user profile:', profileError);
        // Create minimal user data
        const user = {
          id: data.user.id,
          username: isEmail ? email.split('@')[0] : username,
          email: email,
          tokens: 0
        };
        
        // Store auth token in localStorage
        localStorage.setItem('token', data.session.access_token);
        localStorage.setItem('refreshToken', data.session.refresh_token);
        localStorage.setItem('user', JSON.stringify(user));
        
        return { 
          success: true, 
          data: { 
            user: user,
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token
          } 
        };
      }
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  // Request password reset
  resetPassword: async (email) => {
    try {
      const sb = loadSupabase();
      if (!sb) {
        throw new Error('Supabase client not available');
      }
      
      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: 'http://localhost:8080/HTML/reset-password.html',
      });
      
      if (error) {
        throw new Error(error.message || 'Password reset request failed');
      }
      
      return { success: true };
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  // Get current user info
  getCurrentUser: async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to get user info');
      }
      
      // Update stored user data
      localStorage.setItem('user', JSON.stringify(data.data.user));
      
      return { success: true, user: data.data.user };
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  // Logout user
  logout: async () => {
    try {
      const sb = loadSupabase();
      if (sb) {
        await sb.auth.signOut();
      }
      
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      
      // Redirect to login page
      window.location.href = 'index.html';
      return { success: true };
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  // Check if user is logged in
  isLoggedIn: () => {
    return localStorage.getItem('token') !== null;
  }
};

// Token API
const tokens = {
  // Get token balance
  getBalance: async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      const response = await fetch(`${API_BASE_URL}/tokens/balance`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to get token balance');
      }
      
      return { success: true, tokens: data.data.tokens };
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  // Transfer tokens
  transfer: async (receiverId, amount) => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      const response = await fetch(`${API_BASE_URL}/tokens/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ receiverId, amount })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to transfer tokens');
      }
      
      return { 
        success: true, 
        message: data.message,
        currentBalance: data.data.currentBalance 
      };
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  // Get all users for dropdown
  getUsers: async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      const response = await fetch(`${API_BASE_URL}/tokens/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to get users');
      }
      
      return { success: true, users: data.data.users };
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  // Get transaction history
  getTransactions: async (limit = 20) => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      const response = await fetch(`${API_BASE_URL}/tokens/transactions?limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to get transaction history');
      }
      
      return { success: true, transactions: data.data.transactions };
    } catch (error) {
      return handleApiError(error);
    }
  }
};

// Export API modules
const api = {
  auth,
  tokens
}; 
