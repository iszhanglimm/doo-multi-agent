import type { DOOAssessment } from '../types';

/**
 * 根据DOO三维度子项得分计算综合等级
 * 等级划分：初级(<1.5) 中级(1.5-2.4) 高级(>=2.5)
 */
export function calculateLevelFromDimensions(dimensions: DOOAssessment['dimensions']): number {
  const diction = (dimensions.diction.vocabulary + dimensions.diction.sentenceStructure) / 2;
  const organization = (dimensions.organization.narrativeStructure + dimensions.organization.timeMarker + dimensions.organization.themeRelevance + dimensions.organization.eventExpansion + dimensions.organization.expressiveness) / 5;
  const opinion = dimensions.opinion.narrativeViewpoint;
  const average = (diction + organization + opinion) / 3;
  if (average >= 2.5) return 3;
  if (average >= 1.5) return 2;
  return 1;
}

/**
 * 根据综合评分计算等级
 * 等级划分：初级(<1.5) 中级(1.5-2.4) 高级(>=2.5)
 */
export function calculateLevelFromScore(score: number): number {
  if (score >= 2.5) return 3;
  if (score >= 1.5) return 2;
  return 1;
}

/**
 * 等级标签映射
 */
export const LEVEL_LABELS: Record<number, string> = {
  1: '初级',
  2: '中级',
  3: '高级',
};

/**
 * 等级颜色映射
 */
export function getLevelColor(score: number): string {
  if (score < 1.5) return '#FF6B6B';
  if (score < 2.5) return '#FFB347';
  return '#4ADE80';
}
