-- Add name and context_json columns to brands table
ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS context_json TEXT;
