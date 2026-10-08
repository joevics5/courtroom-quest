-- Give every juror personality traits and biases, and make sure the pool exists.
--
-- generateJuryDeliberation() in src/lib/ai/trialAI.ts feeds each juror's
-- personality_traits and biases into that juror's own deliberation prompt, so
-- they shape how the juror votes. The live pool of 50 jurors was inserted by
-- hand with empty traits/biases, so this migration:
--   1. inserts any of the 50 jurors that are missing (fresh databases/branches),
--   2. fills in traits and biases only where they are still empty, so any later
--      manual edits are never overwritten.
-- Matched by name; safe to run more than once. Existing rows keep their ids,
-- which matters because the avatar engine seeds each portrait from the juror id.

CREATE TEMP TABLE _jury_seed (name text, age int, occupation text, background text, traits text, biases text);

INSERT INTO _jury_seed VALUES
  ('Adebayo Ogun', 40, 'Civil Engineer', 'Seen institutional failure.', 'analytical,skeptical of institutions', 'distrusts official accounts that lack documentation'),
  ('Alessandro Romano', 38, 'Startup CFO', 'Numbers-first thinker.', 'quantitative,decisive', 'wants figures and records behind every claim'),
  ('Angela Martinez', 38, 'Community Organizer', 'Works with marginalized communities.', 'empathetic,community-minded', 'sympathetic to defendants from disadvantaged circumstances'),
  ('Anna Müller', 30, 'Criminal Psychology Student', 'Studies behavioral motives.', 'analytical,curious', 'looks hard at motive and behavior before accepting a theory'),
  ('Brian Thompson', 44, 'Operations Manager', 'Focused on accountability.', 'accountable,results-oriented', 'expects people to own the consequences of their actions'),
  ('Carlos Mendoza', 53, 'Auto Parts Distributor', 'Distrusts sensational media.', 'plainspoken,wary', 'distrusts sensational or one-sided narratives'),
  ('Daniel Brooks', 36, 'Podcast Producer', 'Believes narratives influence perception.', 'story-minded,perceptive', 'notices how framing and narrative sway a story'),
  ('Elena Rossi', 45, 'Art Conservator', 'Believes truth hides beneath layers.', 'patient,meticulous', 'looks beneath the surface account for what really happened'),
  ('Emily Carter', 33, 'UX Designer', 'Believes systems often fail individuals.', 'empathetic,systems thinker', 'inclined to see how circumstances and systems shaped the accused'),
  ('Eva Lindholm', 44, 'UX Research Lead', 'Studies human decision-making.', 'inquisitive,methodical', 'weighs how people actually behave under pressure'),
  ('Fatima El-Sayed', 43, 'Public Health Analyst', 'Evidence-first thinker.', 'evidence-first,measured', 'discounts claims not supported by data'),
  ('George Milton', 52, 'Facilities Director', 'Values responsibility.', 'dependable,responsible', 'expects people to take responsibility for their actions'),
  ('Hannah Wright', 28, 'Legal Translator', 'Understands courtroom nuance.', 'precise,attentive to nuance', 'notices when testimony shifts or is ambiguous'),
  ('Henry Walsh', 61, 'Retired Banker', 'Believes stability is paramount.', 'conservative,cautious', 'favors stability and order and is slow to upend settled expectations'),
  ('Isabelle Moreau', 61, 'Retired Magistrate Clerk', 'Respects courtroom order.', 'orderly,respectful of procedure', 'weighs procedural correctness heavily'),
  ('James Holloway', 45, 'Construction Manager', 'Values hard work and personal responsibility.', 'practical,hard-working', 'has little patience for excuses'),
  ('Jason Miller', 31, 'Freelance Videographer', 'Questions official narratives.', 'skeptical,independent', 'questions official narratives and wants to see the footage or proof'),
  ('Jean Dupont', 56, 'Civil Servant', 'Believes institutions matter.', 'institutional,steady', 'gives weight to established institutions and official procedure'),
  ('Jonas Richter', 34, 'Urban Planner', 'Sees crime as contextual.', 'contextual,analytical', 'considers the social context behind an alleged crime'),
  ('Katarzyna Lewandowska', 42, 'Compliance Officer', 'Ensures adherence to rules.', 'rule-abiding,thorough', 'expects a clear violation to be proven against the rules'),
  ('Kevin Liu', 35, 'Product Manager', 'Balances people and metrics.', 'balanced,pragmatic', 'weighs competing accounts against the evidence on the table'),
  ('Kwame Mensah', 55, 'Transport Supervisor', 'Believes discipline prevents chaos.', 'disciplined,firm', 'believes in firm accountability and is wary of disorder'),
  ('Lauren Kim', 29, 'Marketing Analyst', 'Data-driven decision maker.', 'data-driven,analytical', 'discounts anecdotes in favor of hard evidence'),
  ('Layla Nasser', 35, 'Architect', 'Believes context matters.', 'big-picture,thoughtful', 'looks at how all the pieces of the case fit together'),
  ('Louise Turner', 59, 'Retired School Principal', 'Believes in fairness.', 'fair,authoritative', 'insists both sides get a fair hearing and is firm on honesty'),
  ('Lucas Bernard', 47, 'Insurance Underwriter', 'Assesses risk daily.', 'risk-aware,cautious', 'asks which explanation is more probable and not just possible'),
  ('Lucía Fernández', 29, 'Journalism Fellow', 'Seeks truth.', 'inquisitive,truth-seeking', 'questions whether each side narrative holds up to scrutiny'),
  ('Marco Bianchi', 49, 'Logistics Consultant', 'Optimizes processes.', 'process-minded,efficient', 'checks that the timeline and chain of events add up'),
  ('Mark Davidson', 53, 'Commercial Pilot', 'Values procedure and precision.', 'procedural,precise', 'expects precision from witnesses and respects proper procedure'),
  ('Megan Foster', 34, 'Nonprofit Program Lead', 'Advocates for fairness.', 'fairness-minded,empathetic', 'leans toward giving the accused the benefit of the doubt'),
  ('Michael O’Connor', 59, 'Retired Police Officer', 'Thirty years in law enforcement.', 'experienced,procedural', 'tends to trust officer testimony and proper procedure'),
  ('Nicole Harper', 27, 'Graduate Student', 'Studies criminal justice reform.', 'idealistic,reform-minded', 'wary of how weak evidence can lead to wrongful convictions'),
  ('Nina Kowalski', 46, 'Financial Risk Analyst', 'Quantifies uncertainty.', 'probabilistic,rigorous', 'requires a high bar of certainty before committing to a verdict'),
  ('Noah Svensson', 37, 'SaaS Product Owner', 'Balances stakeholders.', 'collaborative,pragmatic', 'tries to weigh each party interests before leaning either way'),
  ('Oliver Grant', 35, 'Management Consultant', 'Evaluates arguments critically.', 'critical,structured', 'tests every argument for logical gaps'),
  ('Olivia Grant', 26, 'Law Intern', 'Aspires to defend the innocent.', 'earnest,idealistic', 'holds the presumption of innocence very strongly'),
  ('Omar Haddad', 48, 'Import Operations Manager', 'Experienced regulatory abuse.', 'resilient,wary of authority', 'distrusts heavy-handed regulators and sweeping official claims'),
  ('Patricia Monroe', 57, 'HR Director', 'Experienced conflict mediator.', 'mediating,fair-minded', 'tries to hear both sides evenly before settling'),
  ('Peter Novak', 54, 'Industrial Technician', 'Fixes systems step-by-step.', 'methodical,hands-on', 'wants a cause-and-effect chain that holds together step by step'),
  ('Rachel Stein', 48, 'Risk Consultant', 'Evaluates uncertainty professionally.', 'measured,analytical', 'weighs likelihood over bare possibility'),
  ('Robert Jenkins', 62, 'Retired Factory Supervisor', 'Believes discipline prevents crime.', 'strict,traditional', 'less sympathetic to rule-breaking and excuses'),
  ('Sarah Whitfield', 41, 'Real Estate Attorney', 'Experienced with courtroom strategy.', 'legalistic,sharp', 'holds both sides strictly to the legal standard'),
  ('Sebastian Król', 41, 'Cybersecurity Consultant', 'Suspicious of weak evidence.', 'suspicious,detail-oriented', 'highly suspicious of weak or circumstantial evidence'),
  ('Sofia Dimitrova', 32, 'Policy Researcher', 'Studies justice systems.', 'scholarly,fair-minded', 'weighs systemic factors alongside the facts'),
  ('Steven Cole', 46, 'Mechanical Engineer', 'Problem-solver by nature.', 'problem-solver,logical', 'wants the facts to fit together cleanly before deciding'),
  ('Tanya Brooks', 39, 'Public Relations Manager', 'Skilled at reading people.', 'people-reader,persuasion-aware', 'spots spin and overselling in testimony'),
  ('Thomas Reed', 50, 'Insurance Claims Adjuster', 'Detects inconsistencies for a living.', 'skeptical,detail-oriented', 'alert to inconsistencies and exaggerated claims'),
  ('Tomáš Havel', 27, 'Political Science Student', 'Interested in civil liberties.', 'principled,curious', 'protective of the rights of the accused'),
  ('William Parker', 58, 'Municipal Auditor', 'Ensures compliance.', 'meticulous,rule-abiding', 'notices small discrepancies in records and accounts'),
  ('Zainab Bello', 32, 'Youth Advocate', 'Works with wrongfully accused.', 'compassionate,determined', 'alert to wrongful accusation and sympathetic to the accused');

INSERT INTO jurors (name, age, occupation, background, personality_traits, biases)
SELECT s.name, s.age, s.occupation, s.background,
       to_jsonb(string_to_array(s.traits, ',')),
       to_jsonb(ARRAY[s.biases])
FROM _jury_seed s
WHERE NOT EXISTS (SELECT 1 FROM jurors j WHERE j.name = s.name);

UPDATE jurors j
SET personality_traits = to_jsonb(string_to_array(s.traits, ',')),
    biases = to_jsonb(ARRAY[s.biases])
FROM _jury_seed s
WHERE j.name = s.name
  AND (j.personality_traits IS NULL OR j.personality_traits IN ('{}'::jsonb, '[]'::jsonb))
  AND (j.biases IS NULL OR j.biases IN ('{}'::jsonb, '[]'::jsonb));

DROP TABLE _jury_seed;
