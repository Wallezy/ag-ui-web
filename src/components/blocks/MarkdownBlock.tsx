import Markdown from 'markdown-to-jsx';

export function MarkdownBlock({ content }: { content: string }) {
  return (
    <div className="markdown-block">
      <Markdown>{content}</Markdown>
    </div>
  );
}
