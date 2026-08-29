import Mission1Pattern from './Mission1Pattern.js';
import Mission2Pattern from './Mission2Pattern.js';
import Mission3Pattern from './Mission3Pattern.js';
import Mission4Pattern from './Mission4Pattern.js';
import Mission5Pattern from './Mission5Pattern.js';

// Registry of boss attack patterns, keyed by the mission config's
// `bossPattern` value (see src/missions/Missions.js). Add a new mission's
// pattern class here as it's created -- Boss.js stays pattern-agnostic.
const PATTERNS = {
  1: Mission1Pattern,
  2: Mission2Pattern,
  3: Mission3Pattern,
  4: Mission4Pattern,
  5: Mission5Pattern,
};

export function createBossPattern(patternKey, boss) {
  const PatternClass = PATTERNS[patternKey] || Mission1Pattern;
  return new PatternClass(boss);
}
