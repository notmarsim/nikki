import {
  BarChart3,
  Bookmark,
  Calendar,
  CheckSquare,
  Code2,
  FileText,
  Flame,
  FolderKanban,
  GraduationCap,
  Inbox,
  Layers,
  LayoutDashboard,
  Network,
  Search,
  Settings,
  Timer,
  Wallet,
  type LucideProps,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
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
