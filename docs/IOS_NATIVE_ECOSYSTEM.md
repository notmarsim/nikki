# Nikki iOS Native Ecosystem Guide

Nikki Phase 6 adds native iOS integration support alongside the responsive PWA and Capacitor wrapper.

## Components Delivered

1. **Authenticated Snapshot Endpoint** (`/api/ios/widget-snapshot`):
   - Returns a lightweight JSON summary (`workspaceName`, `openTasksCount`, `topTasks`, `activeHabitsCount`, `upcomingEvents`, `activeFocus`) scoped by RLS to the authenticated user.
2. **Swift Reference Extensions** (`ios-extensions/`):
   - `NikkiWidget.swift`: WidgetKit `TimelineProvider` reading App Group `group.com.nikki.app` cached values.
   - `NikkiAppIntents.swift`: `QuickCaptureInboxIntent` and `NikkiShortcutsProvider` for Siri & Shortcuts.
   - `NikkiShareExtension.swift`: iOS Share Sheet extension queueing shared links/text to the App Group for `/api/inbox` sync.

## Xcode Setup (macOS Required)

Because Apple requires macOS + Xcode for Swift compilation, code signing, and App Group provisioning:
1. Run `npx cap add ios` and `npx cap open ios` on a macOS machine.
2. Enable the **App Groups** capability (`group.com.nikki.app`) on the main App target and each extension target.
3. Add Widget Extension, Share Extension, and App Intents targets using the files in `ios-extensions/`.
4. Configure Universal Links (`apple-app-site-association`) on the production domain for deep linking.
