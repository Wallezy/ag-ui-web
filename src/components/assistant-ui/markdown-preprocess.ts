const FENCE_START = /^ {0,3}(`{3,}|~{3,})/

export function normalizeLlmMarkdown(markdown: string) {
  const lines = markdown.split('\n')
  let fence: { marker: '`' | '~'; length: number } | null = null

  return lines
    .map((line) => {
      if (fence) {
        if (isClosingFence(line, fence)) fence = null
        return line
      }

      const fenceMatch = line.match(FENCE_START)
      const run = fenceMatch?.[1]
      if (run) {
        fence = { marker: run[0] as '`' | '~', length: run.length }
        return line
      }

      return normalizeInlineMarkdown(line)
    })
    .join('\n')
}

function normalizeInlineMarkdown(line: string) {
  let result = ''
  let proseStart = 0
  let index = 0

  while (index < line.length) {
    if (line[index] !== '`') {
      index += 1
      continue
    }

    const delimiterStart = index
    while (line[index] === '`') index += 1
    const delimiter = line.slice(delimiterStart, index)
    const delimiterEnd = line.indexOf(delimiter, index)
    if (delimiterEnd === -1) {
      result += normalizeStrongSpacing(line.slice(proseStart, delimiterStart))
      return result + line.slice(delimiterStart)
    }

    result += normalizeStrongSpacing(line.slice(proseStart, delimiterStart))
    result += line.slice(delimiterStart, delimiterEnd + delimiter.length)
    index = delimiterEnd + delimiter.length
    proseStart = index
  }

  return result + normalizeStrongSpacing(line.slice(proseStart))
}

function isClosingFence(
  line: string,
  fence: { marker: '`' | '~'; length: number }
) {
  const indentation = line.match(/^ */)?.[0].length ?? 0
  if (indentation > 3) return false

  const content = line.trim()
  return (
    content.length >= fence.length &&
    [...content].every((character) => character === fence.marker)
  )
}

function normalizeStrongSpacing(text: string) {
  let result = ''
  let strongContentStart: number | null = null

  for (let index = 0; index < text.length; index += 1) {
    if (!isStrongDelimiter(text, index)) {
      result += text[index]
      continue
    }

    if (strongContentStart === null) {
      result += '**'
      const nextCharacter = text[index + 2]
      if (nextCharacter && !isWhitespace(nextCharacter)) {
        strongContentStart = result.length
      }
      index += 1
      continue
    }

    const trailingWhitespace = result.match(/[ \t]+$/)?.[0] ?? ''
    const content = result.slice(strongContentStart)
    if (trailingWhitespace && content.trim().length > 0) {
      result = result.slice(0, -trailingWhitespace.length)
      result += `**${trailingWhitespace}`
    } else {
      result += '**'
    }
    strongContentStart = null
    index += 1
  }

  return result
}

function isStrongDelimiter(text: string, index: number) {
  if (text[index] !== '*' || text[index + 1] !== '*') return false
  if (text[index - 1] === '*' || text[index + 2] === '*') return false

  let backslashCount = 0
  for (let cursor = index - 1; text[cursor] === '\\'; cursor -= 1) {
    backslashCount += 1
  }
  return backslashCount % 2 === 0
}

function isWhitespace(character: string) {
  return /\s/.test(character)
}
