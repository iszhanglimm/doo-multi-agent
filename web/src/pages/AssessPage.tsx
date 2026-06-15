import React, { useState, useEffect, useRef } from 'react';
import { useAssessment } from '../hooks/useAssessment';
import { useConversation } from '../hooks/useConversation';
import { useAuth } from '../context/AuthContext';
import RadarChart from '../components/RadarChart';
import ReportExport from '../components/ReportExport';
import VoiceInput from '../components/VoiceInput';
import type { NarrativeInput, DOOAssessment } from '../types';

const CLASSES = [
  { id: 'class_001', name: '大班一班' },
  { id: 'class_002', name: '大班二班' },
  { id: 'class_003', name: '大班三班' },
  { id: 'class_004', name: '大班四班' },
];

const AssessPage: React.FC = () => {
  const { user } = useAuth();
  const { assessment, interactions, reflections, loading, error, assess, clearAssessment } = useAssessment();
  const conv = useConversation();
  const [mode, setMode] = useState<'assess' | 'conversation'>('assess');
  const [childName, setChildName] = useState('');
  const [content, setContent] = useState('');
  const [scenario, setScenario] = useState('smart_story_corner');
  const [classId, setClassId] = useState('class_001');
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 根据用户角色设置默认班级
  useEffect(() => {
    if (user?.role === 'teacher' && user?.classId) {
      setClassId(user.classId);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!childName.trim() || !content.trim()) return;

    const input: NarrativeInput = {
      childId: `child_${Date.now()}`,
      childName: childName.trim(),
      classId,
      content: content.trim(),
      scenario,
      timestamp: new Date(),
    };

    await assess(input);
  };

  const handleConvStart = async () => {
    if (!childName.trim()) return;
    await conv.start(childName.trim(), classId, scenario);
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || conv.loading) return;
    const msg = chatInput.trim();
    setChatInput('');
    await conv.send(msg);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const getLevelColor = (level: number) => {
    if (level <= 1) return '#FF6B6B';
    if (level <= 2) return '#FFB347';
    return '#4ADE80';
  };

  const getLevelLabel = (level: number) => {
    if (level <= 1) return '初级';
    if (level <= 2) return '中级';
    return '高级';
  };

  const calculateLevelFromDimensions = (dimensions: DOOAssessment['dimensions']): number => {
    const diction = (dimensions.diction.vocabulary + dimensions.diction.sentenceStructure) / 2;
    const organization = (dimensions.organization.narrativeStructure + dimensions.organization.themeRelevance + dimensions.organization.eventExpansion + dimensions.organization.expressiveness) / 4;
    const opinion = dimensions.opinion.narrativeViewpoint;
    const average = (diction + organization + opinion) / 3;
    if (average >= 2.5) return 3;
    if (average >= 1.5) return 2;
    return 1;
  };

  const teacherNotes = interactions
    .filter((message) => message.type === 'suggestion')
    .flatMap((message) => {
      const payload = message.payload as { teachingNotes?: string[]; suggestions?: string[]; type?: string };
      if (payload.teachingNotes?.length) return payload.teachingNotes;
      if (message.from === 'teacher' && payload.suggestions?.length) return payload.suggestions;
      return payload.teachingNotes || [];
    });

  const peerMessages = interactions
    .filter((message) => message.from === 'peer' && message.type === 'interaction')
    .map((message) => {
      const payload = message.payload as { message?: string; type?: string };
      return {
        id: message.id,
        text: payload.message || '',
        tone: payload.type || 'interaction',
      };
    })
    .filter((message) => message.text);

  const formatTeacherNote = (note: string) => note.replace(/^【(.+?)】/, '$1：');

  const getPeerToneLabel = (tone: string) => {
    if (tone === 'encouragement') return '鼓励回应';
    if (tone === 'scaffold') return '追问支架';
    if (tone === 'suggestion') return '同伴提示';
    return '互动回应';
  };

  const observationPoints = assessment ? [
    `词汇水平 ${assessment.dimensions.diction.vocabulary}级`,
    `句子结构 ${assessment.dimensions.diction.sentenceStructure}级`,
    `叙事结构 ${assessment.dimensions.organization.narrativeStructure}级`,
    `主题贴切 ${assessment.dimensions.organization.themeRelevance}级`,
    `事件扩展 ${assessment.dimensions.organization.eventExpansion}级`,
    `表现性 ${assessment.dimensions.organization.expressiveness}级`,
    `叙事观点 ${assessment.dimensions.opinion.narrativeViewpoint}级`,
  ] : [];

  return (
    <div className="assess-page animate-fade-in-up">
      <header className="page-header">
        <h1 className="brand-font gradient-text">叙事能力评估</h1>
        <p>D博士、小欧老师和多多将协同完成评估、支架与互动反馈</p>
      </header>

      {/* Mode Toggle */}
      <div className="mode-toggle">
        <button
          className={`mode-tab ${mode === 'assess' ? 'active' : ''}`}
          onClick={() => setMode('assess')}
        >
          📝 评估模式
        </button>
        <button
          className={`mode-tab ${mode === 'conversation' ? 'active' : ''}`}
          onClick={() => setMode('conversation')}
        >
          💬 对话模式
        </button>
      </div>

      {/* Conversation Mode */}
      {mode === 'conversation' && (
        <div className="conv-layout">
          <div className="conv-sidebar">
            <div className="assess-form">
              <div className="form-group">
                <label>幼儿姓名</label>
                <input type="text" className="input-field" placeholder="请输入幼儿姓名"
                  value={childName} onChange={(e) => setChildName(e.target.value)} />
              </div>
              <div className="form-group">
                <label>所属班级</label>
                <select className="input-field" value={classId} onChange={(e) => setClassId(e.target.value)}>
                  {CLASSES.map((cls) => (<option key={cls.id} value={cls.id}>{cls.name}</option>))}
                </select>
              </div>
              <div className="form-group">
                <label>评估场景</label>
                <select className="input-field" value={scenario} onChange={(e) => setScenario(e.target.value)}>
                  <option value="smart_story_corner">🎨 智能故事角</option>
                  <option value="narrative_train">🚂 叙事火车</option>
                  <option value="journey_podcast">🎭 西游播客</option>
                </select>
              </div>
              {conv.status === 'idle' ? (
                <button className="btn-primary" onClick={handleConvStart} disabled={!childName.trim() || conv.loading}>
                  {conv.loading ? '⏳ 创建中...' : '🚀 开始对话'}
                </button>
              ) : (
                <button className="btn-secondary" onClick={conv.reset}>
                  🔄 重新开始
                </button>
              )}
              {conv.status === 'chatting' && (
                <div className="conv-progress">
                  <span>第 {conv.turnCount} / {conv.maxTurns} 轮</span>
                  <button className="btn-end" onClick={conv.end} disabled={conv.loading}>
                    {conv.loading ? '评估中...' : '📊 结束并评估'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="conv-chat-area">
            {conv.status === 'idle' && (
              <div className="conv-empty">
                <div className="conv-empty-icon">💬</div>
                <p>输入幼儿姓名，点击"开始对话"</p>
                <p className="conv-empty-hint">多多会和孩子进行多轮对话，最后汇总评估</p>
              </div>
            )}

            {(conv.status === 'chatting' || conv.status === 'assessing') && (
              <div className="conv-chat">
                <div className="chat-header">
                  <span>🧒 {childName || '小朋友'} 与 🤖 多多的对话</span>
                  <span className="chat-round">第 {conv.turnCount} 轮</span>
                </div>
                <div className="chat-messages">
                  {conv.messages.map((msg) => (
                    <div key={msg.id} className={`chat-bubble ${msg.role === 'child' ? 'child-bubble' : 'peer-bubble'}`}>
                      <div className="bubble-avatar">{msg.role === 'child' ? '🧒' : '🤖'}</div>
                      <div className="bubble-content">{msg.content}</div>
                    </div>
                  ))}
                  {conv.loading && (
                    <div className="chat-bubble peer-bubble">
                      <div className="bubble-avatar">🤖</div>
                      <div className="bubble-content typing">多多正在思考...</div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                {conv.status === 'chatting' && (
                  <div className="chat-input-area">
                    <div className="chat-input-row">
                      <input
                        type="text"
                        className="chat-input"
                        placeholder="输入孩子的回答..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
                        disabled={conv.loading}
                      />
                      <button className="chat-send-btn" onClick={handleChatSend} disabled={!chatInput.trim() || conv.loading}>
                        发送
                      </button>
                    </div>
                    <div className="chat-voice-row">
                      <VoiceInput onTranscript={(text, isFinal) => {
                        if (isFinal) {
                          setChatInput(prev => prev ? prev + text : text);
                        }
                      }} />
                    </div>
                  </div>
                )}
                {conv.status === 'assessing' && (
                  <div className="chat-assessing">
                    <span className="spinner" /> 三智能体正在协同评估中...
                  </div>
                )}
              </div>
            )}

            {conv.status === 'done' && conv.assessment && (
              <div className="conv-result">
                <div className="result-card overall">
                  <div className="overall-header">
                    <h2>📊 评估结果</h2>
                    <div className="level-badge" style={{
                      background: `${getLevelColor(calculateLevelFromDimensions(conv.assessment.dimensions))}20`,
                      color: getLevelColor(calculateLevelFromDimensions(conv.assessment.dimensions))
                    }}>
                      等级 {calculateLevelFromDimensions(conv.assessment.dimensions)} · {getLevelLabel(calculateLevelFromDimensions(conv.assessment.dimensions))}
                    </div>
                  </div>
                  <div className="radar-section">
                    <RadarChart data={{
                      diction: ((conv.assessment.dimensions.diction?.vocabulary || 0) + (conv.assessment.dimensions.diction?.sentenceStructure || 0)) / 2,
                      organization: ((conv.assessment.dimensions.organization?.narrativeStructure || 0) + (conv.assessment.dimensions.organization?.timeMarker || 0) + (conv.assessment.dimensions.organization?.themeRelevance || 0) + (conv.assessment.dimensions.organization?.eventExpansion || 0) + (conv.assessment.dimensions.organization?.expressiveness || 0)) / 5,
                      opinion: conv.assessment.dimensions.opinion?.narrativeViewpoint || 0,
                    }} />
                  </div>
                </div>
                <div className="result-card suggestions">
                  <h3>💡 发展建议</h3>
                  <ul>
                    {(conv.assessment.suggestions || []).map((s, i) => (<li key={i}>{s}</li>))}
                  </ul>
                </div>
                {conv.reflections.length > 0 && (
                  <div className="result-card reflections">
                    <h3>🔁 反思优化</h3>
                    <ul>
                      {conv.reflections.map((r, i) => (<li key={i}>{r}</li>))}
                    </ul>
                  </div>
                )}
                <div className="result-card">
                  <h3>📝 完整对话记录</h3>
                  <div className="chat-messages" style={{ maxHeight: 'none' }}>
                    {conv.messages.map((msg) => (
                      <div key={msg.id} className={`chat-bubble ${msg.role === 'child' ? 'child-bubble' : 'peer-bubble'}`}>
                        <div className="bubble-avatar">{msg.role === 'child' ? '🧒' : '🤖'}</div>
                        <div className="bubble-content">{msg.content}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Assess Mode - original layout */}
      {mode === 'assess' && (
      <div className="assess-layout">
        {/* Input Form */}
        <div className="assess-form-container">
          <form onSubmit={handleSubmit} className="assess-form">
            <div className="form-group">
              <label>幼儿姓名</label>
              <input
                type="text"
                className="input-field"
                placeholder="请输入幼儿姓名"
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>所属班级</label>
              {user?.role === 'teacher' && user?.classId ? (
                <input
                  type="text"
                  className="input-field"
                  value={CLASSES.find(c => c.id === user.classId)?.name || user.classId}
                  disabled
                  readOnly
                />
              ) : (
                <select
                  className="input-field"
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                >
                  {CLASSES.map((cls) => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="form-group">
              <label>评估场景</label>
              <select
                className="input-field"
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
              >
                <option value="smart_story_corner">🎨 智能故事角</option>
                <option value="narrative_train">🚂 叙事火车</option>
                <option value="journey_podcast">🎭 西游播客</option>
              </select>
            </div>

            <div className="form-group">
              <label>
                叙事内容
                <VoiceInput onTranscript={(text, isFinal) => setContent((prev) => {
                  if (isFinal) {
                    const trimmed = prev.trim();
                    if (!trimmed) return prev;
                    const lastChar = trimmed.slice(-1);
                    const hasEndPunctuation = /[。！？]/.test(lastChar);
                    return trimmed + (hasEndPunctuation ? '' : '。');
                  }
                  const trimmed = prev.trim();
                  if (!trimmed) return text;
                  const lastChar = trimmed.slice(-1);
                  const hasPunctuation = /[，。！？、；：""''（）【】]/.test(lastChar);
                  return trimmed + (hasPunctuation ? '' : '，') + text;
                })} />
              </label>
              <textarea
                className="input-field"
                rows={6}
                placeholder="请记录幼儿的叙事内容，例如：我今天去公园玩，看到了很多漂亮的花..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
              />
              <span className="char-count">{content.length} 字</span>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner" /> 评估中...
                  </>
                ) : (
                  <>🎯 开始评估</>
                )}
              </button>
              {assessment && (
                <button type="button" className="btn-secondary" onClick={clearAssessment}>
                  重新评估
                </button>
              )}
            </div>
          </form>

          {error && (
            <div className="error-message">
              ❌ {error}
            </div>
          )}
        </div>

        {/* Results */}
        {assessment && assessment.dimensions && (
          <div className="assess-results">
            <div className="result-card info-card">
              <h3>📋 评估信息</h3>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">幼儿姓名</span>
                  <span className="info-value">{assessment.childName || childName}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">评估场景</span>
                  <span className="info-value">
                    {assessment.scenario === 'smart_story_corner' && '🎨 智能故事角'}
                    {assessment.scenario === 'narrative_train' && '🚂 叙事火车'}
                    {assessment.scenario === 'journey_podcast' && '🎭 西游播客'}
                    {!assessment.scenario && '🎨 智能故事角'}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">评估时间</span>
                  <span className="info-value">
                    {assessment.timestamp ? new Date(assessment.timestamp).toLocaleString('zh-CN') : new Date().toLocaleString('zh-CN')}
                  </span>
                </div>
              </div>
              <div className="narrative-content">
                <span className="info-label">叙事内容</span>
                <p className="content-text">{assessment.narrativeContent || content}</p>
              </div>
            </div>

            <div className="result-card overall">
              <div className="overall-header">
                <h2>评估结果</h2>
                <div
                  className="level-badge"
                  style={{ background: `${getLevelColor(calculateLevelFromDimensions(assessment.dimensions))}20`, color: getLevelColor(calculateLevelFromDimensions(assessment.dimensions)) }}
                >
                  等级 {calculateLevelFromDimensions(assessment.dimensions)} · {getLevelLabel(calculateLevelFromDimensions(assessment.dimensions))}
                </div>
              </div>

              <div className="radar-section">
                <RadarChart
                  data={{
                    diction: ((assessment.dimensions.diction?.vocabulary || 0) + (assessment.dimensions.diction?.sentenceStructure || 0)) / 2,
                    organization: ((assessment.dimensions.organization?.narrativeStructure || 0) + (assessment.dimensions.organization?.themeRelevance || 0) + (assessment.dimensions.organization?.eventExpansion || 0) + (assessment.dimensions.organization?.expressiveness || 0)) / 4,
                    opinion: assessment.dimensions.opinion?.narrativeViewpoint || 0,
                  }}
                />
              </div>
            </div>

            <div className="result-card dimensions">
              <h3>详细维度分析</h3>

              <div className="dimension-group">
                <div className="dimension-header">
                  <span className="dimension-icon">📝</span>
                  <span className="dimension-name">词句维度</span>
                </div>
                <div className="dimension-bars">
                  <div className="dim-bar">
                    <span>词汇丰富度</span>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{ width: `${((assessment.dimensions.diction?.vocabulary || 0) / 3) * 100}%`, background: '#FF8C42' }}
                      />
                    </div>
                    <span className="bar-value">{assessment.dimensions.diction?.vocabulary || 0}</span>
                  </div>
                  <div className="dim-bar">
                    <span>句型复杂度</span>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{ width: `${((assessment.dimensions.diction?.sentenceStructure || 0) / 3) * 100}%`, background: '#FF8C42' }}
                      />
                    </div>
                    <span className="bar-value">{assessment.dimensions.diction?.sentenceStructure || 0}</span>
                  </div>
                </div>
              </div>

              <div className="dimension-group">
                <div className="dimension-header">
                  <span className="dimension-icon">🧩</span>
                  <span className="dimension-name">组织维度</span>
                </div>
                <div className="dimension-bars">
                  <div className="dim-bar">
                    <span>叙事结构</span>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{ width: `${((assessment.dimensions.organization?.narrativeStructure || 0) / 3) * 100}%`, background: '#6B5B95' }}
                      />
                    </div>
                    <span className="bar-value">{assessment.dimensions.organization?.narrativeStructure || 0}</span>
                  </div>
                  <div className="dim-bar">
                    <span>主题关联</span>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{ width: `${((assessment.dimensions.organization?.themeRelevance || 0) / 3) * 100}%`, background: '#6B5B95' }}
                      />
                    </div>
                    <span className="bar-value">{assessment.dimensions.organization?.themeRelevance || 0}</span>
                  </div>
                  <div className="dim-bar">
                    <span>事件扩展</span>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{ width: `${((assessment.dimensions.organization?.eventExpansion || 0) / 3) * 100}%`, background: '#6B5B95' }}
                      />
                    </div>
                    <span className="bar-value">{assessment.dimensions.organization?.eventExpansion || 0}</span>
                  </div>
                  <div className="dim-bar">
                    <span>表现力</span>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{ width: `${((assessment.dimensions.organization?.expressiveness || 0) / 3) * 100}%`, background: '#6B5B95' }}
                      />
                    </div>
                    <span className="bar-value">{assessment.dimensions.organization?.expressiveness || 0}</span>
                  </div>
                </div>
              </div>

              <div className="dimension-group">
                <div className="dimension-header">
                  <span className="dimension-icon">💭</span>
                  <span className="dimension-name">观点维度</span>
                </div>
                <div className="dimension-bars">
                  <div className="dim-bar">
                    <span>叙事观点</span>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{ width: `${((assessment.dimensions.opinion?.narrativeViewpoint || 0) / 3) * 100}%`, background: '#88D8B0' }}
                      />
                    </div>
                    <span className="bar-value">{assessment.dimensions.opinion?.narrativeViewpoint || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="result-card suggestions">
              <h3>💡 发展建议</h3>
              <ul>
                {(assessment.suggestions || []).map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </div>

            <div className="result-card collaboration">
              <h3>🤝 多智能体协同反馈</h3>
              <div className="collaboration-grid">
                <div className="collaboration-panel teacher-panel">
                  <h4>👩‍🏫 小欧老师支架建议</h4>
                  {teacherNotes.length > 0 ? (
                    <ul>
                      {teacherNotes.map((note, index) => (
                        <li key={`${note}-${index}`}>{formatTeacherNote(note)}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="empty-collab">本次评估暂未生成助教支架记录。</p>
                  )}
                </div>

                <div className="collaboration-panel peer-panel">
                  <h4>🧒 多多同伴回应</h4>
                  {peerMessages.length > 0 ? (
                    <div className="peer-message-list">
                      {peerMessages.map((message) => (
                        <div key={message.id} className="peer-message-card">
                          <span className="peer-message-type">{getPeerToneLabel(message.tone)}</span>
                          <p>{message.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-collab">本次评估暂未生成同伴互动记录。</p>
                  )}
                </div>
              </div>
            </div>

            <div className="result-card reflections">
              <h3>🔁 反思优化</h3>
              {reflections.length > 0 ? (
                <ul>
                  {reflections.map((reflection, index) => (
                    <li key={`${reflection}-${index}`}>{reflection}</li>
                  ))}
                </ul>
              ) : (
                <p className="empty-collab">本次评估暂未生成反思记录。</p>
              )}
            </div>

            <div className="result-card observations">
              <h3>🔍 观测点</h3>
              <div className="observation-tags">
                {observationPoints.map((point, index) => (
                  <span key={index} className="observation-tag">{point}</span>
                ))}
              </div>
            </div>

            <ReportExport childName={childName} assessment={assessment} />
          </div>
        )}
      </div>
      )}

      <style>{`
        .assess-page {
          max-width: 1200px;
          margin: 0 auto;
        }

        .page-header {
          margin-bottom: 32px;
        }

        .page-header h1 {
          font-size: 28px;
          margin-bottom: 8px;
        }

        .page-header p {
          color: var(--text-secondary);
          font-size: 15px;
        }

        .assess-layout {
          display: grid;
          grid-template-columns: 400px 1fr;
          gap: 28px;
          align-items: start;
        }

        .assess-form-container {
          position: sticky;
          top: 32px;
        }

        .assess-form {
          background: white;
          border-radius: var(--radius-lg);
          padding: 28px;
          box-shadow: var(--shadow-soft);
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 8px;
        }

        .form-group textarea {
          resize: vertical;
          min-height: 140px;
        }

        .char-count {
          display: block;
          text-align: right;
          font-size: 12px;
          color: var(--text-light);
          margin-top: 6px;
        }

        .form-actions {
          display: flex;
          gap: 12px;
          margin-top: 24px;
        }

        .spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-right: 8px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .error-message {
          margin-top: 16px;
          padding: 12px 16px;
          background: #FEE2E2;
          color: #DC2626;
          border-radius: var(--radius-md);
          font-size: 14px;
        }

        .assess-results {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .result-card {
          background: white;
          border-radius: var(--radius-lg);
          padding: 28px;
          box-shadow: var(--shadow-soft);
          animation: fadeInUp 0.5s ease-out;
        }

        .result-card ul {
          margin: 0;
          padding-left: 20px;
        }

        .result-card li {
          color: var(--text-secondary);
          line-height: 1.7;
          margin-bottom: 8px;
        }

        .info-card h3 {
          font-size: 16px;
          margin-bottom: 16px;
          color: var(--text-primary);
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 20px;
        }

        .info-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .info-label {
          font-size: 12px;
          color: var(--text-light);
          font-weight: 500;
        }

        .info-value {
          font-size: 14px;
          color: var(--text-primary);
          font-weight: 600;
        }

        .narrative-content {
          padding-top: 16px;
          border-top: 1px solid var(--border);
        }

        .narrative-content .info-label {
          display: block;
          margin-bottom: 8px;
        }

        .content-text {
          font-size: 14px;
          line-height: 1.8;
          color: var(--text-secondary);
          background: var(--bg-warm);
          padding: 16px;
          border-radius: var(--radius-md);
          margin: 0;
        }

        .overall-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .overall-header h2 {
          font-size: 20px;
          color: var(--text-primary);
        }

        .level-badge {
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
        }

        .radar-section {
          display: flex;
          justify-content: center;
          padding: 20px 0;
        }

        .dimensions h3 {
          font-size: 18px;
          margin-bottom: 20px;
          color: var(--text-primary);
        }

        .dimension-group {
          margin-bottom: 24px;
        }

        .dimension-group:last-child {
          margin-bottom: 0;
        }

        .dimension-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }

        .dimension-icon {
          font-size: 18px;
        }

        .dimension-name {
          font-weight: 600;
          color: var(--text-primary);
          font-size: 15px;
        }

        .dimension-bars {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding-left: 26px;
        }

        .dim-bar {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .dim-bar > span:first-child {
          width: 80px;
          font-size: 13px;
          color: var(--text-secondary);
          flex-shrink: 0;
        }

        .bar-track {
          flex: 1;
          height: 10px;
          background: var(--bg-warm);
          border-radius: 5px;
          overflow: hidden;
        }

        .bar-fill {
          height: 100%;
          border-radius: 5px;
          transition: width 0.8s ease-out;
        }

        .bar-value {
          width: 24px;
          text-align: right;
          font-weight: 600;
          font-size: 13px;
          color: var(--text-primary);
        }

        .suggestions h3,
        .observations h3,
        .collaboration h3,
        .reflections h3 {
          font-size: 16px;
          margin-bottom: 14px;
          color: var(--text-primary);
        }

        .suggestions ul {
          list-style: none;
          padding: 0;
        }

        .suggestions li {
          padding: 10px 0;
          padding-left: 24px;
          position: relative;
          font-size: 14px;
          border-bottom: 1px solid var(--border);
        }

        .suggestions li:last-child {
          border-bottom: none;
        }

        .suggestions li::before {
          content: '💡';
          position: absolute;
          left: 0;
        }

        .observation-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .observation-tag {
          padding: 6px 14px;
          background: linear-gradient(135deg, var(--primary-light) 0%, var(--secondary-light) 100%);
          color: white;
          border-radius: 16px;
          font-size: 13px;
          font-weight: 500;
        }

        .collaboration-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .collaboration-panel {
          border-radius: var(--radius-md);
          padding: 20px;
        }

        .collaboration-panel h4 {
          margin: 0 0 14px;
          font-size: 15px;
          color: var(--text-primary);
        }

        .teacher-panel {
          background: linear-gradient(135deg, rgba(255, 140, 66, 0.08) 0%, rgba(255, 140, 66, 0.14) 100%);
        }

        .peer-panel {
          background: linear-gradient(135deg, rgba(107, 91, 149, 0.08) 0%, rgba(107, 91, 149, 0.14) 100%);
        }

        .peer-message-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .peer-message-card {
          background: rgba(255, 255, 255, 0.78);
          border-radius: 14px;
          padding: 14px 16px;
        }

        .peer-message-card p {
          margin: 8px 0 0;
          color: var(--text-secondary);
          line-height: 1.7;
        }

        .peer-message-type {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          color: #6B5B95;
          background: rgba(107, 91, 149, 0.12);
        }

        .empty-collab {
          margin: 0;
          color: var(--text-light);
          line-height: 1.7;
        }

        @media (max-width: 1024px) {
          .assess-layout {
            grid-template-columns: 1fr;
          }
          .assess-form-container {
            position: static;
          }
          .collaboration-grid {
            grid-template-columns: 1fr;
          }
          .conv-layout {
            grid-template-columns: 1fr !important;
          }
          .conv-sidebar {
            order: 2;
          }
          .conv-chat-area {
            order: 1;
          }
          .conv-chat {
            height: 500px;
          }
          .mode-toggle {
            width: 100%;
          }
          .mode-tab {
            flex: 1;
            text-align: center;
            padding: 10px 12px;
            font-size: 13px;
          }
          .info-grid {
            grid-template-columns: 1fr;
          }
          .page-header h1 {
            font-size: 22px;
          }
          .page-header p {
            font-size: 13px;
          }
        }
        @media (max-width: 480px) {
          .conv-chat {
            height: 400px;
          }
          .chat-messages {
            padding: 12px;
          }
          .chat-bubble {
            max-width: 90%;
          }
          .bubble-content {
            font-size: 13px;
            padding: 10px 12px;
          }
          .chat-input-area {
            padding: 10px 12px;
          }
          .conv-sidebar .assess-form {
            padding: 16px;
          }
          .result-card {
            padding: 16px;
          }
        }
      }

        .mode-toggle {
          display: flex;
          gap: 4px;
          background: white;
          border-radius: var(--radius-lg);
          padding: 4px;
          box-shadow: var(--shadow-soft);
          margin-bottom: 24px;
          width: fit-content;
        }
        .mode-tab {
          padding: 10px 24px;
          border: none;
          border-radius: var(--radius-md);
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          background: transparent;
          color: var(--text-secondary);
          transition: all 0.2s;
        }
        .mode-tab.active {
          background: linear-gradient(135deg, #FF8C42, #6B5B95);
          color: white;
        }

        .conv-layout {
          display: grid;
          grid-template-columns: 300px 1fr;
          gap: 24px;
          align-items: start;
        }
        .conv-sidebar .assess-form {
          background: white;
          border-radius: var(--radius-lg);
          padding: 24px;
          box-shadow: var(--shadow-soft);
        }
        .conv-progress {
          margin-top: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          font-size: 13px;
          color: var(--text-secondary);
        }
        .btn-end {
          padding: 10px 16px;
          border: none;
          border-radius: var(--radius-md);
          background: linear-gradient(135deg, #FF8C42, #FF6B6B);
          color: white;
          font-weight: 600;
          cursor: pointer;
          font-size: 14px;
        }
        .btn-end:disabled { opacity: 0.6; cursor: not-allowed; }

        .conv-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          color: var(--text-light);
        }
        .conv-empty-icon { font-size: 48px; margin-bottom: 16px; }
        .conv-empty-hint { font-size: 13px; color: var(--text-light); }

        .conv-chat {
          background: white;
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-soft);
          display: flex;
          flex-direction: column;
          height: 600px;
        }
        .chat-header {
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: 600;
          font-size: 14px;
        }
        .chat-round {
          font-size: 12px;
          color: var(--text-light);
          background: var(--bg-warm);
          padding: 4px 10px;
          border-radius: 12px;
        }
        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .chat-bubble {
          display: flex;
          gap: 10px;
          max-width: 80%;
        }
        .child-bubble {
          align-self: flex-end;
          flex-direction: row-reverse;
        }
        .bubble-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          flex-shrink: 0;
        }
        .peer-bubble .bubble-avatar { background: #EDE7F6; }
        .child-bubble .bubble-avatar { background: #FFF3E0; }
        .bubble-content {
          padding: 12px 16px;
          border-radius: 16px;
          font-size: 14px;
          line-height: 1.6;
        }
        .peer-bubble .bubble-content {
          background: #F3E5F5;
          color: #4A148C;
          border-bottom-left-radius: 4px;
        }
        .child-bubble .bubble-content {
          background: #FFF3E0;
          color: #E65100;
          border-bottom-right-radius: 4px;
        }
        .typing {
          color: var(--text-light) !important;
          font-style: italic;
          background: #F5F5F5 !important;
        }
        .chat-input-area {
          padding: 16px 20px;
          border-top: 1px solid var(--border);
          display: flex;
          gap: 10px;
        }
        .chat-input {
          flex: 1;
          padding: 10px 16px;
          border: 1px solid var(--border);
          border-radius: 20px;
          font-size: 14px;
          outline: none;
        }
        .chat-input:focus { border-color: #FF8C42; }
        .chat-send-btn {
          padding: 10px 20px;
          border: none;
          border-radius: 20px;
          background: linear-gradient(135deg, #FF8C42, #6B5B95);
          color: white;
          font-weight: 600;
          cursor: pointer;
          font-size: 14px;
        }
        .chat-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .chat-input-row {
          display: flex;
          gap: 10px;
        }
        .chat-voice-row {
          padding-top: 8px;
          border-top: 1px solid var(--border);
          margin-top: 8px;
        }
        .chat-assessing {
          padding: 20px;
          text-align: center;
          color: var(--text-secondary);
          font-size: 14px;
          border-top: 1px solid var(--border);
        }

        .conv-result {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
      `}</style>
    </div>
  );
};

export default AssessPage;
