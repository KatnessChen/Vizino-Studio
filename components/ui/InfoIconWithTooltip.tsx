import React from 'react';
import { Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';

interface InfoIconWithTooltipProps {
  title: string;
  size?: string;
  color?: string;
}

const InfoIconWithTooltip: React.FC<InfoIconWithTooltipProps> = ({
  title,
  size = '0.85em',
  color = '#8c8c8c',
}) => {
  return (
    <Tooltip title={title} color="white">
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'help',
        }}
      >
        <InfoCircleOutlined style={{ fontSize: size, color }} />
      </div>
    </Tooltip>
  );
};

export default InfoIconWithTooltip;
