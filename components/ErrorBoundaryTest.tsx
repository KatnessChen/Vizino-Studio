import React, { useState } from 'react';
import { Button, Space } from 'antd';
import { BugOutlined } from '@ant-design/icons';
import ErrorBoundary from './ErrorBoundary';

/**
 * Test component to demonstrate error boundary functionality
 * This component is for development/testing purposes only
 */

// Component that throws an error when clicked
const BuggyComponent: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('💥 這是一個測試錯誤！Error Boundary 應該會捕獲這個錯誤。');
  }
  return <div className="p-4 bg-green-50 border border-green-200 rounded">✅ 元件正常運作中</div>;
};

// Component that throws an async error
const AsyncBuggyComponent: React.FC = () => {
  const [error, setError] = useState<Error | null>(null);

  const triggerAsyncError = () => {
    setTimeout(() => {
      setError(new Error('⏰ 這是一個非同步錯誤！需要使用 useErrorHandler 來處理。'));
    }, 1000);
  };

  if (error) {
    throw error;
  }

  return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded">
      <p className="mb-2">非同步錯誤測試</p>
      <Button onClick={triggerAsyncError} icon={<BugOutlined />}>
        觸發非同步錯誤 (1秒後)
      </Button>
    </div>
  );
};

/**
 * Error Boundary Test Page
 * Demonstrates different error boundary levels and behaviors
 */
const ErrorBoundaryTest: React.FC = () => {
  const [showBuggyComponent, setShowBuggyComponent] = useState(false);
  const [showAsyncBuggy, setShowAsyncBuggy] = useState(false);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Error Boundary 測試頁面</h1>
      <p className="text-gray-600 mb-8">
        此頁面用於測試不同層級的 Error Boundary 功能
      </p>

      <Space direction="vertical" size="large" className="w-full">
        {/* Test 1: Component Level Error Boundary */}
        <div className="border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">
            測試 1: Component Level Error Boundary
          </h2>
          <p className="text-gray-600 mb-4">
            這個測試展示元件層級的錯誤邊界。當元件出錯時，只有該元件會顯示錯誤，不影響其他部分。
          </p>
          
          <ErrorBoundary level="component">
            <div className="mb-4">
              <Button
                type="primary"
                danger={showBuggyComponent}
                onClick={() => setShowBuggyComponent(!showBuggyComponent)}
                icon={<BugOutlined />}
              >
                {showBuggyComponent ? '隱藏錯誤元件' : '顯示錯誤元件'}
              </Button>
            </div>
            {showBuggyComponent && <BuggyComponent shouldThrow={true} />}
          </ErrorBoundary>

          <div className="mt-4 p-4 bg-gray-50 rounded">
            <p className="text-sm text-gray-600">
              ℹ️ 這段文字在 Error Boundary 外部，即使上方元件出錯也不會受影響
            </p>
          </div>
        </div>

        {/* Test 2: Async Error */}
        <div className="border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">
            測試 2: 非同步錯誤處理
          </h2>
          <p className="text-gray-600 mb-4">
            這個測試展示如何處理非同步錯誤。點擊按鈕後，1秒後會觸發錯誤。
          </p>
          
          <ErrorBoundary level="component">
            {showAsyncBuggy && <AsyncBuggyComponent />}
            {!showAsyncBuggy && (
              <Button
                type="primary"
                onClick={() => setShowAsyncBuggy(true)}
                icon={<BugOutlined />}
              >
                啟動非同步錯誤測試
              </Button>
            )}
          </ErrorBoundary>
        </div>

        {/* Test 3: Multiple Components */}
        <div className="border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">
            測試 3: 多個獨立的 Error Boundary
          </h2>
          <p className="text-gray-600 mb-4">
            這個測試展示多個獨立的錯誤邊界。每個元件都有自己的錯誤邊界，互不影響。
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            <ErrorBoundary level="component">
              <div className="p-4 bg-green-50 border border-green-200 rounded">
                <h3 className="font-semibold mb-2">元件 A (正常)</h3>
                <BuggyComponent shouldThrow={false} />
              </div>
            </ErrorBoundary>

            <ErrorBoundary level="component">
              <div className="p-4 bg-red-50 border border-red-200 rounded">
                <h3 className="font-semibold mb-2">元件 B (有錯誤)</h3>
                <BuggyComponent shouldThrow={true} />
              </div>
            </ErrorBoundary>
          </div>
        </div>

        {/* Information */}
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-2">📚 使用說明</h3>
          <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
            <li>開發模式下會顯示詳細的錯誤訊息和堆疊追蹤</li>
            <li>生產模式下只會顯示使用者友善的錯誤訊息</li>
            <li>每個 Error Boundary 都提供「重試」按鈕來恢復元件</li>
            <li>不同層級的 Error Boundary 提供不同的恢復選項</li>
            <li>查看 <code className="bg-white px-2 py-1 rounded">/docs/ERROR_BOUNDARY.md</code> 了解更多資訊</li>
          </ul>
        </div>
      </Space>
    </div>
  );
};

export default ErrorBoundaryTest;
