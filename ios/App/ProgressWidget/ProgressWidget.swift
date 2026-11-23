import SwiftUI
import WidgetKit

struct ProgressEntry: TimelineEntry {
    let date: Date
    let progress: ProgressSnapshot?
}

struct ProgressProvider: TimelineProvider {
    func placeholder(in context: Context) -> ProgressEntry {
        let now = Date()
        return ProgressEntry(date: now, progress: ProgressSnapshot(
            today: ProgressSnapshot.dayKey(now), weekStart: "",
            tasksCompleted: 3, taskCount: 5, goalsMet: 2, goalCount: 4
        ))
    }

    func getSnapshot(in context: Context, completion: @escaping (ProgressEntry) -> Void) {
        let now = Date()
        completion(context.isPreview ? placeholder(in: context) :
            ProgressEntry(date: now, progress: ProgressSnapshot.load()?.at(now)))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ProgressEntry>) -> Void) {
        let now = Date()
        let snapshot = ProgressSnapshot.load()
        let calendar = Calendar(identifier: .gregorian)
        let midnight = calendar.dateInterval(of: .day, for: now)?.end ?? now.addingTimeInterval(86_400)
        completion(Timeline(entries: [
            ProgressEntry(date: now, progress: snapshot?.at(now)),
            ProgressEntry(date: midnight, progress: snapshot?.at(midnight))
        ], policy: .atEnd))
    }
}

struct ProgressWidgetView: View {
    let entry: ProgressEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Task Tracker", systemImage: "checkmark.circle")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.teal)
            Spacer(minLength: 0)
            if let progress = entry.progress {
                if family == .systemMedium {
                    HStack(spacing: 24) { today(progress); week(progress) }
                } else {
                    today(progress)
                    week(progress)
                }
            } else {
                Text("Open Task Tracker to see your progress.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .containerBackground(.background, for: .widget)
        .privacySensitive()
    }

    private func today(_ progress: ProgressSnapshot) -> some View {
        metric("Tasks today", done: progress.tasksCompleted, total: progress.taskCount)
    }

    private func week(_ progress: ProgressSnapshot) -> some View {
        metric("Weekly goals", done: progress.goalsMet, total: progress.goalCount)
    }

    private func metric(_ title: String, done: Int, total: Int) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title).font(.caption).foregroundStyle(.secondary)
            Text("\(done)/\(total)")
                .font(.headline.monospacedDigit())
                .accessibilityLabel("\(done) of \(total)")
            if family == .systemMedium {
                ProgressView(value: Double(done), total: Double(max(1, total)))
                    .tint(.teal)
                    .accessibilityHidden(true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

@main
struct TaskTrackerProgressWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: ProgressSnapshot.widgetKind, provider: ProgressProvider()) { entry in
            ProgressWidgetView(entry: entry)
        }
        .configurationDisplayName("Task Tracker Progress")
        .description("See today's completed tasks and this week's goals.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
