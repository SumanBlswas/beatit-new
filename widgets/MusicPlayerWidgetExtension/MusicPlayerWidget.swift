import WidgetKit
import SwiftUI
import Intents

struct MusicPlayerEntry: TimelineEntry {
    let date: Date
    let title: String
    let artist: String
    let albumArt: String
    let isPlaying: Bool
    let progress: Double
}

struct MusicPlayerProvider: TimelineProvider {
    func placeholder(in context: Context) -> MusicPlayerEntry {
        MusicPlayerEntry(date: Date(), title: "No song playing", artist: "", albumArt: "", isPlaying: false, progress: 0)
    }

    func getSnapshot(in context: Context, completion: @escaping (MusicPlayerEntry) -> ()) {
        let entry = MusicPlayerEntry(date: Date(), title: "No song playing", artist: "", albumArt: "", isPlaying: false, progress: 0)
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<MusicPlayerEntry>) -> ()) {
        // TODO: Read shared data from App Group/UserDefaults
        let entry = MusicPlayerEntry(date: Date(), title: "No song playing", artist: "", albumArt: "", isPlaying: false, progress: 0)
        let timeline = Timeline(entries: [entry], policy: .never)
        completion(timeline)
    }
}

struct MusicPlayerWidgetView: View {
    var entry: MusicPlayerProvider.Entry

    var body: some View {
        ZStack {
            LinearGradient(gradient: Gradient(colors: [Color(#colorLiteral(red:0.13, green:0.13, blue:0.13, alpha:1)), Color(#colorLiteral(red:0.22, green:0.22, blue:0.22, alpha:1))]), startPoint: .topLeading, endPoint: .bottomTrailing)
            VStack(alignment: .center, spacing: 10) {
                if !entry.albumArt.isEmpty {
                    Image(uiImage: UIImage(named: entry.albumArt) ?? UIImage())
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 56, height: 56)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .shadow(radius: 6)
                }
                Text(entry.title)
                    .font(.system(size: 18, weight: .bold, design: .rounded))
                    .foregroundColor(.white)
                    .lineLimit(1)
                    .shadow(color: .black.opacity(0.3), radius: 2, x: 0, y: 1)
                Text(entry.artist)
                    .font(.system(size: 14, weight: .medium, design: .rounded))
                    .foregroundColor(.gray)
                    .lineLimit(1)
                HStack(spacing: 24) {
                    Button(action: { /* previous */ }) {
                        Image(systemName: "backward.fill")
                            .font(.system(size: 22, weight: .bold))
                            .foregroundColor(.white)
                            .background(Circle().fill(Color.black.opacity(0.2)).frame(width: 36, height: 36))
                    }
                    Button(action: { /* play/pause */ }) {
                        Image(systemName: entry.isPlaying ? "pause.fill" : "play.fill")
                            .font(.system(size: 26, weight: .bold))
                            .foregroundColor(.white)
                            .background(Circle().fill(Color.green.opacity(0.7)).frame(width: 44, height: 44))
                            .shadow(radius: 4)
                    }
                    Button(action: { /* next */ }) {
                        Image(systemName: "forward.fill")
                            .font(.system(size: 22, weight: .bold))
                            .foregroundColor(.white)
                            .background(Circle().fill(Color.black.opacity(0.2)).frame(width: 36, height: 36))
                    }
                }
                ProgressView(value: entry.progress)
                    .progressViewStyle(LinearProgressViewStyle(tint: Color.green))
                    .frame(height: 6)
                    .background(Color.white.opacity(0.1))
                    .cornerRadius(3)
            }
            .padding(16)
        }
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .shadow(color: Color.black.opacity(0.25), radius: 10, x: 0, y: 4)
    }
}

@main
struct MusicPlayerWidget: Widget {
    let kind: String = "MusicPlayerWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: MusicPlayerProvider()) { entry in
            MusicPlayerWidgetView(entry: entry)
        }
        .configurationDisplayName("Now Playing")
        .description("Shows current song and controls.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
