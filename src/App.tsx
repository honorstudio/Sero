import React from 'react';
import './App.css';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import AuthForm from './AuthForm';
import ChatPage from './pages/ChatPage';
import PersonaSelectionPage from './pages/PersonaSelectionPage';
import AdminGlobalSettingsPage from './pages/AdminGlobalSettingsPage';

function App() {
  const { user, loading } = useAuth();

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
        로딩 중...
      </div>
    );
  }

  return (
    <div className="App">
      <Routes>
        {/* 인증되지 않은 사용자는 로그인 페이지 */}
        <Route 
          path="/" 
          element={
            user 
              ? <Navigate to="/personas" replace /> 
              : <AuthForm onAuthSuccess={() => window.location.reload()} />
          } 
        />
        
        {/* 채팅 페이지 */}
        <Route 
          path="/chat" 
          element={user ? <ChatPage user={user} /> : <Navigate to="/" replace />} 
        />
        
        {/* 페르소나별 채팅 페이지 */}
        <Route 
          path="/chat/:personaId" 
          element={user ? <ChatPage user={user} /> : <Navigate to="/" replace />} 
        />
        
        {/* 페르소나 선택 페이지 */}
        <Route 
          path="/personas" 
          element={user ? <PersonaSelectionPage user={user} /> : <Navigate to="/" replace />} 
        />
        
        {/* 어드민 글로벌 설정 페이지 */}
        <Route 
          path="/admin/global-settings" 
          element={user ? <AdminGlobalSettingsPage user={user} /> : <Navigate to="/" replace />} 
        />
        
        {/* 기본 리다이렉트 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;