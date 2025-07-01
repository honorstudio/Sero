import React, { useState } from 'react';
import { auth } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';

interface AuthFormProps {
  onAuthSuccess: (user: any) => void;
}

const AuthForm: React.FC<AuthFormProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordCheck, setPasswordCheck] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateEmail = (email: string) => /.+@.+\..+/.test(email);
  const validatePassword = (pw: string) => pw.length >= 8;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validateEmail(email)) {
      setError('올바른 이메일 주소를 입력하세요.');
      return;
    }
    if (!validatePassword(password)) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    if (!isLogin && password !== passwordCheck) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    setLoading(true);
    try {
      let userCredential;
      if (isLogin) {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } else {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      }
      onAuthSuccess(userCredential.user);
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('이미 가입된 이메일입니다.');
      } else if (err.code === 'auth/invalid-email') {
        setError('올바른 이메일 주소를 입력하세요.');
      } else if (err.code === 'auth/weak-password') {
        setError('비밀번호가 너무 약합니다.');
      } else if (err.code === 'auth/wrong-password') {
        setError('비밀번호가 올바르지 않습니다.');
      } else if (err.code === 'auth/user-not-found') {
        setError('존재하지 않는 계정입니다.');
      } else {
        setError(err.message || '인증 오류');
      }
    }
    setLoading(false);
  };

  return (
    <div className="auth-form-container">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>{isLogin ? '로그인' : '회원가입'}</h2>
        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="비밀번호 (8자 이상)"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        {!isLogin && (
          <input
            type="password"
            placeholder="비밀번호 확인"
            value={passwordCheck}
            onChange={e => setPasswordCheck(e.target.value)}
            required
          />
        )}
        {error && <div className="auth-error">{error}</div>}
        <button type="submit" disabled={loading}>
          {loading ? '처리 중...' : isLogin ? '로그인' : '회원가입'}
        </button>
        <div className="auth-toggle">
          {isLogin ? (
            <span>계정이 없으신가요? <button type="button" onClick={() => setIsLogin(false)}>회원가입</button></span>
          ) : (
            <span>이미 계정이 있으신가요? <button type="button" onClick={() => setIsLogin(true)}>로그인</button></span>
          )}
        </div>
      </form>
    </div>
  );
};

export default AuthForm; 