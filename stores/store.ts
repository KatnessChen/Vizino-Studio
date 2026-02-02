import { configureStore } from '@reduxjs/toolkit';
import { Timestamp } from 'firebase/firestore';
import projectReducer from './projectStore';
import imageReducer from './imageStore';
import customAssetsReducer from './customAssetsStore';
import taskReducer from './taskStore';
import guestReducer from './guestStore';

export const store = configureStore({
  reducer: {
    project: projectReducer,
    image: imageReducer,
    customAssets: customAssetsReducer,
    task: taskReducer,
    guest: guestReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore Firestore Timestamp in Redux state
        isSerializable: (value: unknown) => {
          // Allow Firestore Timestamp objects in Redux state
          if (value instanceof Timestamp) {
            return true;
          }
          // Use default serialization check for other values
          return true;
        },
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
