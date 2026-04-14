import { IEvent } from '~/util/interfaces';

// Regex used to split event titles into words
const SPLIT_REGEX = /[\s\-,:()[\]/]/;

export interface WordEntry {
  word: string;
  duration: number;
  events: IEvent[];
}

/**
 * Finds common words and bigrams (two-word phrases) in event titles,
 * weighted by time duration rather than event count.
 *
 * For each bigram that accounts for >50% of the total duration of both
 * constituent words, the bigram is promoted and the constituent words'
 * durations are reduced accordingly. This means "Mozilla Firefox" appears
 * instead of separate "Mozilla" and "Firefox" entries when they almost
 * always co-occur.
 *
 * Words with length <= 2 or in `ignored_words` are skipped.
 */
export function findCommonPhrases(
  events: IEvent[],
  ignored_words: string[]
): Map<string, WordEntry> {
  const words = new Map<string, WordEntry>();
  const bigrams = new Map<string, { bigram: string; duration: number; events: IEvent[] }>();

  // Step 1: Build word duration dictionary
  for (const event of events) {
    for (const word of event.data.title.split(SPLIT_REGEX)) {
      if (word.length <= 2 || ignored_words.includes(word)) {
        continue;
      }
      const entry = words.get(word);
      if (entry) {
        entry.duration += event.duration;
        entry.events.push(event);
      } else {
        words.set(word, { word, duration: event.duration, events: [event] });
      }
    }
  }

  // Step 2: Build bigram duration dictionary (skip bigrams with filtered words)
  for (const event of events) {
    const parts = event.data.title.split(SPLIT_REGEX);
    for (let i = 0; i < parts.length - 1; i++) {
      const w1 = parts[i];
      const w2 = parts[i + 1];
      if (w1.length <= 2 || ignored_words.includes(w1)) continue;
      if (w2.length <= 2 || ignored_words.includes(w2)) continue;
      const bigram = `${w1} ${w2}`;
      const entry = bigrams.get(bigram);
      if (entry) {
        entry.duration += event.duration;
        entry.events.push(event);
      } else {
        bigrams.set(bigram, { bigram, duration: event.duration, events: [event] });
      }
    }
  }

  // Step 3: Promote bigrams that dominate both constituent words (>50% threshold)
  for (const [bigram, bigramEntry] of bigrams) {
    const spaceIdx = bigram.indexOf(' ');
    const word1 = bigram.slice(0, spaceIdx);
    const word2 = bigram.slice(spaceIdx + 1);
    const w1Entry = words.get(word1);
    const w2Entry = words.get(word2);
    if (!w1Entry || !w2Entry) continue;

    const bigram_duration = bigramEntry.duration;
    if (bigram_duration / w1Entry.duration > 0.5 && bigram_duration / w2Entry.duration > 0.5) {
      // Promote bigram, reduce constituent word durations
      words.set(bigram, { word: bigram, duration: bigram_duration, events: bigramEntry.events });
      w1Entry.duration -= bigram_duration;
      w2Entry.duration -= bigram_duration;
    }
  }

  return words;
}
