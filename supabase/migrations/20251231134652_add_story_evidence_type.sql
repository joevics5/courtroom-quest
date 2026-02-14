/*
  # Add Story Evidence Type

  ## Overview
  Adds support for 'story' evidence type - a slideshow of images that users can navigate through.

  ## Changes Made

  1. **Story Evidence Type**
     - New evidence_type: 'story'
     - Content format: newline-separated list of image URLs
     - Supports left/right navigation and touch gestures
     - Displays thumbnail gallery for quick navigation

  2. **Usage**
     - Store multiple image URLs in the content field, one per line
     - Each URL should be a valid HTTP/HTTPS image URL
     - Frontend automatically detects story type and renders slideshow interface

  ## Example Content Format
  ```
  https://example.com/image1.jpg
  https://example.com/image2.jpg
  https://example.com/image3.jpg
  ```

  ## Notes
  - No schema changes required (evidence_type is text field)
  - This migration serves as documentation for the new type
  - Existing evidence types remain unchanged
*/

-- No schema changes needed - evidence_type is already a text field
-- This migration documents the new 'story' evidence type for reference

-- Create comment on evidence_type column to document all valid types
COMMENT ON COLUMN evidence.evidence_type IS 'Valid types: documents, photographs, video_recordings, audio_recordings, witness_testimony, physical_evidence, digital_evidence, expert_reports, confessions_statements, timeline_logs, story';
