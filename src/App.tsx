import { RouterProvider } from 'react-router-dom';
import { router } from '@/kernel/router';
import { QuotationCartProvider } from '@/modules/quotations/presentation/context/QuotationCartContext';
import { NotificationProvider } from '@/modules/notifications/presentation/context/NotificationContext';
import { ChatDrawerProvider } from '@/modules/messages/presentation/context/ChatDrawerContext';

export default function App() {
  return (
    <NotificationProvider>
      <ChatDrawerProvider>
        <QuotationCartProvider>
          <RouterProvider router={router} />
        </QuotationCartProvider>
      </ChatDrawerProvider>
    </NotificationProvider>
  );
}