-- Migration: 042_support_chat_survey.sql
-- Purpose: Add rating and rating_comment columns to chat_sessions table for post-chat feedback.

-- 1. Add rating column (integer, checked between 1 and 5)
ALTER TABLE chat_sessions 
  ADD COLUMN IF NOT EXISTS rating integer CHECK (rating >= 1 AND rating <= 5);

-- 2. Add rating_comment column (text)
ALTER TABLE chat_sessions 
  ADD COLUMN IF NOT EXISTS rating_comment text;
