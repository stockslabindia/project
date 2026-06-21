-- Migration: 041_support_chat_media.sql
-- Purpose: Add 'image' and 'document' message types to support media/document sharing in chat.

-- 1. Drop existing message type check constraint if it exists
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_message_type_check;

-- 2. Add updated check constraint to allow 'image' and 'document'
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_message_type_check 
  CHECK (message_type IN ('text', 'options', 'system', 'image', 'document'));
