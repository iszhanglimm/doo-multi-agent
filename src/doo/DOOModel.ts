import {
  DOODimensions,
  DOOAssessment,
  Level,
  NarrativeInput,
  ScenarioType,
} from '../core/types';
import { v4 as uuidv4 } from 'uuid';

export class DOOModel {
  static createEmptyDimensions(): DOODimensions {
    return {
      diction: {
        vocabulary: 1,
        sentenceStructure: 1,
      },
      organization: {
        narrativeStructure: 1,
        timeMarker: 1,
        themeRelevance: 1,
        eventExpansion: 1,
        expressiveness: 1,
      },
      opinion: {
        narrativeViewpoint: 1,
      },
    };
  }

  static calculateOverallLevel(dimensions: DOODimensions): Level {
    const dimAvg = this.calculateDimensionAverage(dimensions);
    const average = (dimAvg.diction + dimAvg.organization + dimAvg.opinion) / 3;

    if (average >= 2.5) return 3;
    if (average >= 1.5) return 2;
    return 1;
  }

  static calculateDimensionAverage(dimensions: DOODimensions): {
    diction: number;
    organization: number;
    opinion: number;
  } {
    const dictionAvg =
      (dimensions.diction.vocabulary + dimensions.diction.sentenceStructure) / 2;

    const orgAvg =
      (dimensions.organization.narrativeStructure +
        dimensions.organization.timeMarker +
        dimensions.organization.themeRelevance +
        dimensions.organization.eventExpansion +
        dimensions.organization.expressiveness) /
      5;

    const opinionAvg = dimensions.opinion.narrativeViewpoint;

    return {
      diction: Math.round(dictionAvg * 100) / 100,
      organization: Math.round(orgAvg * 100) / 100,
      opinion: Math.round(opinionAvg * 100) / 100,
    };
  }

  static createAssessment(
    narrativeInput: NarrativeInput,
    dimensions: DOODimensions,
    suggestions: string[]
  ): DOOAssessment {
    return {
      id: uuidv4(),
      childId: narrativeInput.childId,
      childName: narrativeInput.childName,
      classId: narrativeInput.classId,
      timestamp: new Date(),
      dimensions,
      overallLevel: this.calculateOverallLevel(dimensions),
      suggestions,
      narrativeContent: narrativeInput.content,
      scenario: narrativeInput.scenario,
    };
  }

  static getDimensionDescription(dimension: keyof DOODimensions): string {
    const descriptions: Record<string, string> = {
      diction: '词句维度：评估幼儿使用的词汇丰富度和句子结构复杂度',
      organization: '语言组织维度：评估幼儿叙事的结构完整性和内容组织',
      opinion: '独白观点维度：评估幼儿表达个人观点和感受的能力',
    };
    return descriptions[dimension] || '';
  }

  static getLevelLabel(level: Level): string {
    switch (level) {
      case 1:
        return '基础水平';
      case 2:
        return '发展水平';
      case 3:
        return '优秀水平';
      default:
        return '未知';
    }
  }

  static generateDefaultSuggestions(dimensions: DOODimensions): string[] {
    const suggestions: string[] = [];

    if (dimensions.diction.vocabulary <= 1) {
      suggestions.push('建议增加描述性词汇的学习，引导幼儿使用形容词和副词。');
    }
    if (dimensions.diction.sentenceStructure <= 1) {
      suggestions.push('建议练习使用复合句，丰富句子结构。');
    }
    if (dimensions.organization.narrativeStructure <= 1) {
      suggestions.push('建议帮助幼儿建立叙事的结构意识，明确开头、发展和结尾。');
    }
    if (dimensions.organization.timeMarker <= 1) {
      suggestions.push('建议引导幼儿使用时间标记词（如"先""然后""最后"），增强叙事的时间逻辑。');
    }
    if (dimensions.organization.themeRelevance <= 1) {
      suggestions.push('建议引导幼儿围绕主题展开叙事，减少无关内容。');
    }
    if (dimensions.organization.eventExpansion <= 1) {
      suggestions.push('建议鼓励幼儿提供更多细节描述，丰富叙事内容。');
    }
    if (dimensions.organization.expressiveness <= 1) {
      suggestions.push('建议引导幼儿使用形象化语言，增强叙事的生动性。');
    }
    if (dimensions.opinion.narrativeViewpoint <= 1) {
      suggestions.push('建议鼓励幼儿表达个人感受和观点，培养批判性思维。');
    }

    if (suggestions.length === 0) {
      suggestions.push('幼儿叙事能力发展良好，建议继续保持并挑战更高难度的叙事任务。');
    }

    return suggestions;
  }
}
