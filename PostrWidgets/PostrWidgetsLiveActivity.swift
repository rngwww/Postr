import ActivityKit
import SwiftUI
import WidgetKit

@main
struct PostrWidgetsBundle: WidgetBundle {
    var body: some Widget {
        PostrLiveActivity()
    }
}

struct PostrLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PostrActivityAttributes.self) { context in
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("POSTR ACTIVE")
                        .font(.system(size: 11, weight: .black, design: .default))
                        .foregroundColor(.red)
                    Spacer()
                    Text("\(context.state.activeReminders.count) PENDING")
                        .font(.system(size: 11, weight: .heavy, design: .default).monospacedDigit())
                        .foregroundColor(.white)
                }

                Divider().background(Color.white)

                ForEach(context.state.activeReminders.prefix(4)) { reminder in
                    HStack {
                        Text(reminder.title)
                            .font(.system(size: 13, weight: .medium, design: .default))
                            .foregroundColor(.white)
                            .lineLimit(1)
                        Spacer()
                        Button(intent: CompleteReminderIntent(reminderID: reminder.id.uuidString)) {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(.red)
                                .font(.system(size: 18))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(14)
            .background(Color.black)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text("POSTR")
                        .font(.system(size: 12, weight: .black, design: .default))
                        .foregroundColor(.red)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("\(context.state.activeReminders.count) LEFT")
                        .font(.system(size: 12, weight: .heavy, design: .default).monospacedDigit())
                        .foregroundColor(.white)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(context.state.activeReminders.prefix(2)) { reminder in
                            HStack {
                                Text(reminder.title)
                                    .font(.system(size: 12, weight: .medium, design: .default))
                                    .foregroundColor(.white)
                                Spacer()
                                Button(intent: CompleteReminderIntent(reminderID: reminder.id.uuidString)) {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundColor(.red)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
            } compactLeading: {
                Image(systemName: "note.text")
                    .foregroundColor(.red)
            } compactTrailing: {
                Text("\(context.state.activeReminders.count)")
                    .font(.system(size: 12, weight: .bold, design: .default).monospacedDigit())
                    .foregroundColor(.white)
            } minimal: {
                Text("\(context.state.activeReminders.count)")
                    .font(.system(size: 12, weight: .heavy, design: .default).monospacedDigit())
                    .foregroundColor(.red)
            }
        }
    }
}