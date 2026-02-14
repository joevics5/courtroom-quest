/*
  # Add Preset Cases with Subscription Tiers

  1. Table Modifications
    - Add minimum_tier column to cases table to control access by subscription level

  2. Data Insertions
    - Insert 5 preset cases:
      * 3 cases available for free users (minimum_tier: 'free')
      * 2 cases requiring basic tier (minimum_tier: 'basic')
    
  3. Case Details
    - Case 1 (Free): The Midnight Burglary - Easy difficulty theft case
    - Case 2 (Free): The Corporate Fraud - Medium difficulty white collar crime
    - Case 3 (Free): The Bar Fight - Easy difficulty assault case
    - Case 4 (Basic): The Murder Mystery - Hard difficulty homicide case
    - Case 5 (Basic): The Conspiracy - Hard difficulty organized crime case

  4. Security
    - Update RLS policies to enforce minimum_tier requirements
*/

-- Add minimum_tier column to cases table
ALTER TABLE cases ADD COLUMN IF NOT EXISTS minimum_tier text DEFAULT 'free';

-- Update RLS policy for cases to enforce tier requirements
DROP POLICY IF EXISTS "Preset cases are viewable by all authenticated users" ON cases;

CREATE POLICY "Preset cases viewable by tier"
  ON cases FOR SELECT
  TO authenticated
  USING (
    is_preset = true 
    AND (
      minimum_tier = 'free'
      OR EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.subscription_tier IN ('basic', 'premium', 'enterprise')
      )
    )
  );

-- Insert 5 preset cases
INSERT INTO cases (id, title, description, case_type, difficulty, is_preset, minimum_tier, truth_state, created_by)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'The Midnight Burglary',
    'A residential break-in occurred at 2:30 AM. The homeowner claims $15,000 worth of jewelry was stolen. The defendant was found three blocks away with a crowbar and flashlight. Defend your client against burglary charges.',
    'theft',
    'easy',
    true,
    'free',
    '{"actualEvents": "Defendant was walking home from a late shift and heard breaking glass. Investigated out of concern for neighbors. The actual burglar escaped through the back door.", "keyEvidence": ["Defendant has no stolen property", "Work timecard shows late shift", "No fingerprints match at scene"], "hiddenFacts": "Real burglar is a serial offender who has struck the neighborhood before"}'::jsonb,
    NULL
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'The Corporate Fraud',
    'A mid-level accountant is accused of embezzling $500,000 from their employer through falsified expense reports. The prosecution has bank records showing large deposits. Your client maintains their innocence.',
    'fraud',
    'medium',
    true,
    'free',
    '{"actualEvents": "Client discovered the fraud being committed by their supervisor. Supervisor framed the client when they threatened to report it.", "keyEvidence": ["Supervisor had access to approval system", "Client reported concerns to HR", "Deposits came from legitimate inheritance"], "hiddenFacts": "Supervisor has a gambling addiction and needed the money"}'::jsonb,
    NULL
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'The Bar Fight',
    'Your client is charged with assault after a altercation at a local bar resulted in another patron suffering a broken jaw. Multiple witnesses present. Client claims self-defense.',
    'assault',
    'easy',
    true,
    'free',
    '{"actualEvents": "Victim was intoxicated and aggressive, threw the first punch. Client responded with one defensive strike. Victim fell and hit jaw on bar edge.", "keyEvidence": ["Security footage shows victim throwing first punch", "Client immediately called for medical help", "Toxicology shows victim highly intoxicated"], "hiddenFacts": "Victim has history of starting bar fights when drunk"}'::jsonb,
    NULL
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    'The Murder Mystery',
    'A wealthy business owner was found dead in their office with blunt force trauma. Your client, the business partner, stands accused. They discovered the body and called 911, but prosecutors claim this was to cover their tracks.',
    'homicide',
    'hard',
    true,
    'basic',
    '{"actualEvents": "Victim was killed by their spouse who discovered an affair. Spouse used clients meeting time as cover and planted evidence to frame the partner.", "keyEvidence": ["Blood spatter pattern inconsistent with clients story", "Spouses DNA found under victims nails", "Life insurance policy with spouse as beneficiary"], "hiddenFacts": "Victim was planning to divorce spouse and cut them out of business"}'::jsonb,
    NULL
  ),
  (
    '00000000-0000-0000-0000-000000000005',
    'The Conspiracy',
    'Your client is one of five defendants charged with conspiracy to distribute controlled substances. Federal prosecutors claim they were part of an organized drug trafficking operation spanning three states.',
    'drug_trafficking',
    'hard',
    true,
    'basic',
    '{"actualEvents": "Client owned a legitimate shipping company unwittingly used by drug traffickers. They had no knowledge of the illegal cargo hidden in legitimate shipments.", "keyEvidence": ["No communication with other defendants", "Company had proper inspection procedures", "Drugs were hidden in sealed containers within legitimate cargo"], "hiddenFacts": "One employee was compromised by traffickers and bypassed inspection protocols"}'::jsonb,
    NULL
  );

-- Insert evidence for Case 1: The Midnight Burglary
INSERT INTO evidence (case_id, exhibit_label, title, description, evidence_type, relevance, is_hidden)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'A', 'Police Report', 'Initial police report from scene. Shows defendant found 3 blocks away with crowbar and flashlight at 2:47 AM.', 'document', 'risky', false),
  ('00000000-0000-0000-0000-000000000001', 'B', 'Work Timecard', 'Defendants work schedule showing they clocked out at 2:15 AM, consistent with walking home timeframe.', 'document', 'favorable', false),
  ('00000000-0000-0000-0000-000000000001', 'C', 'Forensic Report', 'No fingerprints matching defendant found at the crime scene. No stolen property found on defendant.', 'document', 'favorable', false);

-- Insert witnesses for Case 1
INSERT INTO witnesses (case_id, name, role, background, base_testimony, knowledge_scope, personality_traits)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'Officer Martinez',
    'Arresting Officer',
    'Patrol officer with 8 years experience. First responder to the scene.',
    'I found the defendant three blocks from the burglary scene at 2:47 AM carrying a crowbar and flashlight. When I asked what he was doing, he seemed nervous and said he heard glass breaking.',
    '{"knows": ["Location defendant was found", "Items in defendants possession", "Defendants demeanor"], "doesNotKnow": ["Who committed the burglary", "Exact timeline of break-in", "Other suspects"]}'::jsonb,
    '{"traits": ["professional", "thorough", "observant"], "biases": ["suspicious of people out late at night"]}'::jsonb
  );

-- Insert evidence for Case 2: The Corporate Fraud
INSERT INTO evidence (case_id, exhibit_label, title, description, evidence_type, relevance, is_hidden)
VALUES
  ('00000000-0000-0000-0000-000000000002', 'A', 'Bank Statements', 'Showing large deposits into defendants account totaling $500,000 over 18 months.', 'document', 'risky', false),
  ('00000000-0000-0000-0000-000000000002', 'B', 'HR Email Chain', 'Email from defendant to HR dated 3 months before arrest expressing concerns about approval process irregularities.', 'document', 'favorable', false),
  ('00000000-0000-0000-0000-000000000002', 'C', 'Inheritance Documents', 'Probate records showing defendant received $485,000 inheritance from deceased uncle.', 'document', 'favorable', true);

-- Insert witnesses for Case 2
INSERT INTO witnesses (case_id, name, role, background, base_testimony, knowledge_scope, personality_traits)
VALUES
  (
    '00000000-0000-0000-0000-000000000002',
    'Sarah Chen',
    'HR Director',
    'HR Director who received the defendants complaint about irregularities.',
    'The defendant did send me an email expressing concerns, but that could have been to establish a paper trail. Many embezzlers try to create the appearance of vigilance.',
    '{"knows": ["Defendant reported concerns", "Company approval processes", "When complaint was filed"], "doesNotKnow": ["Who actually committed fraud", "Details of the scheme", "Defendants personal finances"]}'::jsonb,
    '{"traits": ["cautious", "diplomatic", "defensive of company"], "biases": ["Protective of company reputation"]}'::jsonb
  );

-- Insert evidence for Case 3: The Bar Fight
INSERT INTO evidence (case_id, exhibit_label, title, description, evidence_type, relevance, is_hidden)
VALUES
  ('00000000-0000-0000-0000-000000000003', 'A', 'Security Footage', 'Bar security camera showing the altercation. Quality is grainy but shows two figures in confrontation.', 'photo', 'neutral', false),
  ('00000000-0000-0000-0000-000000000003', 'B', '911 Call Recording', 'Audio of defendant calling 911 immediately after incident requesting medical assistance for injured person.', 'document', 'favorable', false),
  ('00000000-0000-0000-0000-000000000003', 'C', 'Toxicology Report', 'Victims blood alcohol content was 0.18%, more than twice the legal limit.', 'document', 'favorable', false);

-- Insert witnesses for Case 3
INSERT INTO witnesses (case_id, name, role, background, base_testimony, knowledge_scope, personality_traits)
VALUES
  (
    '00000000-0000-0000-0000-000000000003',
    'Marcus Johnson',
    'Bartender',
    'Bartender on duty the night of the incident. Has worked at the bar for 5 years.',
    'I saw them arguing but I was serving other customers. I heard a commotion and when I looked over, the victim was on the ground. The defendant was backing away with his hands up.',
    '{"knows": ["Victim appeared very drunk", "General sequence of events", "Defendant called for help"], "doesNotKnow": ["Who threw first punch", "Exact words exchanged", "What started the argument"]}'::jsonb,
    '{"traits": ["observant", "honest", "busy/distracted"], "biases": ["Sympathetic to defendants who call for help"]}'::jsonb
  );

-- Insert evidence for Case 4: The Murder Mystery  
INSERT INTO evidence (case_id, exhibit_label, title, description, evidence_type, relevance, is_hidden)
VALUES
  ('00000000-0000-0000-0000-000000000004', 'A', 'Crime Scene Photos', 'Photos showing victim with blunt force trauma. Body found behind desk in locked office.', 'photo', 'neutral', false),
  ('00000000-0000-0000-0000-000000000004', 'B', 'Blood Spatter Analysis', 'Forensic report analyzing blood distribution. Pattern suggests attacker was shorter than 5 feet 7 inches. Defendant is over 6 feet tall.', 'document', 'favorable', true),
  ('00000000-0000-0000-0000-000000000004', 'C', 'Life Insurance Policy', '$2 million policy with spouse as sole beneficiary, taken out 6 months before death.', 'document', 'favorable', true);

-- Insert witnesses for Case 4
INSERT INTO witnesses (case_id, name, role, background, base_testimony, knowledge_scope, personality_traits)
VALUES
  (
    '00000000-0000-0000-0000-000000000004',
    'Dr. Elizabeth Warren',
    'Medical Examiner',
    'County medical examiner with 15 years experience. Performed autopsy on victim.',
    'Cause of death was blunt force trauma to the head. Time of death approximately 9:00 PM. I found defensive wounds and DNA under the victims fingernails that we are still analyzing.',
    '{"knows": ["Exact cause of death", "Time of death", "Physical evidence on body"], "doesNotKnow": ["Identity of killer", "Motive", "How killer entered office"]}'::jsonb,
    '{"traits": ["analytical", "precise", "objective"], "biases": ["Relies only on physical evidence"]}'::jsonb
  );

-- Insert evidence for Case 5: The Conspiracy
INSERT INTO evidence (case_id, exhibit_label, title, description, evidence_type, relevance, is_hidden)
VALUES
  ('00000000-0000-0000-0000-000000000005', 'A', 'Wiretap Transcripts', 'Federal wiretap recordings of other defendants discussing drug shipments. Your client is never mentioned.', 'document', 'favorable', false),
  ('00000000-0000-0000-0000-000000000005', 'B', 'Shipping Manifests', 'Company records showing all shipments logged and declared. No irregularities in paperwork.', 'document', 'favorable', false),
  ('00000000-0000-0000-0000-000000000005', 'C', 'Employee Background Check', 'Background check on warehouse employee showing prior conviction for drug possession.', 'document', 'favorable', true);

-- Insert witnesses for Case 5
INSERT INTO witnesses (case_id, name, role, background, base_testimony, knowledge_scope, personality_traits)
VALUES
  (
    '00000000-0000-0000-0000-000000000005',
    'Agent Rodriguez',
    'DEA Agent',
    'Lead DEA agent on the investigation. 12 years with the agency.',
    'Our investigation tracked shipments through this defendants company. While we have no direct evidence of your clients involvement, the scale of the operation suggests knowledge at the management level.',
    '{"knows": ["Details of drug operation", "Trafficking routes", "Other defendants"], "doesNotKnow": ["Clients actual knowledge", "Internal company procedures", "Which employee was compromised"]}'::jsonb,
    '{"traits": ["determined", "suspicious", "experienced"], "biases": ["Assumes management knew about illegal activity"]}'::jsonb
  );