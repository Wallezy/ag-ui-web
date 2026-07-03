import { Sender } from '@ant-design/x';
import { Button, Space, Tooltip, Typography } from 'antd';
import { FileText, ImageUp, Mic, Paperclip, Plus, Square, WandSparkles } from 'lucide-react';

const { Text } = Typography;

export function SenderBar({
  value,
  loading,
  onChange,
  onSubmit,
  onCancel,
  onQuickSubmit,
}: {
  value: string;
  loading: boolean;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onCancel: () => void;
  onQuickSubmit: (value: string) => void;
}) {
  const quickCommands = [
    { label: '#日报生成', value: '生成日报', className: 'quick-command-cyan' },
    { label: '#知识库问答', value: '根据公司制度，差旅报销审批流程是什么？', className: 'quick-command-blue' },
    { label: '#数据分析', value: '分析一下本周销售数据，告诉我增长点和风险。', className: 'quick-command-purple' },
    { label: '#审批协作', value: '帮我创建一个采购单，金额 12 万，需要主管审批。', className: 'quick-command-orange' },
  ];

  return (
    <div className="sender-wrap">
      <div className="quick-row">
        <Space size={8} wrap>
          {quickCommands.map((command) => (
            <Button
              key={command.label}
              size="small"
              type="text"
              className={`quick-command ${command.className}`}
              disabled={loading}
              onClick={() => onQuickSubmit(command.value)}
            >
              {command.label}
            </Button>
          ))}
        </Space>
        <Space size={4}>
          <Tooltip title="上传附件">
            <Button size="small" icon={<Paperclip size={15} />} />
          </Tooltip>
          <Tooltip title="上传图片">
            <Button size="small" icon={<ImageUp size={15} />} />
          </Tooltip>
          <Tooltip title="语音输入">
            <Button size="small" icon={<Mic size={15} />} />
          </Tooltip>
        </Space>
      </div>
      <div className="attachment-strip" aria-label="附件列表">
        <div className="attachment-chip">
          <FileText size={15} />
          <div>
            <Text strong>采购合同.pdf</Text>
            <div>
              <Text type="secondary">Demo 附件</Text>
            </div>
          </div>
        </div>
        <Button className="attachment-add" icon={<Plus size={18} />} />
      </div>
      <Sender
        value={value}
        loading={loading}
        placeholder="输入任务，例如：帮我生成今天日报，或分析本周销售风险"
        onChange={onChange}
        onSubmit={(message) => onSubmit(message)}
        onCancel={onCancel}
        autoSize={{ minRows: 2, maxRows: 5 }}
        submitType="enter"
        prefix={<WandSparkles size={16} />}
        suffix={
          loading ? (
            <Button size="small" danger icon={<Square size={14} />} onClick={onCancel}>
              停止
            </Button>
          ) : null
        }
      />
    </div>
  );
}
