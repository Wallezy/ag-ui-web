import { CloudSun, FolderKanban } from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'Agent Platform',
    email: 'platform@example.com',
    avatar: '/avatars/shadcn.jpg',
  },
  teams: [],
  navGroups: [
    {
      title: 'AI',
      items: [
        {
          title: '天气智能体',
          url: '/agents/weather',
          icon: CloudSun,
        },
        {
          title: '项目管理智能体',
          url: '/agents/project-manager',
          icon: FolderKanban,
        },
      ],
    },
  ],
}
