-- Add role column to users table if it doesn't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- Update existing users to have 'user' role if null
UPDATE users SET role = 'user' WHERE role IS NULL;

-- Ensure RLS policies allow admin to manage users (optional, depending on setup)
-- CREATE POLICY "Admins can manage all users" ON users FOR ALL USING (role = 'admin');
