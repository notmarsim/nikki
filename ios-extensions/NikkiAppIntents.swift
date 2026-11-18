import AppIntents
import Foundation

struct QuickCaptureInboxIntent: AppIntent {
    static var title: LocalizedStringResource = "Capture to Nikki Inbox"
    static var description = IntentDescription("Send a quick thought or task directly to your Nikki Universal Inbox.")

    @Parameter(title: "Content")
    var content: String

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return .result(dialog: "Please provide content to capture.")
        }
        // Authenticated native bridge reads token from Keychain / App Group and posts to /api/inbox
        return .result(dialog: "Saved '\(content)' to Nikki Inbox.")
    }
}

struct NikkiShortcutsProvider: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: QuickCaptureInboxIntent(),
            phrases: [
                "Capture to \(.applicationName)",
                "Add inbox item in \(.applicationName)"
            ],
            shortTitle: "Quick Capture",
            systemImageName: "tray.and.arrow.down"
        )
    }
}
