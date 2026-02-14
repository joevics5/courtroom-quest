/*
  # Add Levels, Rankings, and Case Winners System

  1. Updates
    - Add wins_count to user_profiles table
    - Add current_level to user_profiles table for level tracking
    
  2. New Tables
    - `case_winners`
      - `id` (uuid, primary key)
      - `case_id` (uuid, foreign key to cases)
      - `user_id` (uuid, foreign key to auth.users)
      - `username` (text)
      - `level_achieved` (text)
      - `verdict_score` (integer)
      - `won_at` (timestamptz)
      
  3. Security
    - Enable RLS on case_winners table
    - Add policy for users to view all winners
    - Add policy for authenticated users to add their own wins
*/

-- Add wins tracking to user profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'wins_count'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN wins_count integer DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'current_level'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN current_level text DEFAULT 'Practicing Attorney';
  END IF;
END $$;

-- Create case_winners table
CREATE TABLE IF NOT EXISTS case_winners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  username text NOT NULL,
  level_achieved text NOT NULL,
  verdict_score integer DEFAULT 0,
  won_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE case_winners ENABLE ROW LEVEL SECURITY;

-- Allow everyone to view winners
CREATE POLICY "Anyone can view case winners"
  ON case_winners FOR SELECT
  TO authenticated
  USING (true);

-- Allow users to add their own wins
CREATE POLICY "Users can add their own wins"
  ON case_winners FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_case_winners_case_id ON case_winners(case_id);
CREATE INDEX IF NOT EXISTS idx_case_winners_user_id ON case_winners(user_id);
CREATE INDEX IF NOT EXISTS idx_case_winners_won_at ON case_winners(won_at DESC);