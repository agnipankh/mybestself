-- Migration: Add dashboard visualization fields
-- Date: 2025-07-01
-- Description: Add planned_hours, actual_hours to goals and importance to personas

BEGIN;

-- Add new columns to personas table
ALTER TABLE personas 
ADD COLUMN IF NOT EXISTS importance INTEGER DEFAULT 3;

-- Add comment for the importance field
COMMENT ON COLUMN personas.importance IS '1-5 importance scale for user prioritization in dashboard';

-- Add new columns to goals table  
ALTER TABLE goals 
ADD COLUMN IF NOT EXISTS planned_hours INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS actual_hours INTEGER DEFAULT 0;

-- Add comments for the new fields
COMMENT ON COLUMN goals.planned_hours IS 'Hours user planned to spend on this goal';
COMMENT ON COLUMN goals.actual_hours IS 'Hours user actually spent on this goal';

-- Update any existing records to have default values (in case there are any)
UPDATE personas SET importance = 3 WHERE importance IS NULL;
UPDATE goals SET planned_hours = 0 WHERE planned_hours IS NULL;
UPDATE goals SET actual_hours = 0 WHERE actual_hours IS NULL;

COMMIT;

-- Verify the changes
\d personas;
\d goals;