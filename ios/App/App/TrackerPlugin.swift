import Capacitor
import GoogleSignIn
import WidgetKit

@objc(TrackerPlugin)
final class TrackerPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "TrackerPlugin"
    let jsName = "TaskTracker"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signOut", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setProgress", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearProgress", returnType: CAPPluginReturnPromise)
    ]

    @objc func signIn(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let clientID = Bundle.main.object(forInfoDictionaryKey: "GIDClientID") as? String,
                  clientID.hasSuffix(".apps.googleusercontent.com"),
                  let urlTypes = Bundle.main.object(forInfoDictionaryKey: "CFBundleURLTypes") as? [[String: Any]],
                  urlTypes.contains(where: {
                      let schemes = $0["CFBundleURLSchemes"] as? [String] ?? []
                      return schemes.contains(clientID.split(separator: ".").reversed().joined(separator: "."))
                  }) else {
                call.reject("Set the iOS Google client ID and callback scheme.", "google-not-configured")
                return
            }
            guard let controller = self.bridge?.viewController else {
                call.reject("Unable to present Google sign-in.")
                return
            }
            GIDSignIn.sharedInstance.signIn(withPresenting: controller) { result, error in
                if let error = error as NSError? {
                    // Google Sign-In reports code -5 when the user closes its sign-in sheet.
                    let cancelled = error.domain == "com.google.GIDSignIn" && error.code == -5
                    call.reject("Google sign-in failed.", cancelled ? "google-cancelled" : "google-failed")
                    return
                }
                guard let user = result?.user, let idToken = user.idToken?.tokenString else {
                    call.reject("Google did not return an ID token.")
                    return
                }
                call.resolve(["idToken": idToken, "accessToken": user.accessToken.tokenString])
            }
        }
    }

    @objc func signOut(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            GIDSignIn.sharedInstance.signOut()
            call.resolve()
        }
    }

    @objc func setProgress(_ call: CAPPluginCall) {
        guard let today = call.getString("today"),
              let weekStart = call.getString("weekStart"),
              let tasksCompleted = call.getInt("tasksCompleted"),
              let taskCount = call.getInt("taskCount"),
              let goalsMet = call.getInt("goalsMet"),
              let goalCount = call.getInt("goalCount") else {
            call.reject("Invalid progress summary.")
            return
        }
        let snapshot = ProgressSnapshot(today: today, weekStart: weekStart, tasksCompleted: tasksCompleted,
                                        taskCount: taskCount, goalsMet: goalsMet, goalCount: goalCount)
        updateWidget(call, snapshot: snapshot)
    }

    @objc func clearProgress(_ call: CAPPluginCall) {
        updateWidget(call, snapshot: nil)
    }

    private func updateWidget(_ call: CAPPluginCall, snapshot: ProgressSnapshot?) {
        do {
            if try ProgressSnapshot.store(snapshot) {
                WidgetCenter.shared.reloadTimelines(ofKind: ProgressSnapshot.widgetKind)
            }
            call.resolve()
        } catch {
            call.reject("Unable to update the shared widget. Check App Groups signing.", "widget-storage")
        }
    }
}
