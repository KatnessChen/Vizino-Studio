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
  return (
    <Button
      onClick={onClick}
      style={style}
      className={`
        bg-indigo-600/90 border-none text-white rounded px-2 py-1 
        cursor-pointer flex items-center gap-1 text-xs font-medium 
        transition-all duration-300 ease-in-out
        ${className}
      `}
    >
      {icon && <span className="flex items-center">{icon}</span>}
      {children}
    </Button>
  );
};

export default MyButton;
