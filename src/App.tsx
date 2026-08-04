import { RouterProvider } from 'react-router-dom';
import { router } from '@/kernel/router';
import { QuotationCartProvider } from '@/modules/quotations/presentation/context/QuotationCartContext';
import { NotificationProvider } from '@/modules/notifications/presentation/context/NotificationContext';
import { ChatDrawerProvider } from '@/modules/messages/presentation/context/ChatDrawerContext';
import { OrganizationRealtimeProvider } from '@/modules/organizations/presentation/context/OrganizationRealtimeContext';

export default function App() {
  return (
    <OrganizationRealtimeProvider>
      <NotificationProvider>
        <ChatDrawerProvider>
          <QuotationCartProvider>
            <RouterProvider router={router} />
          </QuotationCartProvider>
        </ChatDrawerProvider>
      </NotificationProvider>
    </OrganizationRealtimeProvider>
  );
}