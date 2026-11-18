import UIKit
import Social
import UniformTypeIdentifiers

final class NikkiShareViewController: SLComposeServiceViewController {
    private let appGroupId = "group.com.nikki.app"

    override func isContentValid() -> Bool {
        return !(contentText ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    override func didSelectPost() {
        let sharedText = contentText ?? ""
        if let defaults = UserDefaults(suiteName: appGroupId) {
            var queue = defaults.stringArray(forKey: "nikki_pending_shares") ?? []
            queue.append(sharedText)
            defaults.set(queue, forKey: "nikki_pending_shares")
        }
        self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }

    override func configurationItems() -> [Any]! {
        return []
    }
}
