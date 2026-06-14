import { ObservationPoint } from '../core/types';

export const OBSERVATION_POINTS: ObservationPoint[] = [
  {
    name: '词汇水平',
    dimension: 'diction',
    level1Description: '使用最普通的措词，语言简单，几乎不使用形容词。',
    level2Description: '使用水平1的语言，但也出现一些描述性的、具有表现力的词汇；使用一些形容词。',
    level3Description: '使用多种词汇，包括形容词和副词；常常使用描述性的、情感性的词汇。语言是清楚而详细的，并具有表现力。',
  },
  {
    name: '句子结构',
    dimension: 'diction',
    level1Description: '使用简单句，句子结构单一，多为短句。',
    level2Description: '能够使用一些复合句，句子长度适中，偶尔出现连接词。',
    level3Description: '使用多种句型，包括复合句和复杂句；句子结构丰富，连接词使用恰当。',
  },
  {
    name: '叙事结构',
    dimension: 'organization',
    level1Description: '叙事缺乏清晰结构，事件描述混乱，难以辨认开头、中间和结尾。',
    level2Description: '叙事有基本结构，能够区分主要事件，但过渡不够流畅。',
    level3Description: '叙事结构完整清晰，有明确的开头、发展和结尾；事件顺序合理，过渡自然。',
  },
  {
    name: '时间标记',
    dimension: 'organization',
    level1Description: '仅使用简单时间连词（当时、然后、现在等），缺乏时间逻辑。',
    level2Description: '使用较复杂时间标记（从前、后来、直到…为止；时间副词：夜晚、第二天早晨等）。',
    level3Description: '连续使用复杂时间标记，时间逻辑清晰，叙事有明确的时间线索。',
  },
  {
    name: '主题贴切',
    dimension: 'organization',
    level1Description: '叙事内容与主题关联较弱，容易偏离主题。',
    level2Description: '叙事基本围绕主题展开，偶尔出现与主题无关的内容。',
    level3Description: '叙事紧扣主题，内容集中，所有细节都服务于主题表达。',
  },
  {
    name: '事件扩展',
    dimension: 'organization',
    level1Description: '对事件的描述简单，缺乏细节，仅提及基本事实。',
    level2Description: '能够提供一些细节描述，对主要事件有一定扩展。',
    level3Description: '对事件进行丰富详细的描述，包含多个细节和层次，能够深入展开。',
  },
  {
    name: '表现性',
    dimension: 'organization',
    level1Description: '叙事平铺直叙，缺乏情感色彩和生动性。',
    level2Description: '叙事有一定生动性，偶尔使用形象化语言。',
    level3Description: '叙事生动形象，善于使用比喻、拟人等修辞手法，富有感染力。',
  },
  {
    name: '叙事观点',
    dimension: 'opinion',
    level1Description: '仅描述事件本身，不表达个人观点或感受。',
    level2Description: '能够简单表达个人感受，但观点不够明确或深入。',
    level3Description: '能够清晰表达个人观点和感受，并能给出理由；具有批判性思维。',
  },
];

export function getObservationPointsByDimension(
  dimension: 'diction' | 'organization' | 'opinion'
): ObservationPoint[] {
  return OBSERVATION_POINTS.filter(point => point.dimension === dimension);
}

export function getObservationPointByName(name: string): ObservationPoint | undefined {
  return OBSERVATION_POINTS.find(point => point.name === name);
}

export function getLevelDescription(point: ObservationPoint, level: 1 | 2 | 3): string {
  switch (level) {
    case 1:
      return point.level1Description;
    case 2:
      return point.level2Description;
    case 3:
      return point.level3Description;
    default:
      return '';
  }
}
