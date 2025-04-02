import express from 'express';
import { login, getCurrentUser, getEmailByUsername, createUserIfNotExists } from '../controllers/authController';
import { protect } from '../middleware/authMiddleware';
import { supabase } from '../config/db';

const router = express.Router();

// Public routes
router.post('/login', login);
router.post('/get-email-by-username', getEmailByUsername);
router.post('/create-user', createUserIfNotExists);

// Debug route to list tables
router.get('/debug/tables', async (req, res) => {
  try {
    // Get a list of all tables
    const { data: tables, error: tablesError } = await supabase
      .from('pg_catalog.pg_tables')
      .select('tablename, schemaname')
      .eq('schemaname', 'public');
    
    if (tablesError) {
      console.error('Error fetching tables:', tablesError);
    }
    
    // Check auth schema tables
    const { data: authTables, error: authTablesError } = await supabase
      .from('pg_catalog.pg_tables')
      .select('tablename, schemaname')
      .eq('schemaname', 'auth');
      
    // Try to query each table to see what's there
    const tableData: Record<string, {
      error: string | null,
      count: number,
      sample: any | null
    }> = {};
    
    if (tables && tables.length) {
      for (const table of tables) {
        const { data, error } = await supabase
          .from(table.tablename)
          .select('*')
          .limit(5);
          
        tableData[table.tablename] = {
          error: error ? error.message : null,
          count: data ? data.length : 0,
          sample: data && data.length ? data[0] : null
        };
      }
    }
    
    res.json({
      publicTables: tables || [],
      authTables: authTables || [],
      tableData
    });
  } catch (err) {
    const error = err as Error;
    console.error('Debug endpoint error:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// Protected routes
router.get('/me', protect, getCurrentUser);

export default router; 
