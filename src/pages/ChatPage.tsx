import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ChatInterface from '../components/ChatInterface/ChatInterface';
import { personaService } from '../services/firebaseService';
import { Persona } from '../types';

interface ChatPageProps {
  user: any;
}

const ChatPage: React.FC<ChatPageProps> = ({ user }) => {
  const { personaId } = useParams<{ personaId: string }>();
  const navigate = useNavigate();
  const [persona, setPersona] = useState<Persona | null>(null);
  const [loading, setLoading] = useState(true);

  // 페르소나 정보 로드
  useEffect(() => {
    if (!user) return;

    const loadPersona = async () => {
      try {
        setLoading(true);
        
        if (personaId) {
          // 특정 페르소나와의 채팅
          const personaData = await personaService.getPersona(user.uid, personaId);
          if (personaData) {
            setPersona(personaData);
          } else {
            // 페르소나가 없으면 선택 페이지로 이동
            navigate('/personas');
            return;
          }
        } else {
          // 기본 채팅 (기존 "세로" 페르소나 사용)
          const personas = await personaService.getPersonas(user.uid);
          if (personas.length > 0) {
            // 첫 번째 페르소나 사용
            const defaultPersona = await personaService.getPersona(user.uid, personas[0].id);
            setPersona(defaultPersona);
          } else {
            // 페르소나가 없으면 선택 페이지로 이동
            navigate('/personas');
            return;
          }
        }
      } catch (error) {
        console.error('페르소나 로드 실패:', error);
        navigate('/personas');
      } finally {
        setLoading(false);
      }
    };

    loadPersona();
  }, [user, personaId, navigate]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px',
        color: '#666'
      }}>
        페르소나 정보를 불러오는 중...
      </div>
    );
  }

  if (!persona) {
    return null;
  }

  return (
    <div className="messenger-container">
      <ChatInterface user={user} persona={persona} />
    </div>
  );
};

export default ChatPage; 