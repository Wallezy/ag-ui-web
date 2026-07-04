import { useEffect } from 'react';
import { Alert, Form, Input, Modal, Space, Typography } from 'antd';
import { KeyRound, LogIn } from 'lucide-react';
import type { OaAuthContext, OaSessionStatus } from '../../oa/oaAuthClient';

const { Text } = Typography;

export type OaLoginValues = {
  username: string;
  password: string;
  verifyCode?: string;
};

export function OaLoginModal({
  open,
  loading,
  authContext,
  session,
  message,
  onCancel,
  onLogin,
}: {
  open: boolean;
  loading: boolean;
  authContext?: OaAuthContext;
  session?: OaSessionStatus | null;
  message?: string;
  onCancel: () => void;
  onLogin: (values: OaLoginValues) => Promise<void>;
}) {
  const [form] = Form.useForm<OaLoginValues>();

  useEffect(() => {
    if (!open) {
      form.resetFields();
    }
  }, [form, open]);

  return (
    <Modal
      title={
        <Space size={8}>
          <KeyRound size={18} />
          OA 登录
        </Space>
      }
      open={open}
      centered
      width={430}
      okText="登录并继续"
      cancelText="取消"
      okButtonProps={{ icon: <LogIn size={15} /> }}
      confirmLoading={loading}
      onCancel={onCancel}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <Space direction="vertical" size={12} className="oa-login-modal">
        <Alert
          type={session?.errorCode ? 'warning' : 'info'}
          showIcon
          message={session?.message || message || '当前会话需要 OA 令牌'}
        />
        <Form form={form} layout="vertical" requiredMark={false} onFinish={onLogin}>
          <Form.Item
            label="OA 账号"
            name="username"
            rules={[{ required: true, message: '请输入 OA 账号' }]}
          >
            <Input autoComplete="username" placeholder="请输入 OA 账号" />
          </Form.Item>
          <Form.Item
            label="OA 密码"
            name="password"
            rules={[{ required: true, message: '请输入 OA 密码' }]}
          >
            <Input.Password autoComplete="current-password" placeholder="请输入 OA 密码" />
          </Form.Item>
          <Form.Item label="验证码" name="verifyCode">
            <Input autoComplete="one-time-code" placeholder="如 OA 返回验证码要求再填写" />
          </Form.Item>
        </Form>
        {authContext ? (
          <Text type="secondary" className="oa-login-session">
            会话：{authContext.sessionId ?? '浏览器会话'}
          </Text>
        ) : null}
      </Space>
    </Modal>
  );
}
