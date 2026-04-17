export const calculateSynchroPercentage = (vecA: number[], vecB: number[]): number => {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;

  // 基本のコサイン類似度（OpenAIの場合、だいたい 0.70 〜 0.90 の間に密集します）
  const cosineSimilarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));

  // 💡 ここからが補正（スケーリング）の魔法です
  // アプリ内で最低ラインと最高ラインの基準を決めます
  const MIN_SIMILARITY = 0.70; // これより低ければ最低スコア
  const MAX_SIMILARITY = 0.92; // これより高ければ最高スコア

  // 0.0 〜 1.0 の範囲に変換（虫眼鏡で拡大）
  let rate = (cosineSimilarity - MIN_SIMILARITY) / (MAX_SIMILARITY - MIN_SIMILARITY);

  // 念のため、0以下や1以上にならないようにカット
  rate = Math.max(0, Math.min(1, rate));

  // マッチングアプリとしてリアルな数字（例：50% 〜 99%）に変換
  // 最低50%保証 ＋ (0〜1の割合 × 残りの49%)
  const percentage = 50 + (rate * 49);

  return Math.round(percentage);
};