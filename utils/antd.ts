import { App } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';
import type { NotificationInstance } from 'antd/es/notification/interface';
import type { HookAPI } from 'antd/es/modal/useModal';

let message: MessageInstance;
let notification: NotificationInstance;
let modal: HookAPI;

/**
 * This component should be rendered once inside the Ant Design App component
 * to initialize the static versions of message, notification, and modal.
 */
export const AntdStaticHelper = () => {
  const staticFunctions = App.useApp();
  message = staticFunctions.message;
  notification = staticFunctions.notification;
  modal = staticFunctions.modal;
  return null;
};

export { message, notification, modal };
