# ag-ui-web

融卡智能体 PC Web 工作台，基于 React + TypeScript + Ant Design + Ant Design X，实现 AG-UI 事件流、A2UI 声明式 UI surface 和 Hybrid UI 消息块渲染。

## Scripts

```bash
npm install
npm run dev
npm run build
```

开发服务器默认代理 `/api` 到 `http://localhost:8080`，可对接后端 `POST /api/agent/ag-ui` SSE 接口。

## What Is Included

- 左侧 Ant Design X Conversations 会话栏。
- 主聊天区 Ant Design X Bubble.List + Hybrid block renderer。
- 底部 Ant Design X Sender + Attachments 输入区。
- 右侧运行时 Inspector：状态、工具调用、A2UI surface、共享 state、活动、审批、事件流。
- AG-UI event reducer：文本流、Reasoning、Tool、State、Activity、CUSTOM A2UI commands。
- A2UI catalog 白名单和 v0.9 command renderer。
- 8 个内置 AG-UI Demo：数据分析、代码审查、知识库问答、文档总结、人机审批、动态表单、多卡同步、错误恢复。
