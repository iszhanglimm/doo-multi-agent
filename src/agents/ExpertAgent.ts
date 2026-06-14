import { Agent, PeerResponse, ScaffoldSuggestion } from '../core/Agent';
import { AgentConfig, AgentMessage, AgentType, DOOAssessment, NarrativeInput } from '../core/types';
import { MessageBus } from '../core/MessageBus';
import { AssessmentEngine } from '../doo/AssessmentEngine';
import { LLMClient } from '../nlp/LLMClient';

export class ExpertAgent extends Agent {
  private assessmentEngine: AssessmentEngine;

  constructor(config: AgentConfig, messageBus: MessageBus, llmClient: LLMClient, useLLM = true) {
    super(config, messageBus);
    this.assessmentEngine = new AssessmentEngine(llmClient, useLLM);
  }

  protected setupSubscriptions(): void {
    this.subscribe('assessment_request', this.handleAssessmentRequest.bind(this));
    this.subscribe('narrative_input', this.handleNarrativeInput.bind(this));
  }

  private async handleAssessmentRequest(message: AgentMessage): Promise<void> {
    const payload = message.payload as { narrativeInput?: NarrativeInput };
    if (!payload.narrativeInput) return;

    try {
      const assessment = await this.assessmentEngine.assess(payload.narrativeInput);

      this.sendMessage('all', 'assessment_result', {
        assessment,
        expert: this.config.name,
        timestamp: new Date(),
      });

      this.sendMessage('teacher', 'suggestion', {
        type: 'expert_suggestions',
        assessment,
        suggestions: assessment.suggestions,
      });
    } catch (error) {
      console.error('Expert assessment error:', error);
      this.sendMessage('teacher', 'suggestion', {
        type: 'assessment_error',
        error: String(error),
      });
    }
  }

  private async handleNarrativeInput(message: AgentMessage): Promise<void> {
    const narrativeInput = message.payload as NarrativeInput;

    try {
      const assessment = await this.assessmentEngine.assess(narrativeInput);

      this.sendMessage('all', 'assessment_result', {
        assessment,
        expert: this.config.name,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Expert auto-assessment error:', error);
    }
  }

  async assessWithContext(
    input: NarrativeInput,
    peerResponse?: PeerResponse | null,
    scaffold?: ScaffoldSuggestion | null
  ): Promise<DOOAssessment> {
    const assessment = await this.assessmentEngine.assess(input);

    if (scaffold?.suggestions) {
      const contextNote = `（小欧老师支架：${scaffold.suggestions[0]}）`;
      if (!assessment.suggestions.some(s => s.includes('小欧老师'))) {
        assessment.suggestions.push(contextNote);
      }
    }

    this.sendMessage('all', 'assessment_result', {
      assessment,
      expert: this.config.name,
      peerContext: peerResponse?.message,
      scaffoldContext: scaffold?.suggestions?.[0],
      timestamp: new Date(),
    });

    return assessment;
  }

  async generatePersonalizedPlan(assessment: DOOAssessment): Promise<string[]> {
    const plan: string[] = [];
    const dims = assessment.dimensions;

    if (dims.diction.vocabulary < 3) {
      plan.push('词汇拓展：每日学习2-3个新形容词，在叙事中尝试使用。');
    }
    if (dims.diction.sentenceStructure < 3) {
      plan.push('句型练习：使用"因为...所以..."、"虽然...但是..."等连接词。');
    }
    if (dims.organization.narrativeStructure < 3) {
      plan.push('结构训练：使用"开头-发展-结尾"三段式模板进行叙事。');
    }
    if (dims.organization.eventExpansion < 3) {
      plan.push('细节丰富：引导描述人物外貌、场景颜色、动作细节。');
    }
    if (dims.opinion.narrativeViewpoint < 3) {
      plan.push('观点表达：鼓励使用"我觉得..."、"我喜欢..."表达感受。');
    }

    if (plan.length === 0) {
      plan.push('能力发展良好，建议尝试更复杂的叙事主题和挑战。');
    }

    return plan;
  }

  generateMetaAssessment(assessments: DOOAssessment[]): {
    trend: 'improving' | 'stable' | 'declining';
    recommendation: string;
  } {
    if (assessments.length < 2) {
      return {
        trend: 'stable',
        recommendation: '数据不足，建议继续观察和评估。',
      };
    }

    const sorted = [...assessments].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    const firstAvg = this.calculateAverage(first.dimensions);
    const lastAvg = this.calculateAverage(last.dimensions);

    let trend: 'improving' | 'stable' | 'declining';
    if (lastAvg > firstAvg + 0.3) {
      trend = 'improving';
    } else if (lastAvg < firstAvg - 0.3) {
      trend = 'declining';
    } else {
      trend = 'stable';
    }

    const recommendation = this.generateRecommendation(trend, last.dimensions);

    return { trend, recommendation };
  }

  private calculateAverage(dimensions: DOOAssessment['dimensions']): number {
    const scores = [
      dimensions.diction.vocabulary,
      dimensions.diction.sentenceStructure,
      dimensions.organization.narrativeStructure,
      dimensions.organization.themeRelevance,
      dimensions.organization.eventExpansion,
      dimensions.organization.expressiveness,
      dimensions.opinion.narrativeViewpoint,
    ];
    return scores.reduce((sum, s) => sum + s, 0) / scores.length;
  }

  private generateRecommendation(
    trend: 'improving' | 'stable' | 'declining',
    dimensions: DOOAssessment['dimensions']
  ): string {
    switch (trend) {
      case 'improving':
        return '幼儿叙事能力呈上升趋势，建议保持当前培养策略并适当增加挑战。';
      case 'declining':
        return '幼儿叙事能力出现波动，建议关注其情绪状态，调整活动难度和兴趣点。';
      case 'stable':
      default: {
        const weakAreas: string[] = [];
        if (dimensions.diction.vocabulary <= 1) weakAreas.push('词汇');
        if (dimensions.organization.narrativeStructure <= 1) weakAreas.push('叙事结构');
        if (dimensions.opinion.narrativeViewpoint <= 1) weakAreas.push('观点表达');

        if (weakAreas.length > 0) {
          return `能力发展平稳，建议重点加强${weakAreas.join('、')}方面的训练。`;
        }
        return '能力发展稳定，建议拓展叙事主题和情境，保持学习兴趣。';
      }
    }
  }
}
