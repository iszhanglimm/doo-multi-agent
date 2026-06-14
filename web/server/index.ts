import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../../.env') });
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { DOOMultiAgentSystem } from '../../src';
import { NarrativeInput, ScenarioType } from '../../src/core/types';
import {
  createSession,
  getSession,
  addTurn,
  buildNarrativeInput,
  getChildTurnCount,
  shouldSuggestEnd,
  markAssessed,
} from '../../src/conversation/ConversationSession';

const app = express();
const port = 3001;

app.use(cors());
app.use(bodyParser.json());

const system = new DOOMultiAgentSystem();

// 初始化系统
system.initialize().then(() => {
  console.log('✅ DOO多智能体系统服务已启动');
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', agents: ['expert', 'teacher', 'peer'] });
});

// 评估叙事
app.post('/api/assess', async (req, res) => {
  try {
    const { childId, childName, classId, content, scenario } = req.body;

    if (!childName || !content) {
      return res.status(400).json({ error: '缺少必要参数: childName, content' });
    }

    const input: NarrativeInput = {
      childId: childId || `child_${Date.now()}`,
      childName,
      classId: classId || 'class_001',
      content,
      scenario: scenario || 'smart_story_corner',
      timestamp: new Date(),
    };

    // 使用场景运行来评估并保存画像
    const result = await system.runScenario(scenario || 'smart_story_corner', input);

    res.json({
      success: true,
      assessment: result.assessment,
      portrait: result.portrait,
      childId: input.childId,
      interactions: result.interactions,
      reflections: result.reflections ?? [],
    });
  } catch (error) {
    console.error('评估错误:', error);
    res.status(500).json({ error: '评估失败', message: (error as Error).message });
  }
});

// 运行场景
app.post('/api/scenario/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { childId, childName, classId, content } = req.body;

    const input: NarrativeInput = {
      childId: childId || `child_${Date.now()}`,
      childName: childName || '匿名',
      classId: classId || 'class_001',
      content: content || '',
      scenario: type as ScenarioType,
      timestamp: new Date(),
    };

    const result = await system.runScenario(type as ScenarioType, input);

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('场景运行错误:', error);
    res.status(500).json({ error: '场景运行失败', message: (error as Error).message });
  }
});

// 获取幼儿画像
app.get('/api/portrait/:childId', async (req, res) => {
  try {
    const { childId } = req.params;
    const portrait = await system.getPortrait(childId);

    if (!portrait) {
      return res.status(404).json({ error: '未找到该幼儿画像' });
    }

    res.json({ success: true, portrait });
  } catch (error) {
    res.status(500).json({ error: '获取画像失败', message: (error as Error).message });
  }
});

// 获取所有画像
app.get('/api/portraits', async (req, res) => {
  try {
    const portraits = await system.portraitStorage.loadAllPortraits();
    res.json({ success: true, portraits });
  } catch (error) {
    res.status(500).json({ error: '获取画像列表失败', message: (error as Error).message });
  }
});

// 生成雷达图
app.get('/api/radar/:childId', async (req, res) => {
  try {
    const { childId } = req.params;
    const radar = await system.generateRadarChart(childId);
    res.json({ success: true, radar });
  } catch (error) {
    res.status(500).json({ error: '生成雷达图失败', message: (error as Error).message });
  }
});

// 生成报告
app.get('/api/report/:childId', async (req, res) => {
  try {
    const { childId } = req.params;
    const report = await system.generatePortraitReport(childId);
    res.json({ success: true, report });
  } catch (error) {
    res.status(500).json({ error: '生成报告失败', message: (error as Error).message });
  }
});

// 删除幼儿画像
app.delete('/api/portrait/:childId', async (req, res) => {
  try {
    const { childId } = req.params;
    const deleted = await system.portraitStorage.deletePortrait(childId);

    if (deleted) {
      res.json({ success: true, message: '画像已删除' });
    } else {
      res.status(404).json({ error: '未找到该幼儿画像' });
    }
  } catch (error) {
    res.status(500).json({ error: '删除画像失败', message: (error as Error).message });
  }
});

// 获取统计数据
app.get('/api/stats', async (req, res) => {
  try {
    const portraits = await system.portraitStorage.loadAllPortraits();

    // 幼儿总数
    const totalChildren = portraits.length;

    // 班级统计
    const classMap = new Map<string, number>();
    let totalScore = 0;

    for (const portrait of portraits) {
      const classId = portrait.classId;
      classMap.set(classId, (classMap.get(classId) || 0) + 1);

      const score = (portrait.currentRadar.diction + portrait.currentRadar.organization + portrait.currentRadar.opinion) / 3;
      totalScore += score;
    }

    // 平均等级
    const avgLevel = totalChildren > 0 ? (totalScore / totalChildren).toFixed(2) : '0.00';

    // 今日评估数（简化：返回最近24小时内的，这里用总数模拟）
    const todayCount = Math.min(portraits.length, 12);

    res.json({
      success: true,
      stats: {
        totalChildren,
        todayCount,
        classCount: classMap.size,
        avgLevel: parseFloat(avgLevel),
      },
    });
  } catch (error) {
    res.status(500).json({ error: '获取统计数据失败', message: (error as Error).message });
  }
});

// ========== 多轮对话 API ==========

// 开始对话
app.post('/api/conversation/start', async (req, res) => {
  try {
    const { childName, classId, scenario } = req.body;
    if (!childName) {
      return res.status(400).json({ error: '缺少 childName' });
    }

    const session = createSession(
      childName,
      classId || 'class_001',
      (scenario || 'smart_story_corner') as ScenarioType
    );

    // 多多的第一句开场白
    const greeting = scenario === 'journey_podcast'
      ? `哇，${childName}！我们今天来录西游播客吧！你最喜欢西游记里的谁呀？`
      : scenario === 'narrative_train'
        ? `${childName}，故事火车要开啦！你来当第一节车厢，给我们讲个故事吧！`
        : `嗨，${childName}！我是多多！你今天想给我讲个什么故事呀？`;

    res.json({
      success: true,
      sessionId: session.sessionId,
      greeting,
      maxTurns: 5,
    });
  } catch (error) {
    res.status(500).json({ error: '创建对话失败', message: (error as Error).message });
  }
});

// 对话轮次：孩子说话 → 多多回应
app.post('/api/conversation/turn', async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    if (!sessionId || !message) {
      return res.status(400).json({ error: '缺少 sessionId 或 message' });
    }

    const session = getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: '对话会话不存在或已过期' });
    }
    if (session.status !== 'active') {
      return res.status(400).json({ error: '对话已结束' });
    }

    // 记录孩子的发言
    addTurn(sessionId, 'child', message);

    // 多多生成回应
    const peerAgent = system.peerAgent;
    const { message: peerMessage, suggestEnd } = await peerAgent.generateTurnResponse(
      session.turns.map(t => ({ role: t.role, content: t.content })),
      session.scenario
    );

    // 记录多多的回应
    addTurn(sessionId, 'peer', peerMessage);

    const turnCount = getChildTurnCount(session);

    res.json({
      success: true,
      peerMessage,
      turnCount,
      maxTurns: 5,
      suggestEnd: shouldSuggestEnd(session),
    });
  } catch (error) {
    res.status(500).json({ error: '对话轮次失败', message: (error as Error).message });
  }
});

// 结束对话 → 触发三智能体评估
app.post('/api/conversation/end', async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: '缺少 sessionId' });
    }

    const session = getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: '对话会话不存在或已过期' });
    }

    // 拼接所有孩子发言为完整叙事
    const narrativeInput = buildNarrativeInput(session);

    // 运行三智能体协作评估
    const result = await system.runScenario(session.scenario, narrativeInput);

    // 保存评估结果
    if (result.portrait) {
      markAssessed(sessionId, result.assessment, result.portrait);
    }

    res.json({
      success: true,
      sessionId,
      turns: session.turns,
      childNarrative: narrativeInput.content,
      assessment: result.assessment,
      portrait: result.portrait,
      interactions: result.interactions,
      reflections: result.reflections,
    });
  } catch (error) {
    res.status(500).json({ error: '结束对话失败', message: (error as Error).message });
  }
});

app.listen(port, () => {
  console.log(`🚀 DOO多智能体API服务运行在 http://localhost:${port}`);
});
