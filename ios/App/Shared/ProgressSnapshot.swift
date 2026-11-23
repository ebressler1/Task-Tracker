import Foundation

struct ProgressSnapshot: Codable, Equatable {
    static let widgetKind = "TaskTrackerProgress"

    let today: String
    let weekStart: String
    let tasksCompleted: Int
    let taskCount: Int
    let goalsMet: Int
    let goalCount: Int

    private static var file: URL? {
        guard let group = Bundle.main.object(forInfoDictionaryKey: "TrackerAppGroup") as? String else { return nil }
        return FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)?
            .appendingPathComponent("progress.json")
    }

    static func load() -> Self? {
        guard let file, let data = try? Data(contentsOf: file) else { return nil }
        return try? JSONDecoder().decode(Self.self, from: data)
    }

    static func store(_ snapshot: Self?) throws -> Bool {
        guard let file else { throw CocoaError(.fileNoSuchFile) }
        if let snapshot {
            guard snapshot != load() else { return false }
            let data = try JSONEncoder().encode(snapshot)
            try data.write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        } else {
            guard FileManager.default.fileExists(atPath: file.path) else { return false }
            try FileManager.default.removeItem(at: file)
        }
        return true
    }

    static func dayKey(_ date: Date) -> String {
        let parts = Calendar(identifier: .gregorian).dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }

    func at(_ date: Date) -> Self {
        var calendar = Calendar(identifier: .gregorian)
        calendar.firstWeekday = 2
        let day = Self.dayKey(date)
        let monday = calendar.dateInterval(of: .weekOfYear, for: date)?.start ?? date
        let week = Self.dayKey(monday)
        return Self(today: day, weekStart: week,
                    tasksCompleted: day == today ? tasksCompleted : 0, taskCount: taskCount,
                    goalsMet: week == weekStart ? goalsMet : 0, goalCount: goalCount)
    }
}
