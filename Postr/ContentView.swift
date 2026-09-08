import SwiftUI

struct ContentView: View {
    @Binding var showSplash: Bool
    @State private var items: [PostrItem] = []
    @State private var showCreateSheet = false
    @State private var showTipsSheet = false
    @AppStorage("hasSeenOnboarding") private var hasSeenOnboarding: Bool = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()

                if items.isEmpty {
                    VStack(spacing: 8) {
                        Image(systemName: "square.and.pencil")
                            .font(.system(size: 40, weight: .bold))
                            .foregroundColor(.white)
                            .padding(.bottom, 6)
                        Text("NO ACTIVE POSTS")
                            .font(.system(size: 15, weight: .heavy, design: .default))
                            .foregroundColor(.white)
                        Text("Tap + to add a persistent sticky note.")
                            .font(.system(size: 13, weight: .regular, design: .default))
                            .foregroundColor(.gray)
                    }
                } else {
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            ForEach(items) { item in
                                PostrCardView(item: item) {
                                    complete(item)
                                }
                            }
                        }
                        .padding(16)
                    }
                }

                VStack {
                    Spacer()
                    HStack {
                        Spacer()
                        Button(action: { showCreateSheet = true }) {
                            Image(systemName: "plus")
                                .font(.system(size: 22, weight: .black, design: .default))
                                .foregroundColor(.white)
                                .frame(width: 56, height: 56)
                                .background(Color.red)
                                .clipShape(Circle())
                                .overlay(Circle().stroke(Color.white, lineWidth: 2))
                        }
                        .padding(24)
                    }
                }
            }
            .navigationTitle("POSTR")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { showTipsSheet = true }) {
                        Image(systemName: "lightbulb.fill")
                            .foregroundColor(.red)
                            .font(.system(size: 18))
                    }
                }
            }
            .sheet(isPresented: $showCreateSheet) {
                CreateReminderSheet { newItem in
                    SharedStore.shared.addItem(newItem)
                    NotificationManager.shared.scheduleNotification(for: newItem)
                    Task { await LiveActivityController.shared.syncWithCurrentItems() }
                    loadItems()
                }
            }
            .sheet(isPresented: $showTipsSheet) {
                TipsModalView()
            }
            .fullScreenCover(isPresented: $showSplash) {
                QuickSplashModalView(isPresented: $showSplash) {
                    loadItems()
                }
            }
            .onAppear {
                loadItems()
                if !hasSeenOnboarding {
                    showTipsSheet = true
                    hasSeenOnboarding = true
                }
            }
        }
    }

    private func loadItems() {
        items = SharedStore.shared.loadItems().filter { !$0.isCompleted }
    }

    private func complete(_ item: PostrItem) {
        SharedStore.shared.completeItem(id: item.id)
        UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: [item.id.uuidString])
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [item.id.uuidString])
        Task { await LiveActivityController.shared.syncWithCurrentItems() }
        loadItems()
    }
}

struct PostrCardView: View {
    let item: PostrItem
    let onDone: () -> Void

    var body: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                Text(item.title.uppercased())
                    .font(.system(size: 15, weight: .black, design: .default))
                    .foregroundColor(.black)
                if !item.body.isEmpty {
                    Text(item.body)
                        .font(.system(size: 13, weight: .medium, design: .default))
                        .foregroundColor(.black)
                }
                if let interval = item.pingIntervalSeconds {
                    Text("PING: EVERY \(Int(interval / 60))M")
                        .font(.system(size: 10, weight: .bold, design: .default).monospacedDigit())
                        .foregroundColor(.red)
                        .padding(.top, 4)
                }
            }
            Spacer()
            Button(action: onDone) {
                Image(systemName: "circle")
                    .font(.system(size: 22))
                    .foregroundColor(.black)
            }
        }
        .padding(16)
        .background(Color.white)
        .border(Color.red, width: 2)
    }
}

struct CreateReminderSheet: View {
    @Environment(\.dismiss) var dismiss
    @State private var title = ""
    @State private var bodyText = ""
    @State private var selectedMinutes: Int = 0
    let onSave: (PostrItem) -> Void

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(alignment: .leading, spacing: 16) {
                Text("NEW REMINDER")
                    .font(.system(size: 18, weight: .black, design: .default))
                    .foregroundColor(.red)

                TextField("Title", text: $title)
                    .font(.system(size: 15, weight: .bold, design: .default))
                    .padding(12)
                    .background(Color.white)
                    .foregroundColor(.black)

                TextField("Notes (optional)", text: $bodyText, axis: .vertical)
                    .font(.system(size: 13, weight: .regular, design: .default))
                    .lineLimit(3...5)
                    .padding(12)
                    .background(Color.white)
                    .foregroundColor(.black)

                Text("REPEAT PING")
                    .font(.system(size: 11, weight: .heavy, design: .default))
                    .foregroundColor(.white)

                Picker("Interval", selection: $selectedMinutes) {
                    Text("None").tag(0)
                    Text("1m").tag(1)
                    Text("2m").tag(2)
                    Text("3m").tag(3)
                    Text("5m").tag(5)
                    Text("10m").tag(10)
                }
                .pickerStyle(.segmented)
                .colorMultiply(.red)

                Spacer()

                HStack {
                    Button("CANCEL") { dismiss() }
                        .font(.system(size: 14, weight: .bold, design: .default))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)

                    Button("SAVE") {
                        guard !title.isEmpty else { return }
                        let interval = selectedMinutes > 0 ? Double(selectedMinutes * 60) : nil
                        let item = PostrItem(title: title, body: bodyText, pingIntervalSeconds: interval)
                        onSave(item)
                        dismiss()
                    }
                    .font(.system(size: 14, weight: .black, design: .default))
                    .foregroundColor(.black)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(title.isEmpty ? Color.gray : Color.red)
                    .disabled(title.isEmpty)
                }
            }
            .padding(20)
        }
    }
}

struct TipsModalView: View {
    @Environment(\.dismiss) var dismiss

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 18) {
                HStack {
                    Text("POSTR GUIDE")
                        .font(.system(size: 18, weight: .black, design: .default))
                        .foregroundColor(.red)
                    Spacer()
                    Button(action: { dismiss() }) {
                        Image(systemName: "xmark")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(.white)
                    }
                }

                GuideItem(
                    title: "1. PERSISTENT NOTIFICATIONS",
                    desc: "Reminders remain on your Lock Screen and Notification Center until explicitly cleared."
                )
                GuideItem(
                    title: "2. REPEATING PINGS",
                    desc: "Set intervals from 1-10 minutes. The notification alerts you periodically until dismissed."
                )
                GuideItem(
                    title: "3. COMPLETING ITEMS",
                    desc: "Tap the circle inside the app, tap 'Done' on the notification banner, or tap the checkmark in the Live Activity."
                )
                GuideItem(
                    title: "4. TRIPLE BACK TAP QUICK-ADD",
                    desc: "In iOS Settings > Accessibility > Touch > Back Tap, map Triple Tap to a Shortcut opening URL scheme: postr://splash."
                )

                Spacer()
            }
            .padding(24)
        }
    }
}

struct GuideItem: View {
    let title: String
    let desc: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.system(size: 12, weight: .heavy, design: .default))
                .foregroundColor(.white)
            Text(desc)
                .font(.system(size: 12, weight: .regular, design: .default))
                .foregroundColor(.gray)
        }
    }
}