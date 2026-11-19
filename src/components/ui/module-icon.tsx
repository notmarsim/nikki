import {
  Archive,
  BarChart3,
  BookOpen,
  Bookmark,
  Calendar,
  CheckSquare,
  Code2,
  FileLock2,
  FileText,
  Flame,
  FolderKanban,
  GraduationCap,
  Home,
  Inbox,
  Layers,
  LayoutDashboard,
  LayoutTemplate,
  Network,
  Radio,
  Rss,
  Search,
  Settings,
  Target,
  Timer,
  Users,
  Wallet,
  type LucideProps,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  Archive,
  LayoutDashboard,
  Inbox,
  FileText,
  CheckSquare,
  FolderKanban,
  Calendar,
  GraduationCap,
  Flame,
  Timer,
  Network,
  Bookmark,
  Code2,
  Search,
  Wallet,
  BarChart3,
  Settings,
  Layers,
  Users,
  Target,
  BookOpen,
  Home,
  FileLock2,
  Radio,
  Rss,
  LayoutTemplate,
};

export function ModuleIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = ICON_MAP[name] ?? Layers;
  return <Icon className={className} />;
}
