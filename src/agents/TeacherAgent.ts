import { Agent, PeerResponse, ScaffoldSuggestion, ReflectionResult } from '../core/Agent';
import { AgentConfig, AgentMessage, DOOAssessment, NarrativeInput, ScenarioType, getScenarioLabel } from '../core/types';
import { MessageBus } from '../core/MessageBus';

export class TeacherAgent extends Agent {
  private observationRecords: Map<string, string[]> = new Map();

  constructor(config: AgentConfig, messageBus: MessageBus) {
    super(config, messageBus);
  }

  protected setupSubscriptions(): void {
    this.subscribe('narrative_input', this.handleNarrativeInput.bind(this));
    this.subscribe('assessment_result', this.handleAssessmentResult.bind(this));
    this.subscribe('interaction', this.handleInteraction.bind(this));
    this.subscribe('reflection', this.handleReflection.bind(this));
  }

  private async handleNarrativeInput(message: AgentMessage): Promise<void> {
    const narrativeInput = message.payload as NarrativeInput;
    const childId = narrativeInput.childId;

    const observation = `观察到幼儿${narrativeInput.childName}在${getScenarioLabel(narrativeInput.scenario)}中进行了叙事表达。`;
    this.addObservation(childId, observation);

    this.sendMessage('peer', 'interaction', {
      action: 'encourage_narrative',
      childId,
      childName: narrativeInput.childName,
      scenario: narrativeInput.scenario,
      message: this.generateOpeningPrompt(narrativeInput),
    });
  }

  private async handleAssessmentResult(message: AgentMessage): Promise<void> {
    const payload = message.payload as { assessment?: DOOAssessment };
    if (!payload.assessment) return;

    const assessment = payload.assessment;
    const childId = assessment.childId;

    const observation = `评估结果：${assessment.childName}的整体水平为${assessment.overallLevel}级。`;
    this.addObservation(childId, observation);

    const scaffoldSuggestions = this.generateScaffoldSuggestions(assessment);

    this.sendMessage('peer', 'suggestion', {
      type: 'scaffold_strategy',
      childId,
      scenario: assessment.scenario,
      suggestions: scaffoldSuggestions,
      teachingNotes: this.generateTeachingNotes(assessment),
    });

    this.sendMessage('all', 'suggestion', {
      type: 'teaching_reflection',
      childId,
      assessment,
      teachingNotes: this.generateTeachingNotes(assessment),
    });
  }

  private async handleInteraction(message: AgentMessage): Promise<void> {
    const payload = message.payload as Record<string, unknown>;

    if (payload.action === 'request_scaffold') {
      const childId = payload.childId as string;
      const childName = payload.childName as string;

      this.sendMessage('peer', 'interaction', {
        action: 'provide_scaffold',
        childId,
        childName,
        scaffoldType: 'prompting',
        message: `你可以试着说说${childName}看到了什么，听到了什么，感觉到了什么。`,
      });
    }
  }

  private async handleReflection(message: AgentMessage): Promise<void> {
    const payload = message.payload as Record<string, unknown>;
    const reflections = payload.reflections as string[];

    console.log(`[${this.config.name}] 收到反思记录:`);
    for (const reflection of reflections || []) {
      console.log(`  - ${reflection}`);
    }
  }

  private addObservation(childId: string, observation: string): void {
    if (!this.observationRecords.has(childId)) {
      this.observationRecords.set(childId, []);
    }
    this.observationRecords.get(childId)!.push(observation);
  }

  getObservations(childId: string): string[] {
    return this.observationRecords.get(childId) || [];
  }

  async generateScaffold(
    input: NarrativeInput,
    peerResponse?: PeerResponse | null
  ): Promise<ScaffoldSuggestion> {
    const observation = `观察到幼儿${input.childName}在${getScenarioLabel(input.scenario)}中进行了叙事表达，内容长度${input.content.length}字。`;
    this.addObservation(input.childId, observation);

    if (peerResponse) {
      this.addObservation(input.childId, `同伴多多回应：${peerResponse.message}`);
    }

    const suggestions: string[] = [this.getScenarioScaffold(input.scenario)];
    suggestions.push(this.generateOpeningPrompt(input));

    return {
      suggestions,
      teachingNotes: `幼儿本次叙事${input.content.length}字，${input.content.length < 50 ? '内容较短，需要更多引导' : '内容较丰富，可进一步提升'}`,
    };
  }

  async generateReflection(
    input: NarrativeInput,
    assessment: DOOAssessment
  ): Promise<ReflectionResult> {
    const scaffoldSuggestions = this.generateScaffoldSuggestions(assessment);
    const teachingNotes = this.generateTeachingNotes(assessment);
    const focus = this.getTeacherFocus(assessment);

    const reflections: string[] = [
      `本次${getScenarioLabel(input.scenario)}中，${input.childName}完成了叙事表达。`,
      `评估等级：${assessment.overallLevel}级。${focus}。`,
      ...teachingNotes.slice(0, 3),
    ];

    const followUpPlan = scaffoldSuggestions.slice(0, 3);

    return { reflections, followUpPlan };
  }

  private generateScaffoldSuggestions(assessment: DOOAssessment): string[] {
    const suggestions: string[] = [];
    const dims = assessment.dimensions;
    const scenario = assessment.scenario;

    suggestions.push(this.getScenarioScaffold(scenario));

    if (dims.diction.vocabulary <= 1) {
      suggestions.push(
        scenario === 'journey_podcast'
          ? '请围绕角色、场景和心情提供词汇卡，帮助幼儿说出更生动的描述。'
          : '使用图片提示，引导幼儿描述颜色、形状和动作细节。'
      );
      suggestions.push('提供词汇银行，鼓励幼儿加入形容词、副词和情感词。');
    }
    if (dims.organization.narrativeStructure <= 1) {
      suggestions.push(
        scenario === 'narrative_train'
          ? '在集体活动中用“谁先说开头、谁补充经过、谁负责结尾”的接龙框架帮助组织叙事。'
          : '使用故事地图，帮助幼儿理清叙事结构。'
      );
      suggestions.push('提供开头-中间-结尾的叙事框架，并提醒时间顺序。');
    }
    if (dims.organization.themeRelevance <= 1) {
      suggestions.push('用“我们现在讲的是谁、在哪里、发生了什么”三问，帮助幼儿保持主题聚焦。');
    }
    if (dims.opinion.narrativeViewpoint <= 1) {
      suggestions.push(
        scenario === 'journey_podcast'
          ? '通过“如果你是孙悟空/唐僧，你会怎么做”帮助幼儿表达角色观点。'
          : '通过提问“你觉得怎么样？”“你最喜欢哪一部分？”引导表达观点。'
      );
      suggestions.push('使用情感卡片，帮助幼儿识别和表达情绪。');
    }
    if (dims.organization.eventExpansion <= 1) {
      suggestions.push('追问“后来发生了什么”“你还看到了什么”，帮助幼儿补充关键细节。');
    }
    if (dims.organization.expressiveness <= 1) {
      suggestions.push(
        scenario === 'smart_story_corner'
          ? '鼓励幼儿模仿角色语气和动作，让故事讲述更生动。'
          : '提示幼儿加入声音、表情或动作表现，增强叙事感染力。'
      );
    }

    if (suggestions.length === 0) {
      suggestions.push('幼儿能力发展良好，可提供开放式问题促进深入思考和延展表达。');
    }

    return suggestions;
  }

  private generateTeachingNotes(assessment: DOOAssessment): string[] {
    const notes: string[] = [];
    const dims = assessment.dimensions;

    notes.push(`【幼儿】${assessment.childName}`);
    notes.push(`【场景】${getScenarioLabel(assessment.scenario)}`);
    notes.push(`【评估时间】${assessment.timestamp.toLocaleString()}`);
    notes.push(`【整体水平】${assessment.overallLevel}级`);
    notes.push(`【词句维度】词汇${dims.diction.vocabulary}级，句型${dims.diction.sentenceStructure}级`);
    notes.push(`【组织维度】结构${dims.organization.narrativeStructure}级，主题${dims.organization.themeRelevance}级，扩展${dims.organization.eventExpansion}级，表现${dims.organization.expressiveness}级`);
    notes.push(`【观点维度】观点${dims.opinion.narrativeViewpoint}级`);
    notes.push(`【助教策略】${this.getTeacherFocus(assessment)}`);

    if (assessment.suggestions.length > 0) {
      notes.push(`【建议】${assessment.suggestions[0]}`);
    }

    return notes;
  }

  private generateOpeningPrompt(narrativeInput: NarrativeInput): string {
    switch (narrativeInput.scenario) {
      case 'smart_story_corner':
        return '小朋友说得真棒！你能把故事里的样子、声音和心情再讲清楚一点吗？';
      case 'narrative_train':
        return '轮到你的小火车啦！你能接着前面的内容往下讲吗？';
      case 'journey_podcast':
        return '我们在录西游播客啦！你能说说这个角色做了什么、心里怎么想的吗？';
      default:
        return '小朋友说得真棒！能再讲多一点吗？';
    }
  }

  private getScenarioScaffold(scenario: ScenarioType): string {
    switch (scenario) {
      case 'smart_story_corner':
        return '在智能故事角中，优先使用图片观察和细节追问支架，帮助幼儿说得更具体。';
      case 'narrative_train':
        return '在叙事火车中，优先使用接龙顺序和角色分工支架，帮助幼儿保持集体叙事连贯。';
      case 'journey_podcast':
        return '在西游播客中，优先使用角色代入和章节线索支架，帮助幼儿围绕主题完整表达。';
      default:
        return '结合当前活动情境，提供适时、具体、可执行的支架。';
    }
  }

  private getTeacherFocus(assessment: DOOAssessment): string {
    const dims = assessment.dimensions;
    const focus: string[] = [];

    if (dims.diction.vocabulary <= 1 || dims.diction.sentenceStructure <= 1) {
      focus.push('先扩充词句，再鼓励完整表达');
    }
    if (dims.organization.narrativeStructure <= 1 || dims.organization.themeRelevance <= 1) {
      focus.push('帮助幼儿理清故事顺序并紧扣主题');
    }
    if (dims.opinion.narrativeViewpoint <= 1) {
      focus.push('多追问感受与想法，促进观点表达');
    }

    if (focus.length === 0) {
      focus.push('可提升挑战度，鼓励更丰富的细节和角色视角');
    }

    return focus.join('；');
  }

  generateClassReport(classId: string, assessments: DOOAssessment[]): string {
    const classAssessments = assessments.filter(a => a.classId === classId);
    if (classAssessments.length === 0) {
      return '该班级暂无评估数据。';
    }

    const avgLevel = classAssessments.reduce((sum, a) => sum + a.overallLevel, 0) / classAssessments.length;
    const level1Count = classAssessments.filter(a => a.overallLevel === 1).length;
    const level2Count = classAssessments.filter(a => a.overallLevel === 2).length;
    const level3Count = classAssessments.filter(a => a.overallLevel === 3).length;

    const report = [
      `【班级叙事能力评估报告】`,
      `评估人数：${classAssessments.length}人`,
      `平均等级：${avgLevel.toFixed(1)}`,
      ``,
      `等级分布：`,
      `  基础水平(1级)：${level1Count}人`,
      `  发展水平(2级)：${level2Count}人`,
      `  优秀水平(3级)：${level3Count}人`,
      ``,
      `教学建议：`,
    ];

    if (level1Count > classAssessments.length * 0.3) {
      report.push('  • 超过30%幼儿处于基础水平，建议加强词汇和句型训练。');
    }
    if (level3Count > classAssessments.length * 0.3) {
      report.push('  • 超过30%幼儿达到优秀水平，可提供更具挑战性的叙事任务。');
    }

    report.push('  • 建议采用分层教学，针对不同水平幼儿提供差异化支持。');

    return report.join('\n');
  }
}
