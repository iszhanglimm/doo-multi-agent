import React, { useState, useRef, useCallback } from 'react';

interface VoiceInputProps {
  onTranscript: (text: string, isFinal: boolean) => void;
}

const VoiceInput: React.FC<VoiceInputProps> = ({ onTranscript }) => {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const lastResultTimeRef = useRef<number>(0);
  const lastTextRef = useRef<string>('');

  const addPunctuation = (text: string, timeSinceLast: number): string => {
    if (!text) return text;
    let result = text.trim();

    // 停顿超过1.5秒，加逗号
    if (timeSinceLast > 1500 && result.length > 0 && !/[，。！？、；：]$/.test(result)) {
      result += '，';
    }

    // 疑问词加问号
    const questionWords = ['吗', '呢', '什么', '怎么', '为什么', '哪里', '谁', '几', '多少', '是不是', '对不对', '好不好', '能不能', '会不会'];
    for (const w of questionWords) {
      if (result.endsWith(w) && !/[？。！]$/.test(result)) {
        result = result.replace(/，$/, '') + '？';
        break;
      }
    }

    return result;
  };

  const startListening = useCallback(() => {
    setError(null);

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setError('您的浏览器不支持语音识别，请使用Chrome或Edge浏览器');
      return;
    }

    const recognition = new SR();

    recognition.lang = 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
      lastResultTimeRef.current = Date.now();
      lastTextRef.current = '';
    };

    recognition.onresult = (event: any) => {
      const now = Date.now();
      const timeSinceLast = now - lastResultTimeRef.current;
      lastResultTimeRef.current = now;

      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // 实时显示识别中的文字
      if (interimTranscript) {
        onTranscript(interimTranscript, false);
      }

      // 最终确认的文字，加标点后写入
      if (finalTranscript) {
        const punctuated = addPunctuation(finalTranscript, timeSinceLast);
        lastTextRef.current += punctuated;
        onTranscript(punctuated, true);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('语音识别错误:', event.error);
      setError('语音识别出错，请重试');
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      // 停止录音时，如果最后一段文字没有标点，加句号
      if (lastTextRef.current && !/[。！？]$/.test(lastTextRef.current)) {
        onTranscript('。', true);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [onTranscript]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    onTranscript('', true);
  }, [onTranscript]);

  return (
    <div className="voice-input">
      <button
        type="button"
        className={`voice-btn ${isListening ? 'listening' : ''}`}
        onClick={isListening ? stopListening : startListening}
        title={isListening ? '停止录音' : '语音输入'}
      >
        {isListening ? '🔴' : '🎤'}
        <span>{isListening ? '录音中...' : '语音输入'}</span>
      </button>

      {isListening && (
        <div className="voice-wave">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </div>
      )}

      {error && <span className="voice-error">{error}</span>}

      <style>{`
        .voice-input {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .voice-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: white;
          border: 2px solid var(--border);
          border-radius: var(--radius-md);
          cursor: pointer;
          font-size: 14px;
          color: var(--text-secondary);
          transition: all 0.3s ease;
          font-family: inherit;
        }

        .voice-btn:hover {
          border-color: var(--primary);
          color: var(--primary);
        }

        .voice-btn.listening {
          border-color: #FF6B6B;
          color: #FF6B6B;
          animation: pulse 1.5s ease-in-out infinite;
        }

        .voice-wave {
          display: flex;
          align-items: center;
          gap: 3px;
          height: 24px;
        }

        .voice-wave span {
          width: 3px;
          background: #FF6B6B;
          border-radius: 2px;
          animation: wave 1s ease-in-out infinite;
        }

        .voice-wave span:nth-child(1) { height: 8px; animation-delay: 0s; }
        .voice-wave span:nth-child(2) { height: 16px; animation-delay: 0.1s; }
        .voice-wave span:nth-child(3) { height: 24px; animation-delay: 0.2s; }
        .voice-wave span:nth-child(4) { height: 16px; animation-delay: 0.3s; }
        .voice-wave span:nth-child(5) { height: 8px; animation-delay: 0.4s; }

        @keyframes wave {
          0%, 100% { transform: scaleY(0.5); }
          50% { transform: scaleY(1); }
        }

        .voice-error {
          font-size: 12px;
          color: #FF6B6B;
        }
      `}</style>
    </div>
  );
};

export default VoiceInput;
