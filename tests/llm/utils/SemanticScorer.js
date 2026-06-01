import { n as rougeN, l as rougeL } from 'js-rouge';

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'to', 'of', 'and', 'in', 'for',
  'и', 'в', 'на', 'с', 'по', 'для', 'не', 'что', 'это',
]);

export class SemanticScorer {
  semanticSimilarity(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/\W+/).filter(w => w && !STOPWORDS.has(w)));
    const words2 = new Set(text2.toLowerCase().split(/\W+/).filter(w => w && !STOPWORDS.has(w)));
    const intersection = [...words1].filter(w => words2.has(w));
    const union = new Set([...words1, ...words2]);
    const similarity = union.size === 0 ? 0 : intersection.length / union.size;
    return { similarity, normalized: similarity };
  }

  rougeScore(reference, generated) {
    return {
      rouge1: rougeN(reference, generated, 1),
      rouge2: rougeN(reference, generated, 2),
      rougeL: rougeL(reference, generated),
    };
  }

  completeness(reference, generated) {
    const refWords = reference.toLowerCase().split(/\W+/).filter(w => w && !STOPWORDS.has(w));
    const genText = generated.toLowerCase();
    const found = refWords.filter(w => genText.includes(w));
    return { completeness: refWords.length === 0 ? 1 : found.length / refWords.length };
  }

  evaluate(reference, generated) {
    return {
      semantic: this.semanticSimilarity(reference, generated).normalized,
      ...this.rougeScore(reference, generated),
      ...this.completeness(reference, generated),
    };
  }
}
