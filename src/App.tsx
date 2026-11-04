import { OrderPage } from './pages/OrderPage';
import { OrdersPage } from './pages/OrdersPage';
import { SettingsPage } from './pages/SettingsPage';
import { WindowPage } from './pages/WindowPage';
import { UpdateBanner } from './pwa';
import { ToastHost, useRoute } from './ui';

export function App() {
  const route = useRoute();
  const section = route.page === 'settings' ? 'settings' : 'orders';

  return (
    <div className="app">
      {route.page === 'orders' && <OrdersPage />}
      {route.page === 'order' && <OrderPage key={route.id} id={route.id} />}
      {route.page === 'window' && <WindowPage key={route.windowId} id={route.id} windowId={route.windowId} />}
      {route.page === 'settings' && <SettingsPage />}
      <UpdateBanner />
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
      <ToastHost />
    </div>
  );
}
