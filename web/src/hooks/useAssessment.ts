import { useState, useCallback } from 'react';
import { api } from '../services/api';
import type { AgentMessage, DOOAssessment, NarrativeInput } from '../types';

export function useAssessment() {
  const [assessment, setAssessment] = useState<DOOAssessment | null>(null);
  const [interactions, setInteractions] = useState<AgentMessage[]>([]);
  const [reflections, setReflections] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assess = useCallback(async (input: NarrativeInput) => {
    setLoading(true);
    setError(null);
    try {
      // 调用后端API进行评估并保存画像
      const response = await api.assess(input);
      setAssessment(response.assessment);
      setInteractions(response.interactions || []);
      setReflections(response.reflections || []);
      return response.assessment;
    } catch (err) {
      const message = err instanceof Error ? err.message : '评估失败';
      setError(message);
      console.warn('API评估失败:', message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearAssessment = useCallback(() => {
    setAssessment(null);
    setInteractions([]);
    setReflections([]);
    setError(null);
  }, []);

  return { assessment, interactions, reflections, loading, error, assess, clearAssessment };
}
