import React, { useEffect, useState } from 'react';
import { Typography, Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';

const { Title, Text } = Typography;

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    // Countdown timer
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Auto-redirect after 3 seconds
    const redirectTimer = setTimeout(() => {
      navigate(ROUTES.HOME);
    }, 3000);

    return () => {
      clearInterval(countdownInterval);
      clearTimeout(redirectTimer);
    };
  }, [navigate]);

  return (
    <div 
      className="flex flex-col items-center justify-center"
      style={{
        minHeight: 'calc(100vh - var(--header-height))',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #6B8DD6 100%)',
      }}
    >
      {/* Glassmorphism Card */}
      <div 
        className="text-center px-12 py-16 rounded-3xl"
        style={{
          background: 'rgba(255, 255, 255, 0.15)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
        }}
      >
        {/* Large 404 Number */}
        <div 
          className="text-9xl font-bold mb-4"
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.7) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
          }}
        >
          404
        </div>

        {/* Title */}
        <Title level={2} style={{ color: 'white', margin: '0 0 8px 0' }}>
          Page Not Found
        </Title>

        {/* Description */}
        <Text style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: '16px', display: 'block', marginBottom: '32px' }}>
          The page you're looking for doesn't exist or has been moved.
        </Text>

        {/* Redirect Message with Spinner */}
        <div 
          className="flex items-center justify-center gap-3 px-6 py-3 rounded-full mx-auto"
          style={{
            background: 'rgba(255, 255, 255, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            width: 'fit-content',
          }}
        >
          <Spin indicator={<LoadingOutlined style={{ fontSize: 18, color: 'white' }} spin />} />
          <Text style={{ color: 'white', fontWeight: 500 }}>
            Redirecting to home in {countdown}s...
          </Text>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;

