-- Migration: Add agent system fields to conversations table
-- Run this to update existing database schema for the agent system

-- Add agent system columns to conversations table
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS agent_type VARCHAR DEFAULT 'educational',
ADD COLUMN IF NOT EXISTS context_state JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS intent VARCHAR,
ADD COLUMN IF NOT EXISTS intent_confidence FLOAT DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS session_id UUID,
ADD COLUMN IF NOT EXISTS session_started_at TIMESTAMP;

-- Add helpful comment
COMMENT ON COLUMN conversations.agent_type IS 'Current agent handling this conversation (educational, discovery, etc.)';
COMMENT ON COLUMN conversations.context_state IS 'Agent-specific context data stored as JSONB';
COMMENT ON COLUMN conversations.intent IS 'Last detected user intent';
COMMENT ON COLUMN conversations.intent_confidence IS 'Confidence score for intent detection (0.0-1.0)';
COMMENT ON COLUMN conversations.session_id IS 'Groups related conversations in a user session';
COMMENT ON COLUMN conversations.session_started_at IS 'When the session began';

-- Verify the changes
\d conversations;