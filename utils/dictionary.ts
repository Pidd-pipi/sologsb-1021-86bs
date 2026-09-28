import type { DictionaryEntry, DuplicatePair } from '~/types/dictionary';

export const normalizeWord = (value: string) => value
  .normalize('NFKC')
  .toLowerCase()
  .replace(/[\s·.'’\-_()[\]{}，。！？、]/g, '');

const bigrams = (value: string) => {
  const text = normalizeWord(value);
  if (text.length < 2) return text ? [text] : [];
  return Array.from({ length: text.length - 1 }, (_, index) => text.slice(index, index + 2));
};

export const similarity = (left: string, right: string) => {
  const a = bigrams(left);
  const b = bigrams(right);
  if (!a.length || !b.length) return 0;
  const remaining = [...b];
  let hits = 0;
  a.forEach((token) => {
    const index = remaining.indexOf(token);
    if (index >= 0) {
      hits += 1;
      remaining.splice(index, 1);
    }
  });
  return (2 * hits) / (a.length + b.length);
};

export const findDuplicates = (entries: DictionaryEntry[]): DuplicatePair[] => {
  const pairs: DuplicatePair[] = [];
  entries.forEach((left, index) => {
    entries.slice(index + 1).forEach((right) => {
      // 同一词形下的不同词性是不同词条（按义项拆分的预期结果），不能当作重复
      const sameHeadword = normalizeWord(left.headword) && normalizeWord(left.headword) === normalizeWord(right.headword);
      if (sameHeadword && left.partOfSpeech.trim() && right.partOfSpeech.trim() && left.partOfSpeech.trim() !== right.partOfSpeech.trim()) return;
      const headwordScore = similarity(left.headword, right.headword);
      const synonymScore = Math.max(0, ...left.synonyms.map((word) => similarity(word, right.headword)), ...right.synonyms.map((word) => similarity(word, left.headword)));
      const meaningScore = similarity(left.definition, right.definition) * .35;
      const score = Math.max(headwordScore, synonymScore * .92, meaningScore);
      if (score < .62) return;
      const reasons: string[] = [];
      if (headwordScore === score) reasons.push('词形高度相似');
      if (synonymScore * .92 === score) reasons.push('同义词交叉命中');
      if (meaningScore === score) reasons.push('释义相近');
      if (left.pronunciation && right.pronunciation && similarity(left.pronunciation, right.pronunciation) > .72) reasons.push('发音相近');
      pairs.push({ leftId: left.id, rightId: right.id, score: Math.min(1, score), reasons });
    });
  });
  return pairs.sort((a, b) => b.score - a.score);
};

export const referencesToEntry = (entries: DictionaryEntry[], target: DictionaryEntry) => {
  const names = new Set([target.headword, ...target.synonyms].map(normalizeWord));
  return entries.filter((entry) => entry.id !== target.id && (
    entry.synonyms.some((synonym) => names.has(normalizeWord(synonym)))
    || entry.definition.includes(target.headword)
    || entry.examples.some((example) => names.has(normalizeWord(example.source)))
  ));
};

export interface SenseSegment {
  text: string;
  separator: string;
}

const SENSE_SEPARATORS = /[;；]/g;

/** 将释义按分号（中英文皆可）切分为独立义项，保留原始分隔符以便原样回拼。 */
export const splitDefinition = (definition: string): SenseSegment[] => {
  const segments: SenseSegment[] = [];
  let last = 0;
  for (const match of definition.matchAll(SENSE_SEPARATORS)) {
    segments.push({ text: definition.slice(last, match.index), separator: match[0] });
    last = (match.index ?? 0) + match[0].length;
  }
  segments.push({ text: definition.slice(last), separator: '' });
  return segments;
};

export const parseSenses = (definition: string) => {
  const seen = new Set<string>();
  return splitDefinition(definition)
    .map((segment) => segment.text.trim())
    .filter((text) => {
      if (!text || seen.has(text)) return false;
      seen.add(text);
      return true;
    });
};

/** 从释义文本中移除指定义项并重新拼接，保持剩余义项的原始写法与分隔符。 */
export const removeSensesFromDefinition = (definition: string, movedSenses: string[]) => {
  const moved = new Set(movedSenses.map((sense) => sense.trim()));
  return splitDefinition(definition)
    .filter((segment) => !moved.has(segment.text.trim()))
    .map((segment, index, list) => (index < list.length - 1 ? segment.text + segment.separator : segment.text))
    .join('')
    .trim();
};

export const joinSenses = (senses: string[]) => senses.map((sense) => sense.trim()).filter(Boolean).join('；');
