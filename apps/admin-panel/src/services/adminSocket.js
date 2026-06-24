import { io } from 'socket.io-client';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const SOCKET_URL = API_BASE.replace(/\/api$/, '');

let adminSocket = null;
const listeners = new Set();

export const initAdminSocket = () => {
  if (adminSocket) return adminSocket;

  const token = localStorage.getItem('admin_token');
  if (!token) return null;

  adminSocket = io(`${SOCKET_URL}/admin`, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  adminSocket.on('connect', () => {
    console.log('Admin Socket Connected');
  });

  adminSocket.on('disconnect', () => {
    console.log('Admin Socket Disconnected');
  });

  adminSocket.on('MARKET:TICK', (tick) => {
    listeners.forEach((callback) => callback(tick));
  });

  return adminSocket;
};

export const subscribeToTickers = (symbols) => {
  if (adminSocket && adminSocket.connected) {
    adminSocket.emit('ADMIN:SUBSCRIBE_TICKERS', symbols);
  } else if (adminSocket) {
    adminSocket.once('connect', () => {
      adminSocket.emit('ADMIN:SUBSCRIBE_TICKERS', symbols);
    });
  }
};

export const unsubscribeFromTickers = (symbols) => {
  if (adminSocket && adminSocket.connected) {
    adminSocket.emit('ADMIN:UNSUBSCRIBE_TICKERS', symbols);
  }
};

export const onMarketTick = (callback) => {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
};

export const disconnectAdminSocket = () => {
  if (adminSocket) {
    adminSocket.disconnect();
    adminSocket = null;
    listeners.clear();
  }
};
