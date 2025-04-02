-- Function to transfer tokens between users
CREATE OR REPLACE FUNCTION transfer_tokens(
  sender_id UUID,
  receiver_id UUID,
  amount_to_transfer INT
) RETURNS void AS $$
DECLARE
  sender_tokens INT;
BEGIN
  -- Check if sender has enough tokens
  SELECT tokens INTO sender_tokens FROM users WHERE id = sender_id;
  
  IF sender_tokens IS NULL THEN
    RAISE EXCEPTION 'Sender not found';
  END IF;
  
  IF sender_tokens < amount_to_transfer THEN
    RAISE EXCEPTION 'Insufficient tokens';
  END IF;
  
  -- Update sender's tokens (subtract)
  UPDATE users
  SET tokens = tokens - amount_to_transfer
  WHERE id = sender_id;
  
  -- Update receiver's tokens (add)
  UPDATE users
  SET tokens = tokens + amount_to_transfer
  WHERE id = receiver_id;
  
  -- If receiver doesn't exist, the update will affect 0 rows
  IF NOT FOUND THEN
    -- Rollback the sender's update
    UPDATE users
    SET tokens = tokens + amount_to_transfer
    WHERE id = sender_id;
    
    RAISE EXCEPTION 'Receiver not found';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get all users
CREATE OR REPLACE FUNCTION get_all_users()
RETURNS SETOF users AS $$
BEGIN
  RETURN QUERY SELECT * FROM users;
END;
$$ LANGUAGE plpgsql;

-- Function to execute arbitrary SQL (use with caution, only for privileged users)
CREATE OR REPLACE FUNCTION execute_sql(query text)
RETURNS SETOF json AS $$
BEGIN
  RETURN QUERY EXECUTE query;
END;
$$ LANGUAGE plpgsql; 
