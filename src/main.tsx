import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { XProvider } from '@ant-design/x';
import App from './App';
import 'antd/dist/reset.css';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#247C73',
          colorInfo: '#2F6F9F',
          colorSuccess: '#3E8F55',
          colorWarning: '#B56A18',
          colorError: '#B83A3A',
          borderRadius: 6,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
        },
      }}
    >
      <XProvider>
        <AntApp>
          <App />
        </AntApp>
      </XProvider>
    </ConfigProvider>
  </React.StrictMode>,
);
