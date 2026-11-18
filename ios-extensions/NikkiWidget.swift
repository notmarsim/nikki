import WidgetKit
import SwiftUI

struct NikkiSnapshotEntry: TimelineEntry {
    let date: Date
    let workspaceName: String
    let openTasksCount: Int
    let activeHabitsCount: Int
}

struct NikkiWidgetProvider: TimelineProvider {
    private let appGroupId = "group.com.nikki.app"

    func placeholder(in context: Context) -> NikkiSnapshotEntry {
        NikkiSnapshotEntry(date: Date(), workspaceName: "Personal", openTasksCount: 3, activeHabitsCount: 2)
    }

    func getSnapshot(in context: Context, completion: @escaping (NikkiSnapshotEntry) -> Void) {
        completion(loadCachedEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NikkiSnapshotEntry>) -> Void) {
        let entry = loadCachedEntry()
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date()
        completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
    }

    private func loadCachedEntry() -> NikkiSnapshotEntry {
        let defaults = UserDefaults(suiteName: appGroupId)
        let workspace = defaults?.string(forKey: "nikki_workspace_name") ?? "Nikki"
        let tasks = defaults?.integer(forKey: "nikki_open_tasks") ?? 0
        let habits = defaults?.integer(forKey: "nikki_active_habits") ?? 0
        return NikkiSnapshotEntry(
            date: Date(),
            workspaceName: workspace,
            openTasksCount: tasks,
            activeHabitsCount: habits
        )
    }
}

struct NikkiWidgetEntryView: View {
    var entry: NikkiWidgetProvider.Entry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(entry.workspaceName)
                .font(.caption.bold())
                .foregroundStyle(.secondary)
            Text("\(entry.openTasksCount) open tasks")
                .font(.headline)
            Text("\(entry.activeHabitsCount) active habits")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding()
    }
}
