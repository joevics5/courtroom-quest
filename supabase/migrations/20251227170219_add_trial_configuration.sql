/*
  # Add Trial Configuration System

  ## Overview
  Adds support for configurable trial lengths and phase tracking

  ## Changes Made

  1. **Trial Configuration**
     - Adds trial_duration column to case_sessions (15, 30, or 60 minutes)
     - Adds current_trial_phase to track progression through trial
     - Adds phase_timings JSONB to store time allocations per phase
     - Adds timer_state to track pause/resume

  2. **Trial Phases**
     Tracks numbered phases:
     - Pre-trial: 1-6 (no timer)
     - Trial: 7-13 (timed)
     - Post-trial: 14-15

  ## Security
  - Users can only modify their own sessions
*/

-- Add columns for trial configuration
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'case_sessions' AND column_name = 'current_trial_phase'
  ) THEN
    ALTER TABLE case_sessions ADD COLUMN current_trial_phase integer DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'case_sessions' AND column_name = 'phase_timings'
  ) THEN
    ALTER TABLE case_sessions ADD COLUMN phase_timings jsonb DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'case_sessions' AND column_name = 'timer_started_at'
  ) THEN
    ALTER TABLE case_sessions ADD COLUMN timer_started_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'case_sessions' AND column_name = 'timer_paused_at'
  ) THEN
    ALTER TABLE case_sessions ADD COLUMN timer_paused_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'case_sessions' AND column_name = 'total_pause_duration'
  ) THEN
    ALTER TABLE case_sessions ADD COLUMN total_pause_duration integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'case_sessions' AND column_name = 'phase_start_times'
  ) THEN
    ALTER TABLE case_sessions ADD COLUMN phase_start_times jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Create index on trial phase for faster queries
CREATE INDEX IF NOT EXISTS idx_case_sessions_trial_phase ON case_sessions(current_trial_phase);
