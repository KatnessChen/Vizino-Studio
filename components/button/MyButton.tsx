import React, { ReactNode } from 'react';
import { Button } from 'antd';

interface MyButtonProps {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
  icon?: ReactNode;
  style?: React.CSSProperties;
  className?: string;
  hoverable?: boolean;
}

const MyButton: React.FC<MyButtonProps> = ({
  onClick,
  children,
  icon,
  style = {},
  className = '',
}) => {
  const defaultStyle: React.CSSProperties = {
    background: 'rgba(99, 102, 241, 0.9)',
    border: 'none',
    color: 'white',
    borderRadius: '4px',
    padding: '4px 8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.75rem',
    fontWeight: 500,
    transition: 'all 0.3s ease',
    ...style,
  };

  return (
    <Button onClick={onClick} style={defaultStyle} className={className}>
      {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
      {children}
    </Button>
  );
};

export default MyButton;
