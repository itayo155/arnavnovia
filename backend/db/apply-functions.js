const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or key in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyFunctions() {
  try {
    console.log('Reading SQL function script...');
    const sqlScript = fs.readFileSync(path.resolve(__dirname, './scripts/create_functions.sql'), 'utf8');
    
    console.log('Applying functions to Supabase...');
    const functions = sqlScript.split(';').filter(fn => fn.trim().length > 0);
    
    for (const fnSql of functions) {
      console.log(`Executing function: ${fnSql.slice(0, 50)}...`);
      const { error } = await supabase.rpc('execute_sql', { query: fnSql });
      
      if (error) {
        console.log('Error executing function:');
        console.error(error);
        
        // If the execute_sql function doesn't exist yet, we need a different approach
        if (error.message.includes('function execute_sql() does not exist')) {
          console.log('The execute_sql function does not exist yet. Please create it manually in the Supabase Dashboard SQL Editor:');
          console.log(sqlScript);
          process.exit(1);
        }
      } else {
        console.log('Successfully applied function');
      }
    }
    
    console.log('All functions applied successfully!');
  } catch (error) {
    console.error('Error applying functions:', error);
    process.exit(1);
  }
}

applyFunctions(); 
