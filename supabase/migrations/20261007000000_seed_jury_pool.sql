-- Seed the jurors table.
--
-- The table has existed since 20251227153200_add_enhanced_features.sql, but
-- nothing ever inserted rows into it: JurySelection.tsx's live jury-trial
-- flow calls db.jurors.getRandomJurors()/getJurorsByIds() against this exact
-- table, so with it empty, jury-trial selection returns no candidates and
-- jury trials cannot be played. This seeds the 50 jurors (reusing the
-- names/ages/occupations/backgrounds already written for the old, unused
-- static pool in src/lib/trial/juryPool.ts) with real data.
--
-- personality_traits and biases aren't cosmetic: generateJuryDeliberation()
-- in src/lib/ai/trialAI.ts feeds both into each juror's own AI deliberation
-- prompt, so they shape how that juror actually votes.
--
-- Guarded by a name check so this migration is safe to run more than once
-- without duplicating rows.
INSERT INTO jurors (name, age, occupation, background, personality_traits, biases)
SELECT * FROM (VALUES
  ('Juror #1', 55, 'Dentist', 'Owns a private clinic, values procedure and documentation.', '["methodical","by-the-book"]'::jsonb, '["skeptical of claims not backed by documentation or records"]'::jsonb),
  ('Juror #2', 34, 'Civil Engineer', 'Works on infrastructure projects, analytical thinker.', '["analytical","logical"]'::jsonb, '["wants hard evidence over emotional appeals"]'::jsonb),
  ('Juror #3', 42, 'Elementary School Teacher', 'Works with children daily, values clear communication.', '["patient","communicative"]'::jsonb, '["distrusts witnesses who seem evasive or unclear"]'::jsonb),
  ('Juror #4', 28, 'Software Developer', 'Logical problem solver, prefers evidence-based conclusions.', '["logical","detail-oriented"]'::jsonb, '["looks for inconsistencies and gaps in the story"]'::jsonb),
  ('Juror #5', 61, 'Retired Accountant', 'Detail-oriented, follows rules carefully.', '["precise","rule-abiding"]'::jsonb, '["weighs procedural correctness heavily"]'::jsonb),
  ('Juror #6', 39, 'Nurse', 'Works in emergency room, accustomed to high-pressure decisions.', '["calm under pressure","empathetic"]'::jsonb, '["sympathetic to witnesses who appear distressed or traumatized"]'::jsonb),
  ('Juror #7', 47, 'Construction Manager', 'Oversees large projects, values practical outcomes.', '["practical","no-nonsense"]'::jsonb, '["impatient with long-winded or overly technical arguments"]'::jsonb),
  ('Juror #8', 31, 'Graphic Designer', 'Creative professional, looks at situations from multiple angles.', '["open-minded","perceptive"]'::jsonb, '["considers alternate explanations before settling on one"]'::jsonb),
  ('Juror #9', 53, 'Police Officer', 'Law enforcement experience, understands legal procedures.', '["procedural","observant"]'::jsonb, '["tends to trust official testimony and proper procedure"]'::jsonb),
  ('Juror #10', 45, 'Real Estate Agent', 'Negotiates daily, values clear terms and agreements.', '["persuasive","people-reader"]'::jsonb, '["notices when a witness is overselling their story"]'::jsonb),
  ('Juror #11', 37, 'Chef', 'Runs a restaurant kitchen, makes quick decisions under pressure.', '["decisive","intuitive"]'::jsonb, '["trusts gut read on credibility as much as the facts"]'::jsonb),
  ('Juror #12', 58, 'Bank Manager', 'Financial professional, risk-averse and methodical.', '["risk-averse","methodical"]'::jsonb, '["requires a high bar of certainty before committing to a verdict"]'::jsonb),
  ('Juror #13', 29, 'Journalist', 'Investigates stories, questions assumptions.', '["inquisitive","skeptical"]'::jsonb, '["questions whether each side’s narrative holds up to scrutiny"]'::jsonb),
  ('Juror #14', 44, 'Electrician', 'Trade professional, practical problem solver.', '["hands-on","practical"]'::jsonb, '["prefers concrete evidence over theory or speculation"]'::jsonb),
  ('Juror #15', 52, 'Social Worker', 'Works with diverse populations, empathetic listener.', '["empathetic","nonjudgmental"]'::jsonb, '["considers context and circumstance, not just the bare facts"]'::jsonb),
  ('Juror #16', 35, 'Marketing Manager', 'Analyzes consumer behavior, persuasion-aware.', '["persuasion-aware","analytical"]'::jsonb, '["discounts arguments that feel like a sales pitch"]'::jsonb),
  ('Juror #17', 48, 'Pharmacist', 'Medical professional, values scientific evidence.', '["scientific","precise"]'::jsonb, '["gives extra weight to expert or medical testimony"]'::jsonb),
  ('Juror #18', 33, 'Mechanic', 'Diagnoses problems methodically, hands-on thinker.', '["methodical","hands-on"]'::jsonb, '["wants the sequence of events to add up logically"]'::jsonb),
  ('Juror #19', 56, 'Librarian', 'Information specialist, thorough researcher.', '["thorough","patient"]'::jsonb, '["notices when a claim isn’t actually backed by what was presented"]'::jsonb),
  ('Juror #20', 41, 'Truck Driver', 'Independent worker, values honesty and directness.', '["plainspoken","independent-minded"]'::jsonb, '["distrusts witnesses who seem to be dodging a direct question"]'::jsonb),
  ('Juror #21', 30, 'Yoga Instructor', 'Wellness professional, calm and reflective.', '["calm","reflective"]'::jsonb, '["slow to judge, prefers to sit with the evidence before deciding"]'::jsonb),
  ('Juror #22', 49, 'Architect', 'Designs buildings, thinks structurally and systematically.', '["systematic","big-picture thinker"]'::jsonb, '["looks at how all the pieces of the case fit together"]'::jsonb),
  ('Juror #23', 38, 'Flight Attendant', 'Service industry, experienced with conflict resolution.', '["composed","diplomatic"]'::jsonb, '["picks up on tension or inconsistency in how someone testifies"]'::jsonb),
  ('Juror #24', 54, 'Insurance Agent', 'Risk assessor, evaluates probability and liability.', '["probabilistic thinker","cautious"]'::jsonb, '["weighs which explanation is more likely, not just possible"]'::jsonb),
  ('Juror #25', 32, 'Personal Trainer', 'Motivational, focused on goals and outcomes.', '["goal-oriented","direct"]'::jsonb, '["wants a clear, convincing case rather than a muddled one"]'::jsonb),
  ('Juror #26', 46, 'Veterinarian', 'Medical professional, compassionate decision maker.', '["compassionate","clinical"]'::jsonb, '["balances sympathy for a party against what the evidence shows"]'::jsonb),
  ('Juror #27', 36, 'HR Manager', 'Handles workplace disputes, fair-minded.', '["fair-minded","diplomatic"]'::jsonb, '["tries to hear both sides evenly before leaning either way"]'::jsonb),
  ('Juror #28', 50, 'Plumber', 'Trade professional, solves problems efficiently.', '["efficient","practical"]'::jsonb, '["has little patience for arguments that dodge the actual issue"]'::jsonb),
  ('Juror #29', 27, 'Data Analyst', 'Works with statistics, evidence-driven mindset.', '["evidence-driven","rigorous"]'::jsonb, '["heavily discounts claims unsupported by the record"]'::jsonb),
  ('Juror #30', 43, 'Salesperson', 'Reads people well, understands persuasion tactics.', '["people-reader","persuasion-aware"]'::jsonb, '["can spot when a witness is overstating their certainty"]'::jsonb),
  ('Juror #31', 57, 'Museum Curator', 'Preserves history, values authenticity and accuracy.', '["precise","historically minded"]'::jsonb, '["cares about whether the account is accurate, not just compelling"]'::jsonb),
  ('Juror #32', 40, 'Firefighter', 'Emergency responder, makes critical decisions quickly.', '["decisive","level-headed"]'::jsonb, '["forms a judgment quickly once the key facts are clear"]'::jsonb),
  ('Juror #33', 26, 'Barista', 'Service worker, interacts with diverse people daily.', '["approachable","observant"]'::jsonb, '["reads a lot into tone and demeanor on the stand"]'::jsonb),
  ('Juror #34', 51, 'Tax Preparer', 'Detail-focused, follows regulations carefully.', '["detail-focused","rule-abiding"]'::jsonb, '["notices small inconsistencies others might skip past"]'::jsonb),
  ('Juror #35', 39, 'Photographer', 'Visual thinker, observes details others miss.', '["observant","visual thinker"]'::jsonb, '["pays close attention to what the physical evidence actually shows"]'::jsonb),
  ('Juror #36', 45, 'Postal Worker', 'Government employee, reliable and punctual.', '["reliable","steady"]'::jsonb, '["values a consistent, straightforward account over a dramatic one"]'::jsonb),
  ('Juror #37', 33, 'Event Planner', 'Organizes complex logistics, thinks ahead.', '["organized","forward-thinking"]'::jsonb, '["notices when a timeline or sequence of events doesn’t add up"]'::jsonb),
  ('Juror #38', 59, 'Counselor', 'Mental health professional, listens carefully.', '["attentive listener","nonjudgmental"]'::jsonb, '["weighs credibility based on how consistent someone is, not just confidence"]'::jsonb),
  ('Juror #39', 37, 'Carpenter', 'Craftsperson, precise and methodical.', '["precise","methodical"]'::jsonb, '["wants the facts to fit together cleanly before deciding"]'::jsonb),
  ('Juror #40', 48, 'IT Support Specialist', 'Troubleshooter, systematic problem solver.', '["systematic","troubleshooter"]'::jsonb, '["tries to find the simplest explanation that fits all the facts"]'::jsonb),
  ('Juror #41', 31, 'Physical Therapist', 'Healthcare provider, patient-focused.', '["patient-focused","methodical"]'::jsonb, '["sympathetic to claims of injury or hardship, but checks them against evidence"]'::jsonb),
  ('Juror #42', 53, 'Bus Driver', 'Transportation professional, responsible and alert.', '["responsible","alert"]'::jsonb, '["values a witness who sticks to a clear, consistent timeline"]'::jsonb),
  ('Juror #43', 28, 'Lab Technician', 'Scientific worker, values precision and testing.', '["precise","methodical"]'::jsonb, '["wants claims tested against the evidence, not taken on faith"]'::jsonb),
  ('Juror #44', 44, 'Restaurant Manager', 'Oversees operations, handles pressure well.', '["composed under pressure","pragmatic"]'::jsonb, '["cuts through dramatics to focus on what actually happened"]'::jsonb),
  ('Juror #45', 35, 'Paralegal', 'Legal support staff, familiar with court procedures.', '["procedurally minded","detail-oriented"]'::jsonb, '["notices when an argument doesn’t actually meet the legal standard"]'::jsonb),
  ('Juror #46', 56, 'Delivery Driver', 'Independent worker, navigates challenges daily.', '["self-reliant","practical"]'::jsonb, '["skeptical of excuses that don’t hold up under basic scrutiny"]'::jsonb),
  ('Juror #47', 41, 'Customer Service Rep', 'Handles complaints, seeks fair resolutions.', '["fair-minded","patient"]'::jsonb, '["tries to find the most reasonable account between two competing stories"]'::jsonb),
  ('Juror #48', 34, 'Security Guard', 'Vigilant observer, protective instinct.', '["vigilant","protective"]'::jsonb, '["pays close attention to who had opportunity and access"]'::jsonb),
  ('Juror #49', 49, 'Landscaper', 'Outdoor worker, patient and detail-oriented.', '["patient","detail-oriented"]'::jsonb, '["takes time to weigh the evidence rather than rushing to a view"]'::jsonb),
  ('Juror #50', 38, 'Bookkeeper', 'Financial recordkeeper, organized and accurate.', '["organized","accurate"]'::jsonb, '["wants the account of events to reconcile cleanly, like a ledger"]'::jsonb)
) AS seed(name, age, occupation, background, personality_traits, biases)
WHERE NOT EXISTS (SELECT 1 FROM jurors WHERE jurors.name = seed.name);

