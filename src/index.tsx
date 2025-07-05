import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AdminGlobalSettingsPage from './pages/AdminGlobalSettingsPage';

// window.user 타입 선언
declare global {
  interface Window {
    user: any;
  }
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

function AppWithUser() {
  const [user, setUser] = React.useState<any>(null);
  React.useEffect(() => {
    // 로그인 성공 시 App에서 setUser를 호출하도록 구현되어 있다고 가정
    // 또는 localStorage/session 등에서 user를 불러올 수도 있음
    // 실제로는 Context/recoil 등으로 관리하는 것이 더 안전함
    // 여기서는 임시로 window.user를 사용
    if (window.user) setUser(window.user);
  }, []);
  return <App />;
}

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppWithUser />} />
        <Route path="/admin/global-settings" element={<AdminGlobalSettingsPage user={null} />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

reportWebVitals();
