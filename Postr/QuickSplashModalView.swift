import SwiftUI

struct QuickSplashModalView: View {
    @Binding var isPresented: Bool
    var onSaved: () -> Void

    @State private var title = ""
    @State private var bodyText = ""
    @State private var selectedMinutes: Int = 1

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: 16) {
                HStack {
                    Text("QUICK PIN")
                        .font(.system(size: 20, weight: .black, design: .default))
                        .foregroundColor(.red)
                    Spacer()
                    Button(action: { isPresented = false }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 20))
                            .foregroundColor(.white)
                    }
                }

                TextField("What needs remembering?", text: $title)
                    .font(.system(size: 16, weight: .semibold, design: .default))
                    .padding(12)
                    .background(Color.white)
                    .foregroundColor(.black)

                TextField("Additional details (optional)", text: $bodyText)
                    .font(.system(size: 14, weight: .regular, design: .default))
                    .padding(12)
                    .background(Color.white)
                    .foregroundColor(.black)

                HStack {
                    Text("PING")
                        .font(.system(size: 12, weight: .bold, design: .default))
                        .foregroundColor(.white)

                    Picker("Ping", selection: $selectedMinutes) {
                        Text("None").tag(0)
                        Text("1m").tag(1)
                        Text("3m").tag(3)
                        Text("5m").tag(5)
                        Text("10m").tag(10)
                    }
                    .pickerStyle(.segmented)
                    .colorMultiply(.red)
                }

                Button(action: saveQuickNote) {
                    Text("PIN TO LOCK SCREEN")
                        .font(.system(size: 15, weight: .heavy, design: .default))
                        .foregroundColor(.black)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(title.trimmingCharacters(in: .whitespaces).isEmpty ? Color.gray : Color.red)
                }
                .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding(20)
            .border(Color.red, width: 2)
            .padding(.horizontal, 20)
        }
    }

    private func saveQuickNote() {
        let trimmedTitle = title.trimmingCharacters(in: .whitespaces)
        guard !trimmedTitle.isEmpty else { return }

        let interval = selectedMinutes > 0 ? Double(selectedMinutes * 60) : nil
        let item = PostrItem(title: trimmedTitle, body: bodyText, pingIntervalSeconds: interval)

        SharedStore.shared.addItem(item)
        NotificationManager.shared.scheduleNotification(for: item)
        Task { await LiveActivityController.shared.syncWithCurrentItems() }

        isPresented = false
        onSaved()
    }
}