import Foundation
import UserNotifications

public final class NotificationManager: NSObject, UNUserNotificationCenterDelegate {
    public static let shared = NotificationManager()

    public func requestAuthorization() {
        let center = UNUserNotificationCenter.current()
        center.delegate = self
        center.requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
            if granted {
                self.setupNotificationCategories()
            }
        }
    }

    private func setupNotificationCategories() {
        let doneAction = UNNotificationAction(
            identifier: "ACTION_DONE",
            title: "Done",
            options: [.destructive]
        )
        let category = UNNotificationCategory(
            identifier: "POSTR_STICKY",
            actions: [doneAction],
            intentIdentifiers: [],
            options: []
        )
        UNUserNotificationCenter.current().setNotificationCategories([category])
    }

    public func scheduleNotification(for item: PostrItem) {
        let content = UNMutableNotificationContent()
        content.title = item.title
        content.body = item.body.isEmpty ? "Reminder pinned." : item.body
        content.sound = .default
        content.categoryIdentifier = "POSTR_STICKY"

        let trigger: UNNotificationTrigger
        if let interval = item.pingIntervalSeconds, interval >= 60 {
            trigger = UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: true)
        } else {
            trigger = UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
        }

        let request = UNNotificationRequest(
            identifier: item.id.uuidString,
            content: content,
            trigger: trigger
        )

        UNUserNotificationCenter.current().add(request)
    }

    public func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let reminderIDString = response.notification.request.identifier
        if let uuid = UUID(uuidString: reminderIDString) {
            SharedStore.shared.completeItem(id: uuid)
            UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: [reminderIDString])
            UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [reminderIDString])
            Task {
                await LiveActivityController.shared.syncWithCurrentItems()
            }
        }
        completionHandler()
    }
}