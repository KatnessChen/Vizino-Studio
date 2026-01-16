import React from 'react';
import { Tag } from 'antd';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-gray-200">
      <div className="mx-auto py-4 px-6">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <p>© {currentYear} Vizino Studio. All rights reserved.</p>
          <p className="font-semibold">
            <Tag>v.0.6.0</Tag>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
