import { OrderPage } from './pages/OrderPage';
import { OrdersPage } from './pages/OrdersPage';
import { PrintPage } from './pages/PrintPage';
import { SettingsPage } from './pages/SettingsPage';
import { WindowPage } from './pages/WindowPage';
import { UpdateBanner } from './pwa';
import { ToastHost, useRoute } from './ui';

export function App() {
  const route = useRoute();
  const section = route.page === 'settings' ? 'settings' : 'orders';

  if (route.page === 'print') {
    return (
      <>
        <PrintPage key={route.id + route.doc + (route.windowId ?? '')} id={route.id} doc={route.doc} windowId={route.windowId} />
        <ToastHost />
      </>
    );
  }

  return (
    <div className="app">
      {route.page === 'orders' && <OrdersPage />}
      {route.page === 'order' && <OrderPage key={route.id} id={route.id} />}
      {route.page === 'window' && <WindowPage key={route.windowId} id={route.id} windowId={route.windowId} tab={route.tab} />}
      {route.page === 'settings' && <SettingsPage />}
      <UpdateBanner />
      {route.page !== 'window' && (
      <nav className="bottomnav" aria-label="Разделы">
        <a href="#/" className={section === 'orders' ? 'active' : ''}>
          <span className="ico">📋</span>
          Заказы
        </a>
        <a href="#/settings" className={section === 'settings' ? 'active' : ''}>
          <span className="ico">⚙️</span>
          Настройки
        </a>
      </nav>
      )}
      <ToastHost />
    </div>
  );
}
