import { Outlet } from 'react-router-dom';
import { Toasts } from './Toasts';

export function RootLayout() {
  return (
    <>
      <Outlet />
      <Toasts />
    </>
  );
}
