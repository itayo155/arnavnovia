import { supabase } from '../config/db';
import * as fs from 'fs';
import * as path from 'path';

// Function to run migrations
async function runMigrations() {
  try {
    console.log('Running database migrations...');
    
    // Get all SQL files in migrations directory
    const migrationsDir = path.join(__dirname, 'migrations');
    console.log(`Migrations directory: ${migrationsDir}`);
    
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Sort to ensure migrations run in order
    
    console.log(`Found ${files.length} migration files: ${files.join(', ')}`);
    
    // Run each migration file using Supabase SQL execution
    for (const file of files) {
      console.log(`Running migration: ${file}`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');
      console.log(`SQL file contents length: ${sql.length} characters`);
      
      try {
        // Execute SQL using Supabase's rpc function
        const { error } = await supabase.rpc('exec_sql', { query: sql });
        
        if (error) {
          console.error(`Error executing migration ${file}:`, error);
          throw error;
        }
        
        console.log(`Migration ${file} completed successfully.`);
      } catch (error) {
        console.error(`Error executing migration ${file}:`, error);
        throw error;
      }
    }
    
    console.log('All migrations completed successfully.');
  } catch (error: any) {
    console.error('Error running migrations:', error);
    if (error.code) {
      console.error(`Error code: ${error.code}`);
    }
    if (error.detail) {
      console.error(`Error detail: ${error.detail}`);
    }
    process.exit(1);
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations().then(() => {
    console.log('Migration process completed.');
    process.exit(0);
  }).catch(err => {
    console.error('Migration failed with error:', err);
    process.exit(1);
  });
}

export default runMigrations; 
