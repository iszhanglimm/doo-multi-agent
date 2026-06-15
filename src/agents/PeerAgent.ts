import { Agent, PeerResponse } from '../core/Agent';
import { AgentConfig, AgentMessage, DOOAssessment, NarrativeInput, ScenarioType } from '../core/types';
import { MessageBus } from '../core/MessageBus';
import { LLMClient } from '../nlp/LLMClient';

export class PeerAgent extends Agent {
  private conversationHistory: Map<string, string[]> = new Map();
  private llmClient: LLMClient | null;
  private useLLM: boolean;

  constructor(config: AgentConfig, messageBus: MessageBus, llmClient?: LLMClient, useLLM = false) {
    super(config, messageBus);
    this.llmClient = llmClient || null;
    this.useLLM = useLLM && !!llmClient;
  }

  protected setupSubscriptions(): void {
    this.subscribe('narrative_input', this.handleNarrativeInput.bind(this));
    this.subscribe('interaction', this.handleInteraction.bind(this));
    this.subscribe('suggestion', this.handleSuggestion.bind(this));
  }

  private async handleNarrativeInput(message: AgentMessage): Promise<void> {
    const narrativeInput = message.payload as NarrativeInput;
    const childId = narrativeInput.childId;

    this.addToHistory(childId, `小朋友说: ${narrativeInput.content}`);

    const response = this.generatePeerResponse(narrativeInput.content, childId, narrativeInput.scenario);

    this.sendMessage('all', 'interaction', {
      action: 'peer_response',
      childId,
      from: this.config.name,
      message: response,
      scenario: narrativeInput.scenario,
      type: 'encouragement',
    });
  }

  private async handleInteraction(message: AgentMessage): Promise<void> {
    const payload = message.payload as Record<string, unknown>;

    if (payload.action === 'peer_response') return;

    const childId = (payload.childId as string) || 'unknown';

    if (payload.action === 'encourage_narrative') {
      const scenario = (payload.scenario as ScenarioType) || 'smart_story_corner';
      const response = this.generateEncouragement(childId, scenario);
      this.sendMessage('all', 'interaction', {
        action: 'peer_response',
        childId,
        from: this.config.name,
        message: response,
        scenario,
        type: 'encouragement',
      });
    }

    if (payload.action === 'provide_scaffold') {
      const scenario = (payload.scenario as ScenarioType) || 'smart_story_corner';
      const response = this.generateScaffoldResponse(childId, scenario);
      this.sendMessage('all', 'interaction', {
        action: 'peer_response',
        childId,
        from: this.config.name,
        message: response,
        scenario,
        type: 'scaffold',
      });
    }
  }

  private async handleSuggestion(message: AgentMessage): Promise<void> {
    const payload = message.payload as Record<string, unknown>;

    if (payload.type === 'scaffold_strategy') {
      const childId = payload.childId as string;
      const scenario = (payload.scenario as ScenarioType) || 'smart_story_corner';
      const suggestions = payload.suggestions as string[];

      const response = this.translateToPeerLanguage(
        suggestions[0] || '我们一起讲故事吧！',
        scenario
      );

      this.sendMessage('all', 'interaction', {
        action: 'peer_response',
        childId,
        from: this.config.name,
        message: response,
        scenario,
        type: 'suggestion',
      });
    }
  }

  private generatePeerResponse(content: string, childId: string, scenario: ScenarioType): string {
    const responses = this.getScenarioResponses(content, scenario);

    const history = this.conversationHistory.get(childId) || [];
    const index = history.length % responses.length;

    return responses[index];
  }

  private generateEncouragement(childId: string, scenario: ScenarioType): string {
    const encouragements = this.getScenarioEncouragements(scenario);

    const history = this.conversationHistory.get(childId) || [];
    const index = history.length % encouragements.length;

    return encouragements[index];
  }

  private generateScaffoldResponse(childId: string, scenario: ScenarioType): string {
    const scaffolds = this.getScenarioScaffolds(scenario);

    const history = this.conversationHistory.get(childId) || [];
    const index = history.length % scaffolds.length;

    return scaffolds[index];
  }

  private translateToPeerLanguage(teacherSuggestion: string, scenario: ScenarioType): string {
    const translations: Record<string, string> = {
      '使用图片提示，引导幼儿描述颜色和形状。': '你能告诉我那是什么颜色的吗？是圆圆的还是方方的？',
      '使用故事地图，帮助幼儿理清叙事结构。': '我们先说开头，然后再说中间，最后说结尾，好吗？',
      '提供开头-中间-结尾的叙事框架。': '一开始发生了什么？然后呢？最后怎么样了？',
      '通过提问"你觉得怎么样？"引导表达观点。': '你觉得这个故事怎么样？好玩吗？',
      '使用情感卡片，帮助幼儿识别和表达情绪。': '故事里的小朋友是开心还是难过呀？',
    };

    for (const [key, value] of Object.entries(translations)) {
      if (teacherSuggestion.includes(key)) {
        return value;
      }
    }

    if (scenario === 'journey_podcast') {
      return '如果你就是故事里的那个角色，你会怎么说呀？我想听！';
    }
    if (scenario === 'narrative_train') {
      return '轮到你接故事火车啦！你能顺着前面继续讲吗？';
    }
    return `哇，这个好有趣！你能再多说一些吗？`;
  }

  private getScenarioResponses(content: string, scenario: ScenarioType): string[] {
    switch (scenario) {
      case 'smart_story_corner':
        return [
          `哇，你讲的故事好有趣！我最喜欢${this.extractTopic(content)}的部分。`,
          '真的吗？那后来呢？我想知道接下来发生了什么！',
          `你说得真好！我也想去${this.extractPlace(content)}看看。`,
          '哈哈，太好玩了！你能再给我讲一个吗？',
          '哇，你好厉害！我觉得你讲的故事比动画片还好看。',
        ];
      case 'narrative_train':
        return [
          '故事火车开得好快呀！接下来是谁出场啦？',
          '我听懂啦，你再把中间发生的事情讲清楚一点好吗？',
          '哇，这一段好精彩！后来还发生了什么？',
          '我想和你一起把这个故事讲完整！',
          '这个接龙真有意思，你再补一个结尾吧！',
        ];
      case 'journey_podcast':
        return [
          '哇，你像真的在讲西游记一样！那个角色后来做了什么呀？',
          '如果你是孙悟空，你会不会更勇敢一点呀？',
          '我喜欢你刚刚那一段，像在听播客节目！',
          '这个角色心里怎么想的？你再告诉我一下吧！',
          '哇，你讲得像小主播一样，我还想继续听！',
        ];
      default:
        return ['哇，你讲得真棒！'];
    }
  }

  private getScenarioEncouragements(scenario: ScenarioType): string[] {
    switch (scenario) {
      case 'smart_story_corner':
        return [
          '你说得真棒！我想听更多。',
          '哇，好厉害！你能再讲多一点吗？',
          '我喜欢听你讲故事！',
          '你讲得真好，我也想学会！',
          '哇，这个故事太精彩了！',
        ];
      case 'narrative_train':
        return [
          '火车继续开吧，我在认真听呢！',
          '你接得真好，再说后面发生了什么吧！',
          '轮到你这一节车厢啦，快继续！',
          '哇，你讲得让故事越来越完整了！',
          '太棒啦，我们一起把故事开到终点吧！',
        ];
      case 'journey_podcast':
        return [
          '你像小主播一样，好会讲哦！',
          '哇，这一段像真的西游记节目！',
          '你继续讲吧，我还想听角色后面怎么做。',
          '你讲角色的时候好像真的变成他了！',
          '耶，这一集播客肯定很好听！',
        ];
      default:
        return ['你说得真棒！'];
    }
  }

  private getScenarioScaffolds(scenario: ScenarioType): string[] {
    switch (scenario) {
      case 'smart_story_corner':
        return [
          '你能告诉我故事里的小朋友长什么样子吗？',
          '那个地方是什么颜色的呀？',
          '你最喜欢故事里的哪个部分？',
          '如果是你，你会怎么做呢？',
          '故事里的小朋友开心吗？你怎么知道的？',
        ];
      case 'narrative_train':
        return [
          '这一节火车先说开头发生了什么，好吗？',
          '然后呢？你帮我们把中间那一段接上吧！',
          '最后结果怎么样啦？你来当结尾小司机！',
          '你能把刚才那句话说得更完整一点吗？',
          '这个故事里是谁、在哪里、做了什么呀？',
        ];
      case 'journey_podcast':
        return [
          '你能说说这个角色心里在想什么吗？',
          '如果你是孙悟空，你会怎么保护朋友？',
          '这一章先发生了什么，后来又发生了什么呀？',
          '你能学一学角色说话的样子吗？',
          '这个地方最精彩的是哪一段？你再讲讲吧！',
        ];
      default:
        return ['你能再说一说吗？'];
    }
  }

  private extractTopic(content: string): string {
    const topics = ['小动物', '小朋友', '冒险', '游戏', '故事'];
    for (const topic of topics) {
      if (content.includes(topic.replace('小', ''))) {
        return topic;
      }
    }
    return '这个';
  }

  private extractPlace(content: string): string {
    const places = ['公园', '幼儿园', '家里', '山上', '海边'];
    for (const place of places) {
      if (content.includes(place)) {
        return place;
      }
    }
    return '那里';
  }

  private addToHistory(childId: string, message: string): void {
    if (!this.conversationHistory.has(childId)) {
      this.conversationHistory.set(childId, []);
    }
    this.conversationHistory.get(childId)!.push(message);
  }

  getConversationHistory(childId: string): string[] {
    return this.conversationHistory.get(childId) || [];
  }

  clearHistory(childId: string): void {
    this.conversationHistory.delete(childId);
  }

  async respondToNarrative(input: NarrativeInput): Promise<PeerResponse> {
    const childId = input.childId;
    this.addToHistory(childId, `小朋友说: ${input.content}`);

    let message: string;

    if (this.useLLM && this.llmClient) {
      try {
        message = await this.generateLLMResponse(input.content, input.scenario);
      } catch {
        message = this.generateTemplateResponse(input.content, childId, input.scenario);
      }
    } else {
      message = this.generateTemplateResponse(input.content, childId, input.scenario);
    }

    return { message, type: 'engagement' };
  }

  async generateFollowUp(
    input: NarrativeInput,
    assessment: DOOAssessment
  ): Promise<string> {
    if (this.useLLM && this.llmClient) {
      try {
        return await this.generateLLMFollowUp(input.content, assessment);
      } catch {
        // fall through to template
      }
    }

    // 增强模板：根据评估等级+弱项生成针对性鼓励
    const level = assessment.overallLevel;
    const weakDims = this.findWeakDimensions(assessment);

    if (level >= 3) {
      return `哇，你讲得太棒了！我都听入迷了！${this.getRandomEncouragement(input.scenario)}`;
    }
    if (level >= 2) {
      const hint = weakDims.length > 0 ? this.dimensionHint(weakDims[0]) : '你能再多说一些吗？';
      return `你讲得很好呀！${hint}`;
    }
    const hint = weakDims.length > 0 ? this.dimensionHint(weakDims[0]) : '你能再讲一次吗？';
    return `你勇敢地讲了故事，真了不起！${hint}`;
  }

  private async generateLLMResponse(content: string, scenario: ScenarioType): Promise<string> {
    const scenarioContext = scenario === 'journey_podcast'
      ? '你们在录制西游播客节目'
      : scenario === 'narrative_train'
        ? '你们在玩叙事火车游戏，要接力讲故事'
        : '你们在智能故事角一起讲故事';

    const prompt = `你是一个5岁的小朋友，名叫多多，正在上幼儿园大班。${scenarioContext}。
你的好朋友刚讲了一段话，你要像一个真实的5岁孩子一样回应。

要求：
- 用简短可爱的句子，像5岁孩子说话
- 用"哇""呀""耶"等感叹词
- 要提到好朋友说的具体内容（人名、动物、物品等）
- 可以问一个好奇的问题引导好朋友继续说
- 不要用太复杂的词语

好朋友说的内容：
"${content}"

请直接回复一句话，不要加引号或解释：`;

    const response = await this.llmClient!.complete(prompt);
    return response.trim().replace(/^["「]|["」]$/g, '').slice(0, 100);
  }

  private async generateLLMFollowUp(content: string, assessment: DOOAssessment): Promise<string> {
    const weakDims = this.findWeakDimensions(assessment);
    const hint = weakDims.length > 0 ? `需要鼓励孩子在${weakDims[0]}方面多表达` : '孩子表现很好';

    const prompt = `你是一个5岁的小朋友多多。你的朋友刚讲了一个故事，现在要给朋友一些鼓励。
${hint}。

朋友讲的故事："${content.slice(0, 100)}"
朋友的水平等级：${assessment.overallLevel}级（满分3级）

要求：像5岁孩子一样说话，简短、温暖、有童趣。直接说一句话：`;

    const response = await this.llmClient!.complete(prompt);
    return response.trim().replace(/^["「]|["」]$/g, '').slice(0, 80);
  }

  private generateTemplateResponse(content: string, childId: string, scenario: ScenarioType): string {
    const topic = this.extractRichTopic(content);
    const place = this.extractPlace(content);
    const history = this.conversationHistory.get(childId) || [];

    const templates = this.getEnhancedResponses(scenario, topic, place);
    return templates[history.length % templates.length];
  }

  private extractRichTopic(content: string): string {
    // 提取叙事中的具体名词
    const animals = ['兔子', '猫', '狗', '鸟', '鱼', '猴子', '大象', '熊猫', '老虎', '狮子', '蝴蝶', '青蛙'];
    const people = ['妈妈', '爸爸', '老师', '奶奶', '爷爷', '好朋友', '小朋友'];
    const things = ['花', '树', '苹果', '蛋糕', '玩具', '气球', '雨', '雪', '太阳', '月亮', '星星'];
    const places = ['公园', '学校', '幼儿园', '动物园', '森林', '海边', '山上', '家里'];

    for (const w of [...animals, ...people, ...things, ...places]) {
      if (content.includes(w)) return w;
    }

    // 尝试提取"X的/了/在"前面的词
    const match = content.match(/([一-龥]{2,4})(的|了|在|和)/);
    if (match) return match[1];

    return '这个';
  }

  private getEnhancedResponses(scenario: ScenarioType, topic: string, place: string): string[] {
    switch (scenario) {
      case 'smart_story_corner':
        return [
          `哇，${topic}好有趣呀！你能再给我讲讲${topic}吗？`,
          `真的吗？${topic}后来怎么样了？我想听！`,
          `你说得真好！${place !== '那里' ? `我也想去${place}看看` : '我也想遇到这样的事'}！`,
          `哈哈，${topic}太好玩了！你最喜欢哪个部分呀？`,
          `哇，你好厉害！我觉得${topic}的故事比动画片还好看。`,
        ];
      case 'narrative_train':
        return [
          `故事火车开得好快呀！${topic}接下来怎么了？`,
          `我听懂啦！你能把${topic}的事情再讲清楚一点吗？`,
          `哇，这一段好精彩！${topic}后来还发生了什么？`,
          `我想和你一起继续讲！然后呢然后呢？`,
          `这个接龙真有意思，你来补一个结尾吧！`,
        ];
      case 'journey_podcast':
        return [
          `哇，你讲得像真的西游记一样！${topic}后来做了什么呀？`,
          `如果你就是${topic}，你会怎么做呀？我想听！`,
          `我喜欢你刚刚那一段，像在听播客节目！`,
          `这个角色心里怎么想的？你再告诉我一下吧！`,
          `你讲得像小主播一样，我还想继续听！`,
        ];
      default:
        return [`哇，${topic}好有趣！你能再多说一些吗？`];
    }
  }

  private findWeakDimensions(assessment: DOOAssessment): string[] {
    const dims = assessment.dimensions;
    const weak: string[] = [];
    if (dims.diction.vocabulary <= 1) weak.push('词汇');
    if (dims.organization.narrativeStructure <= 1) weak.push('叙事结构');
    if (dims.organization.timeMarker <= 1) weak.push('时间顺序');
    if (dims.organization.eventExpansion <= 1) weak.push('细节描述');
    if (dims.opinion.narrativeViewpoint <= 1) weak.push('观点表达');
    return weak;
  }

  private dimensionHint(dim: string): string {
    const hints: Record<string, string> = {
      '词汇': '你能用几个好听的词来形容一下吗？比如"大大的""漂亮的"？',
      '叙事结构': '你能先说开头发生了什么，然后再说后面吗？',
      '时间顺序': '你能用"先""然后""最后"来说一说吗？',
      '细节描述': '你能再说说它长什么样子吗？什么颜色的？大还是小？',
      '观点表达': '你觉得怎么样呀？你喜欢吗？',
    };
    return hints[dim] || '你能再讲一次吗？';
  }

  private getRandomEncouragement(scenario: ScenarioType): string {
    const msgs = this.getScenarioEncouragements(scenario);
    return msgs[Math.floor(Math.random() * msgs.length)];
  }

  /**
   * 多轮对话模式：基于完整对话历史生成轮次回应
   */
  async generateTurnResponse(
    history: Array<{ role: 'child' | 'peer'; content: string }>,
    scenario: ScenarioType
  ): Promise<{ message: string; suggestEnd: boolean }> {
    const childTurns = history.filter(t => t.role === 'child');
    const turnCount = childTurns.length;
    const lastChildMsg = childTurns[childTurns.length - 1]?.content || '';
    const suggestEnd = turnCount >= 5;

    let message: string;

    if (this.useLLM && this.llmClient) {
      try {
        message = await this.generateLLMTurnResponse(history, scenario, turnCount);
      } catch {
        message = this.generateTemplateTurnResponse(lastChildMsg, scenario, turnCount);
      }
    } else {
      message = this.generateTemplateTurnResponse(lastChildMsg, scenario, turnCount);
    }

    return { message, suggestEnd };
  }

  private async generateLLMTurnResponse(
    history: Array<{ role: 'child' | 'peer'; content: string }>,
    scenario: ScenarioType,
    turnCount: number
  ): Promise<string> {
    const scenarioContext = scenario === 'journey_podcast'
      ? '你们在录制西游播客节目'
      : scenario === 'narrative_train'
        ? '你们在玩叙事火车游戏'
        : '你们在智能故事角一起讲故事';

    const dialogueHistory = history
      .map(t => `${t.role === 'child' ? '小朋友' : '多多'}: ${t.content}`)
      .join('\n');

    // 分析孩子的叙事水平
    const childMsgs = history.filter(t => t.role === 'child').map(t => t.content);
    const avgLen = childMsgs.reduce((s, m) => s + m.length, 0) / (childMsgs.length || 1);
    const hasAdjective = childMsgs.some(m => /大|小|漂亮|可爱|美丽|开心|难过|高兴|勇敢|聪明/.test(m));
    const hasTimeMarker = childMsgs.some(m => /先|然后|最后|突然|后来|从前/.test(m));
    const hasOpinion = childMsgs.some(m => /我觉得|我认为|我喜欢|我想/.test(m));

    // 推断水平并制定策略
    let levelHint: string;
    if (avgLen > 60 && hasAdjective && hasTimeMarker && hasOpinion) {
      levelHint = '这个小朋友表达能力很强（水平3），你可以问开放性问题："你觉得为什么会这样？""如果让你来改结局，你会怎么改？"';
    } else if (avgLen > 30 || hasAdjective || hasTimeMarker) {
      levelHint = '这个小朋友有一定表达能力（水平2），你可以追问细节和感受："它长什么样？""你当时是什么感觉？"';
    } else {
      levelHint = '这个小朋友表达较简短（水平1），请用封闭式问题引导："是红色的吗？""它大不大？"，如果孩子说了3个字以下，你可以先示范一小段叙事引导他。';
    }

    const endHint = turnCount >= 5
      ? '这是最后一轮了，请给一个温暖的总结性回应，肯定孩子的进步。'
      : `这是第${turnCount}轮对话，请继续互动。`;

    const prompt = `你是一个5岁的可爱小朋友多多。${scenarioContext}。
${endHint}

【孩子水平分析】${levelHint}

【你的回应策略】
1. 情感共鸣：先回应孩子说的内容的情感（"哇它迷路了？那它一定很害怕吧！"）
2. 具体回应：提到孩子说的具体内容，不要泛泛而谈
3. 适当追问：根据水平分析选择合适的提问方式
4. 如果孩子只说了几个字很简短，你可以先示范一小段（"我来先说一个：有一天小猫在花园里追蝴蝶..."），然后邀请孩子继续
5. 像5岁孩子说话，用"哇""呀""耶""呢"等感叹词，句子简短

对话历史：
${dialogueHistory}

请直接回复一句话（不超过50字），不要加引号或解释：`;

    const response = await this.llmClient!.complete(prompt);
    return response.trim().replace(/^["「]|["」]$/g, '').slice(0, 80);
  }

  private generateTemplateTurnResponse(
    lastChildMsg: string,
    scenario: ScenarioType,
    turnCount: number
  ): string {
    const topic = this.extractRichTopic(lastChildMsg);

    if (turnCount <= 1) {
      // 第1轮：回应+追问细节
      const templates = [
        `哇，${topic}好有趣呀！你能再说说${topic}长什么样吗？`,
        `真的吗！后来${topic}怎么了？我想听！`,
        `你说得真好！${topic}是什么颜色的呀？`,
      ];
      return templates[Math.floor(Math.random() * templates.length)];
    }

    if (turnCount <= 3) {
      // 第2-3轮：继续追问+引导扩展
      const templates = [
        `然后呢？${topic}还做了什么？`,
        `哇，好精彩！你觉得${topic}心里在想什么呀？`,
        `真的呀！那旁边还有谁呢？`,
        `你能把刚才那段再说详细一点吗？`,
      ];
      return templates[Math.floor(Math.random() * templates.length)];
    }

    // 第4-5轮：引导观点+收尾
    const templates = [
      `你讲得越来越好了！你觉得${topic}怎么样呀？你喜欢吗？`,
      `哇，你讲了好多！我最喜欢${topic}那一段了！`,
      `你讲得太棒了！如果让你给故事起个名字，你会叫它什么呀？`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }
}
