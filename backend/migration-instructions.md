# Manual Migration Instructions for Supabase

Since there are authentication challenges with the automated migration script, please follow these manual steps to apply the migration through the Supabase UI:

1. Log in to your Supabase dashboard at [https://app.supabase.com](https://app.supabase.com)
2. Select your project (`tzkomgshzsmbvodjbglb`)
3. Navigate to the SQL Editor from the left sidebar
4. Create a new query
5. Copy and paste the following SQL:

```sql
-- Create a stored procedure for transferring tokens between users
CREATE OR REPLACE FUNCTION transfer_tokens(
  sender_id TEXT,
  receiver_id TEXT,
  amount_to_transfer INTEGER
) RETURNS VOID AS $$
DECLARE
  sender_tokens INTEGER;
  receiver_exists BOOLEAN;
BEGIN
  -- Check if sender has enough tokens
  SELECT tokens INTO sender_tokens FROM users WHERE id = sender_id::UUID;
  
  -- Check if receiver exists
  SELECT EXISTS(SELECT 1 FROM users WHERE id = receiver_id::UUID) INTO receiver_exists;
  
  IF sender_tokens IS NULL THEN
    RAISE EXCEPTION 'Sender not found';
  END IF;
  
  IF NOT receiver_exists THEN
    RAISE EXCEPTION 'Receiver not found';
  END IF;
  
  IF sender_tokens < amount_to_transfer THEN
    RAISE EXCEPTION 'Insufficient tokens';
  END IF;
  
  -- Begin transaction
  BEGIN
    -- Decrease sender's tokens
    UPDATE users
    SET tokens = tokens - amount_to_transfer
    WHERE id = sender_id::UUID;
    
    -- Increase receiver's tokens
    UPDATE users
    SET tokens = tokens + amount_to_transfer
    WHERE id = receiver_id::UUID;
    
    -- If we get here, both updates succeeded
    -- Transaction will be committed automatically
  EXCEPTION
    WHEN OTHERS THEN
      -- An error occurred, rollback the transaction
      RAISE;
  END;
END;
$$ LANGUAGE plpgsql;
```

6. Click "Run" to execute the SQL and create the stored procedure
7. Verify that the function was created by checking the functions list in your database schema

## Verify Users Table

While in the SQL Editor, also run the following query to verify your users table structure:

```sql
SELECT * FROM users LIMIT 10;
```

Ensure that your users table has the following columns:
- id (UUID)
- username (text)
- email (text)
- tokens (integer)
- created_at (timestamp)

## Add Tokens Column if Missing

If the 'tokens' column doesn't exist in your users table, add it with:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS tokens INTEGER DEFAULT 100;
```

This will add a tokens column with a default value of 100 for each user. 
