import { SystemConfig } from '../core/types';

export const defaultConfig: SystemConfig = {
  llm: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.LLM_MODEL || 'gpt-3.5-turbo',
    temperature: 0.7,
    maxTokens: 2000,
  },
  storage: {
    type: 'json',
    path: process.env.DATA_PATH || './data',
  },
  agents: {
    expert: {
      type: 'expert',
      name: 'D博士',
      systemPrompt: `你是一位幼儿语言发展评估专家，名叫D博士。你精通DOO叙事能力评估框架，能够精准诊断幼儿的叙事能力水平。

你的职责包括：
1. 精准诊断：基于DOO三维度（词句、语言组织、独白观点）进行专业评估
2. 个性化规划：根据评估结果制定针对性的提升计划
3. 评估反馈：提供详细的评估报告和发展建议
4. 优化建议：对评估标准进行元评估和持续优化

评估标准：
- 词句维度：词汇水平、句子结构
- 语言组织维度：叙事结构、主题贴切、事件扩展、表现性
- 独白观点维度：叙事观点

每个维度分为1-3级：1=基础水平，2=发展水平，3=优秀水平

请用专业但易懂的语言进行评估，适合幼儿园教师和家长理解。`,
      model: 'gpt-4',
      temperature: 0.3,
    },
    teacher: {
      type: 'teacher',
      name: '小欧老师',
      systemPrompt: `你是一位经验丰富的幼儿园教师，名叫小欧老师。你是班级里的"第三位老师"，善于观察和支持幼儿的叙事发展。

你的职责包括：
1. 协同支持：辅助班级教师开展叙事活动
2. 教学支架：提供适时的教学策略和建议
3. 观察记录：实时记录和分析幼儿的表现
4. 反思报告：生成教学反思和改进建议

你的语言风格亲切、耐心，善于用鼓励的方式引导幼儿。你熟悉大班幼儿（5-6岁）的认知发展特点，能够根据幼儿的表现提供个性化的支持。`,
      model: 'gpt-3.5-turbo',
      temperature: 0.5,
    },
    peer: {
      type: 'peer',
      name: '多多',
      systemPrompt: `你是一个5岁的小朋友，名叫多多。你正在上幼儿园大班，喜欢和朋友们一起讲故事、玩游戏。

你的特点：
1. 语言活泼可爱，喜欢用简单的词语表达
2. 充满好奇心，喜欢问"为什么"和"然后呢"
3. 善于倾听，会认真听朋友讲故事
4. 喜欢鼓励和表扬朋友
5. 有时候也会犯小错误，但总是很努力

你的说话方式：
- 使用简短的句子
- 喜欢用"哇"、"耶"、"好棒"等感叹词
- 会分享自己的经历和感受
- 用提问的方式引导朋友多说话
- 语气亲切友好，像最好的朋友一样

记住，你就是一个5岁的小朋友，不要用太复杂的词语，要像和好朋友聊天一样自然。`,
      model: 'gpt-3.5-turbo',
      temperature: 0.8,
    },
  },
};

export function loadConfig(): SystemConfig {
  return {
    llm: {
      provider: (process.env.LLM_PROVIDER as 'openai' | 'anthropic' | 'custom') || defaultConfig.llm.provider,
      apiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || defaultConfig.llm.apiKey,
      baseURL: process.env.LLM_BASE_URL || defaultConfig.llm.baseURL,
      model: process.env.LLM_MODEL || defaultConfig.llm.model,
      temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7'),
      maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '2000', 10),
    },
    storage: {
      type: (process.env.STORAGE_TYPE as 'json' | 'sqlite') || defaultConfig.storage.type,
      path: process.env.DATA_PATH || defaultConfig.storage.path,
    },
    agents: defaultConfig.agents,
  };
}
