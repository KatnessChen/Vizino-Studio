import React from 'react';

interface AlertModalProps {
  isOpen: boolean;
  type: 'error' | 'success' | 'info' | 'warning';
  title: string;
  message: string;
  onClose: () => void;
}

const AlertModal: React.FC<AlertModalProps> = ({ isOpen, type, title, message, onClose }) => {
  if (!isOpen) return null;

  const typeStyles = {
    error: {
      bgColor: 'bg-red-50',
      borderColor: 'border-red-300',
      titleColor: 'text-red-900',
      messageColor: 'text-red-700',
      buttonColor: 'bg-red-600 hover:bg-red-700',
      iconColor: 'text-red-600',
    },
    success: {
      bgColor: 'bg-green-50',
      borderColor: 'border-green-300',
      titleColor: 'text-green-900',
      messageColor: 'text-green-700',
      buttonColor: 'bg-green-600 hover:bg-green-700',
      iconColor: 'text-green-600',
    },
    info: {
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-300',
      titleColor: 'text-blue-900',
      messageColor: 'text-blue-700',
      buttonColor: 'bg-blue-600 hover:bg-blue-700',
      iconColor: 'text-blue-600',
    },
    warning: {
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-300',
      titleColor: 'text-yellow-900',
      messageColor: 'text-yellow-700',
      buttonColor: 'bg-yellow-600 hover:bg-yellow-700',
      iconColor: 'text-yellow-600',
    },
  };

  const styles = typeStyles[type];

  const renderIcon = () => {
    switch (type) {
      case 'error':
        return (
          <svg
            className={`w-6 h-6 ${styles.iconColor}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        );
      case 'success':
        return (
          <svg
            className={`w-6 h-6 ${styles.iconColor}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'warning':
        return (
          <svg
            className={`w-6 h-6 ${styles.iconColor}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case 'info':
      default:
        return (
          <svg
            className={`w-6 h-6 ${styles.iconColor}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        className={`${styles.bgColor} border-2 ${styles.borderColor} rounded-lg shadow-xl max-w-md w-full mx-4`}
      >
        <div className="p-6">
          <div className="flex items-center mb-4">
            <div className="flex-shrink-0">{renderIcon()}</div>
            <h3 className={`ml-3 text-lg font-bold ${styles.titleColor}`}>{title}</h3>
          </div>

          <p className={`${styles.messageColor} text-sm leading-relaxed`}>{message}</p>

          <div className="mt-6">
            <button
              onClick={onClose}
              className={`w-full ${styles.buttonColor} text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200`}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertModal;
