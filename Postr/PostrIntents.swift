import AppIntents
import Foundation
import UserNotifications

public struct CompleteReminderIntent: LiveActivityIntent {
    public static var title: LocalizedStringResource = "Mark Reminder Done"

    @Parameter(title: "Reminder ID")
    public var reminderID: String

    public init() {}
    public init(reminderID: String) {
        self.reminderID = reminderID
    }

    public func perform() async throws -> some IntentResult {
        guard let uuid = UUID(uuidString: reminderID) else { return .result() }

        SharedStore.shared.completeItem(id: uuid)
        UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: [reminderID])
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [reminderID])
        await LiveActivityController.shared.syncWithCurrentItems()

        return .result()
    }
}

public struct CreateReminderIntent: AppIntent {
    public static var title: LocalizedStringResource = "Create Postr Reminder"
    public static var description = IntentDescription("Creates a new sticky note reminder.")

    @Parameter(title: "Title")
    var title: String

    @Parameter(title: "Body")
    var body: String?

    @Parameter(title: "Repeat Interval (Minutes)")
    var pingIntervalMinutes: Int?

    public static var openAppWhenRun: Bool = false

    public init() {}

    public func perform() async throws -> some IntentResult & ReturnsValue<String> {
        let intervalSeconds = pingIntervalMinutes.flatMap { $0 > 0 ? Double($0 * 60) : nil }
        let item = PostrItem(
            title: title,
            body: body ?? "",
            pingIntervalSeconds: intervalSeconds
        )

        SharedStore.shared.addItem(item)
        NotificationManager.shared.scheduleNotification(for: item)
        await LiveActivityController.shared.syncWithCurrentItems()

        return .result(value: "Pinned: \(title)")
    }
}