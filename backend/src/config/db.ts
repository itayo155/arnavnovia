import { createClient } from '@supabase/supabase-js';
import config from './index';

// Initialize Supabase client
const supabaseUrl = config.supabaseUrl;
const supabaseKey = config.supabaseAnonKey;

// Check if we have a Supabase URL and key
if (!supabaseUrl) {
  console.warn('SUPABASE_URL is not defined. Some features might not work correctly.');
}

if (!supabaseKey) {
  console.warn('SUPABASE_ANON_KEY is not defined. Some features might not work correctly.');
}

const supabase = createClient(supabaseUrl || '', supabaseKey || '');

// Function to test the database connection
export const testConnection = async () => {
  try {
    console.log('Testing Supabase client connection...');
    
    // Try direct SQL query approach
    const { data: sqlData, error: sqlError } = await supabase
      .rpc('get_all_users');
    
    if (sqlError) {
      console.log('SQL RPC function not found, trying direct SQL query...');
      
      // Try direct SQL query
      const { data: directSqlData, error: directSqlError } = await supabase
        .from('users')
        .select('*');
      
      if (directSqlError) {
        console.error('Error with direct table query:', directSqlError);
        
        // Last resort: try querying with direct SQL
        const { data: rawSqlData, error: rawSqlError } = await supabase
          .rpc('execute_sql', { query: 'SELECT * FROM users' });
          
        if (rawSqlError) {
          console.error('All query methods failed. Trying to list tables...');
          
          // Try to list available tables
          const { data: tableData, error: tableError } = await supabase
            .rpc('execute_sql', { query: "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'" });
          
          if (!tableError && tableData) {
            console.log('Available tables found via SQL:');
            console.log(JSON.stringify(tableData, null, 2));
          }
          
          return false;
        }
        
        console.log(`Raw SQL query successful!`);
        console.log(`Found ${rawSqlData?.length || 0} users via raw SQL`);
        
        if (rawSqlData && rawSqlData.length > 0) {
          console.log('First user sample (sensitive info redacted):');
          const sampleUser = { ...rawSqlData[0] };
          if (sampleUser.email) sampleUser.email = '***@***.com';
          console.log(JSON.stringify(sampleUser, null, 2));
        }
        
        return true;
      }
      
      console.log(`Successfully connected to Supabase!`);
      console.log(`Found ${directSqlData?.length || 0} users using direct table query`);
      
      if (directSqlData && directSqlData.length > 0) {
        console.log('First user sample (sensitive info redacted):');
        const sampleUser = { ...directSqlData[0] };
        if (sampleUser.email) sampleUser.email = '***@***.com';
        console.log(JSON.stringify(sampleUser, null, 2));
      }
      
      return true;
    }
    
    console.log(`Successfully connected to Supabase via RPC!`);
    console.log(`Found ${sqlData?.length || 0} users via RPC function`);
    
    if (sqlData && sqlData.length > 0) {
      console.log('First user sample (sensitive info redacted):');
      const sampleUser = { ...sqlData[0] };
      if (sampleUser.email) sampleUser.email = '***@***.com';
      console.log(JSON.stringify(sampleUser, null, 2));
    }
    
    return true;
  } catch (error) {
    console.error('Error testing Supabase connection:', error);
    return false;
  }
};

export { supabase }; 
