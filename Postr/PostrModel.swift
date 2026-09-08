import Foundation
import ActivityKit

public struct PostrItem: Identifiable, Codable, Equatable, Sendable {
    public let id: UUID
    public var title: String
    public var body: String
    public var createdAt: Date
    public var pingIntervalSeconds: Double?
    public var isCompleted: Bool

    public init(
        id: UUID = UUID(),
        title: String,
        body: String = "",
        pingIntervalSeconds: Double? = nil,
        isCompleted: Bool = false
    ) {
        self.id = id
        self.title = title
        self.body = body
        self.createdAt = Date()
        self.pingIntervalSeconds = pingIntervalSeconds
        self.isCompleted = isCompleted
    }
}

public struct PostrActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        public var activeReminders: [CompactReminder]
        
        public init(activeReminders: [CompactReminder]) {
            self.activeReminders = activeReminders
        }
    }

    public struct CompactReminder: Codable, Hashable, Identifiable {
        public let id: UUID
        public let title: String

        public init(id: UUID, title: String) {
            self.id = id
            self.title = title
        }
    }

    public var appName: String = "Postr"

    public init() {}
}

public final class SharedStore {
    public static let shared = SharedStore()
    private let appGroupID = "group.com.postr.shared"
    private let storageKey = "saved_postr_items"

    private var defaults: UserDefaults {
        UserDefaults(suiteName: appGroupID) ?? .standard
    }

    public func loadItems() -> [PostrItem] {
        guard let data = defaults.data(forKey: storageKey),
              let items = try? JSONDecoder().decode([PostrItem].self, from: data) else {
            return []
        }
        return items
    }

    public func saveItems(_ items: [PostrItem]) {
        if let data = try? JSONEncoder().encode(items) {
            defaults.set(data, forKey: storageKey)
        }
    }

    public func addItem(_ item: PostrItem) {
        var items = loadItems()
        items.insert(item, at: 0)
        saveItems(items)
    }

    public func completeItem(id: UUID) {
        var items = loadItems()
        if let index = items.firstIndex(where: { $0.id == id }) {
            items.remove(at: index)
            saveItems(items)
        }
    }
}