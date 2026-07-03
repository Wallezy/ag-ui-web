import type { ReactNode } from 'react';

export function ChatShell({
  sidebar,
  main,
  inspector,
}: {
  sidebar: ReactNode;
  main: ReactNode;
  inspector: ReactNode;
}) {
  return (
    <div className="chat-shell">
      {sidebar}
      <main className="chat-main">{main}</main>
      {inspector}
    </div>
  );
}
