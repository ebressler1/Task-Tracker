# Task Tracker on iPhone

The iPhone app bundles the existing Task Tracker interface and uses the same Firebase project for Google sign-in and task history. Its WidgetKit extension displays today's checked-off tasks and this week's met goals for active recurring tasks. The Home Screen widget is available in small and medium sizes. Task Tracker requests a widget refresh when its local progress changes. Progress logged on another device is reflected after the iPhone app next loads it from Firebase.

## First device install

1. Install [Xcode](https://developer.apple.com/xcode/) 26 or newer on your Mac. Open it once to install the iOS tools, then add your Apple Account in **Xcode > Settings > Accounts**. This app targets iOS 17 and newer.
2. In [Firebase project settings](https://firebase.google.com/docs/ios/setup#register-app), add an Apple app to the Task Tracker project using the bundle ID `com.ebressler.tasktracker`. Download its `GoogleService-Info.plist`. Copy the values of `CLIENT_ID` and `REVERSED_CLIENT_ID` into `ios/Tracker.local.xcconfig` as shown below. If those keys are missing, verify that Google is enabled in Firebase Authentication and download a fresh plist.

   ```text
   GOOGLE_IOS_CLIENT_ID = paste the CLIENT_ID value here
   GOOGLE_IOS_URL_SCHEME = paste the REVERSED_CLIENT_ID value here
   ```

3. Run `npm ci` and `npm run ios:sync` from the repository folder. Open `ios/App/App.xcodeproj` in Xcode.
4. Under **Signing & Capabilities**, select the same team for the **App** and **ProgressWidget** targets, with automatic signing enabled. Confirm that both targets are assigned to `group.com.ebressler.tasktracker` under App Groups. Create or register that group in Xcode if prompted. If your team needs a different group ID, override `TRACKER_APP_GROUP` in `Tracker.local.xcconfig` and use the same value for both targets. If you change the app bundle ID, use that ID in Firebase and set the widget bundle ID to the new app ID plus `.ProgressWidget`.
5. Connect and unlock your iPhone. Enable [Developer Mode](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device) if prompted. Select your iPhone and the **App** scheme in Xcode, then press **Run**. Sign in with your usual Google account.
6. Touch and hold the iPhone Home Screen, choose **Edit > Add Widget**, and search for **Task Tracker Progress**. Check off a task in the app and return to the Home Screen to verify that the widget updates.

Apple permits personal device testing directly from Xcode. Free Personal Team provisioning expires after seven days, so Xcode may need to rebuild and reinstall the app weekly. [Apple developer account and provisioning details](https://developer.apple.com/help/account/basics/about-your-developer-account).

For future updates, run `npm run ios:sync` again and click **Run** in Xcode. The app bundles those assets during the build.
