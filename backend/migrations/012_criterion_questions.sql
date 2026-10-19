-- Author-provided prompts are shown beside each criterion; existing names/weights stay intact.
ALTER TABLE criterion ADD COLUMN IF NOT EXISTS question text;
