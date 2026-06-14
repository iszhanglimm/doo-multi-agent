import { DOODimensions, DOOAssessment, Level, NarrativeInput } from '../core/types';
import { DOOModel } from './DOOModel';
import { LLMClient } from '../nlp/LLMClient';
import {
  splitSentences,
  extractWords,
  countWordsInList,
  ADJECTIVES,
  ADVERBS,
  DESCRIPTIVE_WORDS,
  EMOTIONAL_WORDS,
} from '../nlp/utils';

export interface AssessmentResult {
  dimensions: DOODimensions;
  confidence: number;
  reasoning: string;
}

export class AssessmentEngine {
  private llmClient: LLMClient;
  private useLLM: boolean;

  constructor(llmClient: LLMClient, useLLM = true) {
    this.llmClient = llmClient;
    this.useLLM = useLLM;
  }

  async assess(narrativeInput: NarrativeInput): Promise<DOOAssessment> {
    const content = narrativeInput.content;

    const ruleBasedResult = this.ruleBasedAssessment(content);

    let finalDimensions: DOODimensions;
    let confidence: number;
    let reasoning: string;

    if (!this.useLLM) {
      finalDimensions = ruleBasedResult.dimensions;
      confidence = ruleBasedResult.confidence;
      reasoning = ruleBasedResult.reasoning;
    } else {
      try {
        const llmResult = await this.llmBasedAssessment(content);
        finalDimensions = this.mergeAssessments(ruleBasedResult.dimensions, llmResult.dimensions);
        confidence = llmResult.confidence;
        reasoning = llmResult.reasoning;
      } catch (error) {
        console.warn('LLM assessment failed, using rule-based only:', error);
        finalDimensions = ruleBasedResult.dimensions;
        confidence = ruleBasedResult.confidence;
        reasoning = ruleBasedResult.reasoning;
      }
    }

    const suggestions = DOOModel.generateDefaultSuggestions(finalDimensions);

    if (reasoning) {
      suggestions.unshift(`评估分析：${reasoning}`);
    }

    return DOOModel.createAssessment(narrativeInput, finalDimensions, suggestions);
  }

  async assessBatch(inputs: NarrativeInput[]): Promise<DOOAssessment[]> {
    const results: DOOAssessment[] = [];
    for (const input of inputs) {
      try {
        const assessment = await this.assess(input);
        results.push(assessment);
      } catch (error) {
        console.error(`Assessment failed for child ${input.childId}:`, error);
      }
    }
    return results;
  }

  private ruleBasedAssessment(content: string): AssessmentResult {
    const dimensions = DOOModel.createEmptyDimensions();
    const text = content.trim();
    const sentences = splitSentences(text);
    const words = extractWords(text);

    // ========== 词句维度评估 ==========
    const adjectives = countWordsInList(words, ADJECTIVES);
    const adverbs = countWordsInList(words, ADVERBS);
    const descriptiveWords = countWordsInList(words, DESCRIPTIVE_WORDS);
    const emotionalWords = countWordsInList(words, EMOTIONAL_WORDS);
    const prepositionalPhrases = this.countPrepositionalPhrases(sentences);
    const compoundSentences = this.countCompoundSentences(sentences);
    const complexSentences = this.countComplexSentences(sentences);

    // 词汇水平（基于《学前儿童语言学习量表》）
    if (adjectives >= 3 && adverbs >= 2 && (descriptiveWords >= 2 || emotionalWords >= 2)) {
      dimensions.diction.vocabulary = 3; // 水平3：使用多种词汇，语言清楚而详细
    } else if (adjectives >= 1 || adverbs >= 1 || descriptiveWords >= 1) {
      dimensions.diction.vocabulary = 2; // 水平2：出现描述性、具有表现力的词汇
    }
    // 水平1：默认，使用最普通的措词，几乎不使用形容词

    // 句子结构（基于《学前儿童语言学习量表》）
    if (complexSentences >= 2 || (compoundSentences >= 2 && prepositionalPhrases >= 2)) {
      dimensions.diction.sentenceStructure = 3; // 水平3：使用大量句子结构
    } else if (compoundSentences >= 1 || prepositionalPhrases >= 1) {
      dimensions.diction.sentenceStructure = 2; // 水平2：出现介词性词组和复合句
    }
    // 水平1：默认，使用简单、不连贯、并列的句子

    // ========== 语言组织维度评估 ==========
    const narrativeStructure = this.detectNarrativeStructure(text);
    const timeMarkers = this.detectTimeMarkers(text);
    const themeConsistency = this.detectThemeConsistency(text, sentences);
    const details = this.detectDetails(text);
    const expressiveness = this.detectExpressiveness(text);

    // 叙事结构（基于《学前儿童语言学习量表》）
    if (narrativeStructure.count >= 3) {
      dimensions.organization.narrativeStructure = 3; // 水平3：包含3个及以上要素
    } else if (narrativeStructure.count >= 2) {
      dimensions.organization.narrativeStructure = 2; // 水平2：包含2个要素
    }
    // 水平1：默认，包含1个要素

    // 时间标记（基于《学前儿童语言学习量表》）
    if (timeMarkers.complex) {
      dimensions.organization.timeMarker = 3; // 水平3：连续使用复杂时间标记
    } else if (timeMarkers.simple) {
      dimensions.organization.timeMarker = 2; // 水平2：使用较复杂时间标记
    }
    // 水平1：默认，仅使用简单时间连词

    // 主题贴切（基于《学前儿童语言学习量表》）
    dimensions.organization.themeRelevance = themeConsistency as Level;

    // 事件扩展（基于《学前儿童语言学习量表》）
    if (details.hasElaboration && sentences.length >= 4) {
      dimensions.organization.eventExpansion = 3; // 水平3：描述较详细，对重要事件详细阐述
    } else if (details.hasDetails) {
      dimensions.organization.eventExpansion = 2; // 水平2：有时对描述加以修饰
    }
    // 水平1：默认，描述空洞且不详细

    // 表现性（基于《学前儿童语言学习量表》）
    if (expressiveness.hasSoundEffects && expressiveness.hasRoleVoice) {
      dimensions.organization.expressiveness = 3; // 水平3：不断使用声音效果、生动的角色语气
    } else if (expressiveness.hasSoundEffects || expressiveness.hasRoleVoice) {
      dimensions.organization.expressiveness = 2; // 水平2：偶尔使用声音效果或其他形式的表达
    }
    // 水平1：默认，未使用或很少使用语调

    // ========== 独白观点维度评估 ==========
    const opinion = this.detectOpinion(text);

    // 叙事观点（基于《学前儿童语言学习量表》）
    if (opinion.hasOpinion && opinion.hasEvaluation && text.length > 80) {
      dimensions.opinion.narrativeViewpoint = 3; // 水平3：围绕主题进行较完整的构思，表达观点和评价
    } else if (opinion.hasOpinion || opinion.hasEvaluation) {
      dimensions.opinion.narrativeViewpoint = 2; // 水平2：围绕主题进行简单构思
    }
    // 水平1：默认，知道在集体面前讲述与日常谈话有所不同

    const confidence = 0.6;
    const reasoning = this.generateReasoning(dimensions, {
      adjectives,
      adverbs,
      descriptiveWords,
      emotionalWords,
      compoundSentences,
      complexSentences,
      narrativeStructure: narrativeStructure.count,
      timeMarkers,
      themeConsistency,
      details,
      expressiveness,
      opinion,
      sentenceCount: sentences.length,
    });

    return { dimensions, confidence, reasoning };
  }

  private async llmBasedAssessment(content: string): Promise<AssessmentResult> {
    const prompt = this.buildAssessmentPrompt(content);
    const response = await this.llmClient.complete(prompt);
    return this.parseLLMResponse(response);
  }

  private buildAssessmentPrompt(content: string): string {
    return `你是一位幼儿语言发展评估专家。请对以下大班幼儿（5-6岁）的叙事内容进行DOO三维评估。

【评估标准参考：《学前儿童语言学习量表》】

1. 词句维度(Diction)：

   A. 词汇水平（形容词、副词、描述性/情感性词汇的使用）：
      水平1（1分）：使用最普通的措词，语言简单，几乎不使用形容词。
      水平2（2分）：出现描述性的、具有表现力的词汇；使用一些形容词。
      水平3（3分）：使用多种词汇，包括形容词和副词；常常使用描述性的、情感性的词汇。语言清楚而详细，并具有表现力。

   B. 句子结构：
      水平1（1分）：使用简单、不连贯、并列的句子或句子成分。
      水平2（2分）：出现介词性词组和复合句或二者同时使用。
      水平3（3分）：使用大量句子结构，包括状语从句、定语从句、分词短语或几者混合使用。

2. 语言组织维度(Organization)：

   A. 叙事结构（背景、角色定义、事件、结局）：
      水平1（1分）：包含1个要素。
      水平2（2分）：包含2个要素。
      水平3（3分）：包含3个及以上要素。

   B. 时间标记：
      水平1（1分）：仅使用简单时间连词（当时、然后、现在等）。
      水平2（2分）：使用较复杂时间标记（逻辑连词：从前、后来、直到...为止；时间副词：夜晚、第二天早晨等）。
      水平3（3分）：连续使用复杂时间标记。

   C. 主题贴切：
      水平1（1分）：想法转换不清楚，注意力分散，故事线索断开。
      水平2（2分）：故事线索含糊且只能维持一小段，用较无关线索编成零散故事。
      水平3（3分）：连续超过四句话保持故事线索一致性和相对连续性，把时间联系起来构成故事线索，很少偏离故事发展。

   D. 事件扩展：
      水平1（1分）：描述空洞且不详细。
      水平2（2分）：有时对描述加以修饰，对某些经历的特定细节加以细述。
      水平3（3分）：描述较详细，对重要事件加以详细阐述。

   E. 表现性：
      水平1（1分）：未使用或很少使用语调，用单一语调呈现故事。
      水平2（2分）：偶尔使用声音效果或其他形式的表达（角色语气、加强语气、唱歌），或二者兼用。
      水平3（3分）：不断使用声音效果、生动的角色语气、高度表现力的叙述。

3. 独白观点维度(Opinion)：

   A. 叙事观点：
      水平1（1分）：知道在集体面前讲述与日常谈话有所不同，并愿意在集体面前讲话。
      水平2（2分）：借助凭借物，围绕叙事主题进行简单构思并在集体面前讲述。讲述时借助简单表情、动作进行形象表现。
      水平3（3分）：借助凭借物，围绕叙事主题进行较完整的构思并在集体面前讲述。讲述时会表达自己的观点和评价来增强叙事的情感色彩。

评分标准：1=基础水平，2=发展水平，3=优秀水平

幼儿叙事内容：
"""${content}"""

请以JSON格式返回评估结果：
{
  "dimensions": {
    "diction": {
      "vocabulary": 1|2|3,
      "sentenceStructure": 1|2|3
    },
    "organization": {
      "narrativeStructure": 1|2|3,
      "timeMarker": 1|2|3,
      "themeRelevance": 1|2|3,
      "eventExpansion": 1|2|3,
      "expressiveness": 1|2|3
    },
    "opinion": {
      "narrativeViewpoint": 1|2|3
    }
  },
  "confidence": 0.0-1.0,
  "reasoning": "评估理由的简要说明，请引用量表中的具体标准"
}`;
  }

  private parseLLMResponse(response: string): AssessmentResult {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const empty = DOOModel.createEmptyDimensions();
        const dims = parsed.dimensions || {};
        const org = dims.organization || {};
        return {
          dimensions: {
            diction: { ...empty.diction, ...dims.diction },
            organization: { ...empty.organization, ...org },
            opinion: { ...empty.opinion, ...dims.opinion },
          },
          confidence: parsed.confidence || 0.8,
          reasoning: parsed.reasoning || '',
        };
      }
    } catch (error) {
      console.error('Failed to parse LLM response:', error);
    }

    return {
      dimensions: DOOModel.createEmptyDimensions(),
      confidence: 0.3,
      reasoning: 'LLM响应解析失败',
    };
  }

  private mergeAssessments(
    ruleBased: DOODimensions,
    llmBased: DOODimensions
  ): DOODimensions {
    const mergeLevel = (a: Level, b: Level): Level => {
      if (Math.abs(a - b) <= 1) {
        return Math.ceil((a + b) / 2) as Level;
      }
      return Math.max(a, b) as Level;
    };

    return {
      diction: {
        vocabulary: mergeLevel(ruleBased.diction.vocabulary, llmBased.diction.vocabulary),
        sentenceStructure: mergeLevel(
          ruleBased.diction.sentenceStructure,
          llmBased.diction.sentenceStructure
        ),
      },
      organization: {
        narrativeStructure: mergeLevel(
          ruleBased.organization.narrativeStructure,
          llmBased.organization.narrativeStructure
        ),
        timeMarker: mergeLevel(
          ruleBased.organization.timeMarker,
          llmBased.organization.timeMarker
        ),
        themeRelevance: mergeLevel(
          ruleBased.organization.themeRelevance,
          llmBased.organization.themeRelevance
        ),
        eventExpansion: mergeLevel(
          ruleBased.organization.eventExpansion,
          llmBased.organization.eventExpansion
        ),
        expressiveness: mergeLevel(
          ruleBased.organization.expressiveness,
          llmBased.organization.expressiveness
        ),
      },
      opinion: {
        narrativeViewpoint: mergeLevel(
          ruleBased.opinion.narrativeViewpoint,
          llmBased.opinion.narrativeViewpoint
        ),
      },
    };
  }

  // ========== 句子结构评估（基于《学前儿童语言学习量表》） ==========

  private countPrepositionalPhrases(sentences: string[]): number {
    // 介词性词组：在、向、对、从、为了、关于、用、以、把、被
    const prepositions = ['在', '向', '对', '从', '为了', '关于', '用', '把', '被', '跟', '和'];
    return sentences.filter(s => prepositions.some(p => s.includes(p))).length;
  }

  private countCompoundSentences(sentences: string[]): number {
    // 复合句：并列复合句和主从复合句
    const conjunctions = [
      '因为', '所以', '但是', '可是', '然后', '接着', '后来',
      '如果', '就', '虽然', '可是', '一边', '一边', '又', '又',
      '不仅', '而且', '要么', '要么', '或者', '或者',
    ];
    return sentences.filter(s => conjunctions.some(c => s.includes(c))).length;
  }

  private countComplexSentences(sentences: string[]): number {
    // 状语从句、定语从句、分词短语
    const complexMarkers = [
      '当', '的时候', '如果', '就', '因为', '所以',
      '虽然', '但是', '只要', '就', '为了',
      '正在', '已经', '过', '着',
    ];
    return sentences.filter(s => complexMarkers.some(c => s.includes(c))).length;
  }

  // ========== 叙事结构评估（基于《学前儿童语言学习量表》） ==========

  private detectNarrativeStructure(text: string): { count: number; elements: string[] } {
    // 背景、角色定义、事件、结局
    const elements: string[] = [];

    // 背景：时间、地点
    if (/有一天|从前|以前|后来|那天|今天|昨天|早上|晚上|春天|夏天|秋天|冬天/.test(text)) {
      elements.push('背景');
    }

    // 角色定义
    if (/我叫|我是|他是|她是|它是|我们|他们|大家/.test(text)) {
      elements.push('角色定义');
    }

    // 事件：动作描述
    if (/去|来|走|跑|跳|玩|看|听|说|吃|喝|做|找/.test(text)) {
      elements.push('事件');
    }

    // 结局：结果、总结
    if (/最后|终于|结果|后来|然后|结局|结束|完了/.test(text)) {
      elements.push('结局');
    }

    return { count: elements.length, elements };
  }

  // ========== 时间标记评估 ==========

  private detectTimeMarkers(text: string): { simple: boolean; complex: boolean } {
    const simpleMarkers = ['当时', '然后', '现在', '接着', '后来'];
    const complexMarkers = [
      '从前', '后来', '直到', '为止', '一会儿', '其次',
      '夜晚', '第二天', '早晨', '很多年以前', '很久以前',
      '首先', '最后', '终于', '突然', '忽然',
    ];

    const simple = simpleMarkers.some(m => text.includes(m));
    const complex = complexMarkers.some(m => text.includes(m));

    return { simple, complex };
  }

  // ========== 主题贴切评估 ==========

  private detectThemeConsistency(text: string, sentences: string[]): number {
    // 检查故事线索的一致性和连续性
    const topicWords = this.extractTopicWords(text);
    let consistentSentences = 0;

    for (const sentence of sentences) {
      if (topicWords.some(word => sentence.includes(word))) {
        consistentSentences++;
      }
    }

    if (consistentSentences >= 4 && sentences.length >= 4) {
      return 3; // 水平3
    } else if (consistentSentences >= 2) {
      return 2; // 水平2
    }
    return 1; // 水平1
  }

  private extractTopicWords(text: string): string[] {
    // 提取主题词（名词）
    const commonNouns = [
      '公园', '学校', '家', '幼儿园', '老师', '小朋友', '妈妈', '爸爸',
      '朋友', '游戏', '玩具', '动物', '花', '树', '草', '天', '地',
    ];
    return commonNouns.filter(noun => text.includes(noun));
  }

  // ========== 事件扩展评估 ==========

  private detectDetails(text: string): { hasDetails: boolean; hasElaboration: boolean } {
    const detailMarkers = ['颜色', '形状', '大小', '声音', '味道', '感觉', '看起来', '听起来', '闻起来'];
    const elaborationMarkers = [
      '有的', '有的', '一边', '一边', '首先', '然后', '接着', '最后',
      '先', '再', '又', '还',
    ];

    const hasDetails = detailMarkers.some(m => text.includes(m)) || text.length > 80;
    const hasElaboration = elaborationMarkers.some(m => text.includes(m));

    return { hasDetails, hasElaboration };
  }

  // ========== 表现性评估 ==========

  private detectExpressiveness(text: string): { hasSoundEffects: boolean; hasRoleVoice: boolean } {
    const soundEffects = ['砰', '啪', '咚', '哗', '嘀', '呜', '啊', '呀', '呢', '吧', '吗'];
    const roleVoice = ['说', '喊', '叫', '唱', '哭', '笑', '问', '回答'];

    const hasSoundEffects = soundEffects.some(s => text.includes(s));
    const hasRoleVoice = roleVoice.some(r => text.includes(r));

    return { hasSoundEffects, hasRoleVoice };
  }

  // ========== 叙事观点评估 ==========

  private detectOpinion(text: string): { hasOpinion: boolean; hasEvaluation: boolean } {
    const opinionMarkers = ['我觉得', '我认为', '我喜欢', '我不喜欢', '我想', '我希望'];
    const evaluationMarkers = [
      '真', '好', '太', '很', '非常', '特别',
      '开心', '难过', '喜欢', '讨厌', '好玩', '有趣',
    ];

    const hasOpinion = opinionMarkers.some(m => text.includes(m));
    const hasEvaluation = evaluationMarkers.some(m => text.includes(m));

    return { hasOpinion, hasEvaluation };
  }

  private generateReasoning(
    dimensions: DOODimensions,
    stats: Record<string, unknown>
  ): string {
    const parts: string[] = [];

    // 词汇水平分析
    const adjectives = stats.adjectives as number;
    const adverbs = stats.adverbs as number;
    const descriptiveWords = stats.descriptiveWords as number;
    const emotionalWords = stats.emotionalWords as number;

    if (adjectives >= 3 && adverbs >= 2 && (descriptiveWords >= 2 || emotionalWords >= 2)) {
      parts.push('使用了多种词汇，包括形容词和副词，常常使用描述性、情感性词汇，语言清楚而详细');
    } else if (adjectives >= 1 || adverbs >= 1 || descriptiveWords >= 1) {
      parts.push('出现了描述性的、具有表现力的词汇，使用了一些形容词');
    } else {
      parts.push('使用最普通的措词，语言简单，几乎不使用形容词');
    }

    // 句子结构分析
    const compoundSentences = stats.compoundSentences as number;
    const complexSentences = stats.complexSentences as number;
    const prepositionalPhrases = stats.prepositionalPhrases as number;

    if (complexSentences >= 2 || (compoundSentences >= 2 && prepositionalPhrases >= 2)) {
      parts.push('使用了大量句子结构，包括状语从句、定语从句、分词短语或几者混合使用');
    } else if (compoundSentences >= 1 || prepositionalPhrases >= 1) {
      parts.push('出现介词性词组和复合句或二者同时使用');
    } else {
      parts.push('使用简单、不连贯、并列的句子或句子成分');
    }

    // 叙事结构分析
    const narrativeStructure = stats.narrativeStructure as number;
    if (narrativeStructure >= 3) {
      parts.push('叙事包含背景、角色定义、事件、结局中的3个及以上要素');
    } else if (narrativeStructure >= 2) {
      parts.push('叙事包含背景、角色定义、事件、结局中的2个要素');
    } else {
      parts.push('叙事仅包含背景、角色定义、事件、结局中的1个要素');
    }

    // 时间标记分析
    const timeMarkers = stats.timeMarkers as { simple: boolean; complex: boolean };
    if (timeMarkers?.complex) {
      parts.push('连续使用复杂时间标记，时间逻辑清晰');
    } else if (timeMarkers?.simple) {
      parts.push('使用了简单时间连词，有一定的时间逻辑');
    } else {
      parts.push('缺乏时间标记，叙事的时间顺序不清晰');
    }

    // 主题贴切分析
    const themeConsistency = stats.themeConsistency as number;
    if (themeConsistency >= 3) {
      parts.push('连续超过四句话保持故事线索的一致性和相对连续性');
    } else if (themeConsistency >= 2) {
      parts.push('故事线索含糊且只能维持一小段');
    } else {
      parts.push('想法转换不清楚，注意力分散，故事线索断开');
    }

    // 事件扩展分析
    const details = stats.details as { hasDetails: boolean; hasElaboration: boolean };
    if (details?.hasElaboration) {
      parts.push('描述较详细，对重要的事件加以详细阐述');
    } else if (details?.hasDetails) {
      parts.push('有时对描述加以修饰，对某些经历的特定细节加以细述');
    } else {
      parts.push('描述空洞且不详细');
    }

    // 表现性分析
    const expressiveness = stats.expressiveness as { hasSoundEffects: boolean; hasRoleVoice: boolean };
    if (expressiveness?.hasSoundEffects && expressiveness?.hasRoleVoice) {
      parts.push('不断使用声音效果、生动的角色语气、高度表现力的叙述');
    } else if (expressiveness?.hasSoundEffects || expressiveness?.hasRoleVoice) {
      parts.push('偶尔使用声音效果或其他形式的表达');
    } else {
      parts.push('未使用或很少使用语调，用单一的语调呈现故事');
    }

    // 叙事观点分析
    const opinion = stats.opinion as { hasOpinion: boolean; hasEvaluation: boolean };
    if (opinion?.hasOpinion && opinion?.hasEvaluation) {
      parts.push('围绕叙事主题进行较完整的构思，表达自己的观点和评价来增强叙事的情感色彩');
    } else if (opinion?.hasOpinion || opinion?.hasEvaluation) {
      parts.push('围绕叙事主题进行简单构思，借助简单的表情、动作进行形象表现');
    } else {
      parts.push('知道在集体面前讲述与日常谈话有所不同，并愿意在集体面前讲话');
    }

    return parts.join('；') + '。';
  }
}
