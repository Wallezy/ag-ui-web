import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeLlmMarkdown } from '../src/components/assistant-ui/markdown-preprocess.ts'

test('repairs whitespace before LLM-generated strong closing markers', () => {
  const markdown = [
    '- **任务： **18 小时，9 条',
    '- **缺陷： **1 小时，1 条',
    '- **李文卓测试项目： **18 小时',
    '工时主要集中在 **7 月 14 日（10 小时） **和 **7 月 15 日（6 小时）**。',
  ].join('\n')

  assert.equal(
    normalizeLlmMarkdown(markdown),
    [
      '- **任务：** 18 小时，9 条',
      '- **缺陷：** 1 小时，1 条',
      '- **李文卓测试项目：** 18 小时',
      '工时主要集中在 **7 月 14 日（10 小时）** 和 **7 月 15 日（6 小时）**。',
    ].join('\n')
  )
})

test('leaves valid strong emphasis unchanged', () => {
  const markdown = '**任务：** 18 小时，**缺陷：** 1 小时'
  assert.equal(normalizeLlmMarkdown(markdown), markdown)
})

test('repairs malformed emphasis without changing adjacent valid emphasis', () => {
  const markdown = '**有效内容** 后面是 **任务： **18 小时'
  assert.equal(
    normalizeLlmMarkdown(markdown),
    '**有效内容** 后面是 **任务：** 18 小时'
  )
})

test('does not rewrite inline or fenced code', () => {
  const markdown = [
    '示例：`**任务： **18 小时`',
    '```markdown',
    '- **任务： **18 小时',
    '```',
    '正文：**任务： **18 小时',
  ].join('\n')

  assert.equal(
    normalizeLlmMarkdown(markdown),
    [
      '示例：`**任务： **18 小时`',
      '```markdown',
      '- **任务： **18 小时',
      '```',
      '正文：**任务：** 18 小时',
    ].join('\n')
  )
})

test('keeps escaped and incomplete delimiters intact while streaming', () => {
  const markdown = '\\**不是加粗： **，**尚未结束，`**行内代码： **'
  assert.equal(normalizeLlmMarkdown(markdown), markdown)
})

test('does not close a fenced block when fence characters have content', () => {
  const markdown = [
    '```markdown',
    '```仍是代码内容',
    '**任务： **18 小时',
    '```',
    '**任务： **18 小时',
  ].join('\n')

  assert.equal(
    normalizeLlmMarkdown(markdown),
    [
      '```markdown',
      '```仍是代码内容',
      '**任务： **18 小时',
      '```',
      '**任务：** 18 小时',
    ].join('\n')
  )
})
