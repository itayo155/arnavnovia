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
