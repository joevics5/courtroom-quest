import i18n from '../i18n';

const FIXED: Record<string, string> = {
  'Court Idle': 'courtIdle',
  'Bailiff Calls Court to Order': 'bailiffCalls',
  'Judge Enters': 'judgeEnters',
  'Case Announcement': 'caseAnnouncement',
  'Counsel Appearances': 'counselAppearances',
  'Defendant Plea': 'defendantPlea',
  'Opening Statement - Prosecution': 'openingProsecution',
  'Opening Statement - Defense': 'openingDefense',
  'Closing Statement - Prosecution': 'closingProsecution',
  'Closing Statement - Defense': 'closingDefense',
  'Judge Deliberation': 'judgeDeliberation',
  'Verdict Delivery': 'verdictDelivery',
  'Trial Complete': 'trialComplete',
  'Session Archived': 'sessionArchived'
};

const KINDS: Record<string, string> = { 'Direct Examination': 'direct', 'Cross-Examination': 'cross', Redirect: 'redirect' };

/**
 * Phase names in trialConfig are English identifiers the game logic compares against,
 * so they never change. This gives the name to show on screen in the player's language.
 */
export function phaseLabel(name: string): string {
  const fixed = FIXED[name];
  if (fixed) return i18n.t(`phaseNames.${fixed}`);
  const m = name.match(/^(Prosecution|Defense) Witness (\d+) - (Direct Examination|Cross-Examination|Redirect)$/);
  if (m) {
    return i18n.t('phaseNames.witness', {
      side: i18n.t(m[1] === 'Prosecution' ? 'roles.prosecution' : 'roles.defense'),
      n: m[2],
      kind: i18n.t(`phaseNames.${KINDS[m[3]]}`)
    });
  }
  return name;
}
