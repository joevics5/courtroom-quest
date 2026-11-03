/**
 * Witnesses answer with the words they say, nothing else. Models like to add stage directions such as
 * *fidgets with his tie* or (looks away) or [pauses]; this removes them so only the spoken answer is left.
 */
const ACTION_START = new RegExp(
  '^(?:looks?|looking|glances?|glancing|shifts?|shifting|fidget\\w*|pauses?|pausing|sighs?|sighing|shrugs?|shrugging|nods?|nodding|' +
  'smiles?|smiling|frowns?|frowning|laughs?|laughing|coughs?|coughing|hesitat\\w*|swallows?|swallowing|clears?|crosses|crossing|' +
  'wipes?|wiping|stares?|staring|squirms?|trembl\\w*|nervous\\w*|angr\\w*|quietly|softly|slowly|loudly|visibly|awkwardly|' +
  'uncomfortabl\\w*|defensive\\w*|tense\\w*|tears?|crying|whispers?|whispering|mutters?|muttering|leans?|leaning|folds?|folding|' +
  'taps?|tapping|rubs?|rubbing|avoids?|avoiding|averts?|averting|eyes?|voice|beat)\\b', 'i'
);

export function stripStageDirections(text: string): string {
  let out = text
    // *fidgets nervously*  and  **pauses**
    .replace(/\*{1,3}[^*\n]{1,200}?\*{1,3}/g, ' ')
    // [pauses]  [looks away]
    .replace(/\[[^\]\n]{1,200}\]/g, ' ')
    // (looks away)  -- only short asides that read like an action; spoken parentheses stay
    .replace(/\(([^()\n]{1,80})\)/g, (whole, inner: string) =>
      inner.trim().split(/\s+/).length <= 8 && ACTION_START.test(inner.trim()) ? ' ' : whole
    );
  out = out.replace(/[ \t]{2,}/g, ' ').replace(/ +([,.;:!?])/g, '$1').replace(/^[ \t]+|[ \t]+$/gm, '').trim();
  // never hand back an empty answer because the whole reply was a gesture
  return out || text.trim();
}
