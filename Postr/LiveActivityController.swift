import ActivityKit
import Foundation

public final class LiveActivityController {
    public static let shared = LiveActivityController()

    public func syncWithCurrentItems() async {
        let activeItems = SharedStore.shared.loadItems().filter { !$0.isCompleted }
        let compactList = activeItems.map {
            PostrActivityAttributes.CompactReminder(id: $0.id, title: $0.title)
        }

        if compactList.isEmpty {
            for activity in Activity<PostrActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            return
        }

        let contentState = PostrActivityAttributes.ContentState(activeReminders: compactList)
        let activityContent = ActivityContent(state: contentState, staleDate: nil)

        if let existing = Activity<PostrActivityAttributes>.activities.first {
            await existing.update(activityContent)
        } else {
            do {
                let attributes = PostrActivityAttributes()
                _ = try Activity.request(
                    attributes: attributes,
                    content: activityContent,
                    pushType: nil
                )
            } catch {
                print("ActivityKit error: \(error.localizedDescription)")
            }
        }
    }
}