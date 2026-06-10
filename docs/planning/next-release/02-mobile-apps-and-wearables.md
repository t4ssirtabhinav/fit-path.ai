# Research & Plan: Native Mobile Apps + Wearables/Health Data Integration

Covers tickets **#2 (iOS/Android beta rollout, beginner's roadmap), #5 (wearables/native health data), #6 (reporting on wearable data)**.

Written for someone with **zero native mobile experience** but a working React/TypeScript + Supabase web app.

---

## Part A: Going from web app to iOS/Android beta — the complete beginner's roadmap

### Step 1 — Choose your build approach (the most important early decision)

| Approach | Learning curve from React/TS | Code reuse from existing app | Notes |
|---|---|---|---|
| **Capacitor** (wraps the existing web app in a native shell) | **Lowest** — same React/TS/Tailwind code; learn build/deploy pipeline + native plugin APIs, not a new framework | **Highest** — potentially 90%+ of the existing app, including UI | Fastest path to an installable build (days-to-weeks); WebView performance ceiling is lower for highly animated UI; reviewers sometimes scrutinize "is this just a wrapped website" |
| **React Native (with Expo)** | **Low-moderate** — keep JSX/hooks/state/types; relearn UI primitives (View/Text vs div/span), navigation (React Navigation vs React Router), and styling (NativeWind brings Tailwind-like classes) | **Moderate-high** — business logic, hooks, Supabase calls, and types reuse heavily (40-70% of non-UI code); UI layer is rebuilt | Produces genuinely native UI and performance; Expo + EAS Build abstracts away most native-tooling pain (no Mac required for iOS builds); the dominant recommendation for React-background teams |
| **Flutter** | **Steep** — new language (Dart), new state-management ecosystem, new tooling | **Low** — ~zero direct code reuse, only concepts | Best raw performance/animation ceiling and ~95%+ cross-platform code sharing, but the wrong choice for a solo React founder under time pressure |
| **Fully native (Swift/Kotlin)** | **Steepest** — two separate codebases, languages, toolchains | **None** | Only justified by deep platform integration needs (ARKit, watchOS); not a fit at this stage |
| **PWA (stopgap)** | Minimal — mostly manifest/service-worker config | 100% | Can't be distributed via the App Store, can't access HealthKit, limited push on iOS — useful as an *interim* improvement to the web experience, not a substitute for a real beta |

### Step 2 — Recommended path: start with Capacitor, graduate to React Native
**Start by wrapping the existing web app in Capacitor** — it converts "learn an entirely new tech stack" into "learn a build/deploy pipeline," gets a real installable build in front of testers in days-to-weeks (starting the App Store/Play Store account-and-review clock immediately, which itself consumes calendar time), and keeps a clean migration path open: React/TS skills and most business logic transfer directly if/when you later move to React Native.

**The one honest caveat**: Capacitor is the *weakest* of the options for deep health-data integration — HealthKit/Health Connect plugins for Capacitor are "less mature, less actively maintained, and narrower in scope" than React Native's equivalents (`react-native-health`, `react-native-health-connect`), because Capacitor's native-plugin ecosystem is smaller overall. **Recommended sequencing**: ship the Capacitor-wrapped beta first to validate mobile product-market fit and start building store presence, and treat a **React Native rewrite as the natural Phase 2 investment** — specifically once wearables/HealthKit integration (Part B below) becomes a committed near-term priority rather than a future-roadmap item. ([React Native docs](https://reactnative.dev/docs/getting-started))

### Step 3 — Environment & tooling setup
- **iOS requires a Mac** (Xcode is macOS-only — a hard requirement; if you don't own one, cloud-build services like Expo's **EAS Build** can produce iOS builds without owning a Mac, or rent a cloud Mac via MacStadium/similar). Install Xcode (free, ~10GB+), command-line tools, CocoaPods, and an iOS Simulator.
- **Android** tooling (Android Studio, SDK, emulator) runs natively on Windows — good news given the current dev environment.
- Budget real time for first-time setup friction (SDK licenses, simulator downloads, signing-certificate generation).

### Step 4 — Development
- Wrap the build, configure native project settings (icons, splash screens, bundle IDs/package names, permission strings in `Info.plist`/`AndroidManifest.xml`), integrate plugins (push, status bar, camera/biometrics as needed).
- Test layouts at native screen sizes; budget extra time tuning touch targets, scroll behavior, and perceived performance — WebView-based UI can feel sluggish on complex animated screens, and "feels just like the website" is an actual risk factor in app review (both stores expect platform-appropriate navigation/gestures per Apple's Human Interface Guidelines and Android's Material Design).

### Step 5 — Auth on mobile (the trickiest carry-over piece)
On the web, OAuth/email-link flows redirect to a web URL; on mobile there's no such URL — the app must register a **custom URL scheme** (e.g. `fitpathai://`) or a Universal/App Link, add it to **Supabase's Auth → URL Configuration → Redirect URLs allowlist**, and implement deep-link handlers that catch the redirect and exchange the code for a session. Session tokens should also move from web localStorage to **secure device storage** (`expo-secure-store`/Keychain/EncryptedSharedPreferences) rather than plain AsyncStorage. **This is required groundwork before email verification, OAuth, and password-reset (from the previous roadmap's auth plan, doc 02) will work on mobile** — flag it as an explicit dependency. Also note: if you offer any third-party login on iOS, Apple's Guideline 4.8 generally requires also offering **Sign in with Apple**. ([Supabase: Native Mobile Deep Linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking))

### Step 6 — Testing
Use simulators/emulators for fast iteration, but **always test the auth/deep-link flow, camera, push notifications, and sensors on real physical devices** — these are exactly the areas simulators mask problems in.

### Step 7 — Developer accounts & costs (start these in parallel with development — they have real lead times)
| Item | Cost | Notes |
|---|---|---|
| **Apple Developer Program** | **$99/year** | Includes Xcode, TestFlight, App Store Connect, push services; enrollment/verification can take days (longer for organizations needing D-U-N-S verification) |
| **Google Play Console** | **$25 one-time** | No renewal; account verification can also take some days for new accounts |
| Mac access (if needed) | ~$600-1,500 to buy, or ~$30-100/mo cloud rental | One-time/ongoing |

([Apple Developer Program](https://developer.apple.com/programs/whats-included/))

### Step 8 — Beta distribution
- **iOS — TestFlight**: **internal testers** (up to 100, instant, no review needed) → **external testers** (up to 10,000, no App Store Connect account needed for them, but the **first build must pass Apple's "Beta App Review"**). Builds are valid for testing up to **90 days**. ([TestFlight Overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/))
- **Android — Play testing tracks**: **internal** (instant, small group) → **closed** (invite-based — and importantly, **new "personal" developer accounts are now required to run a closed test with a minimum tester count and duration, commonly cited around ~12-20 testers for ~14 days, before production access is granted** — verify the exact current thresholds in Play Console at submission time, as Google revises these) → **open** (public beta) → production.
- This Android closed-testing requirement is a genuine **multi-week structural gate**, not a same-day review — budget at least 2-3 weeks for it alone.

### Step 9 — Common app-review rejection reasons worth designing around from day one
Pulled directly from Apple's App Review Guidelines (and the Android equivalent expectations):
- **Missing a working demo account** for reviewers — an instant-rejection trigger; make sure FitPath's review submission includes test credentials that can log in and generate/view a plan.
- **No in-app account deletion** (Apple Guideline 5.1.1(v) makes this *mandatory* for any app with accounts) — the existing web app already has this (per the codebase audit's ProfilePage findings), so just ensure it ships in the mobile build too.
- **Vague permission usage strings** — be specific: *"FitPath uses your step and sleep data to personalize your daily plan"*, not generic boilerplate.
- **Health-measurement claims**: Guideline 1.4.1 prohibits claiming the app *measures* health metrics (blood oxygen, blood pressure, glucose) from device sensors without regulatory clearance — frame everything as *displaying synced data*, never as *measuring* it.
- **Incomplete/mismatched privacy policy** — what's declared in App Store Connect/Play Console must match the actual policy and the actual data usage. (Directly ties to the prior roadmap's compliance doc 01 — that policy now has a second audience: app-store reviewers, not just users.)

([App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/))

### Realistic timeline & cost summary
- **Capacitor proof-of-concept**: days to ~2 weeks
- **Store-ready polish + plugin integration**: 4-8 weeks on top
- **Account setup + first review cycles + Android closed-testing window**: 3-5 weeks (much of it parallel to development if started early)
- **Total realistic span from "start" to "public beta on both platforms"**: roughly **2-4 months**, dominated less by review-process wait times (now fairly fast — 24-48 hours typical) and more by development/polish time and the mandatory Android closed-testing duration
- **Total cash outlay**: ~$99 (Apple) + $25 (Google) + optional Mac-access cost

### Backend note: Supabase works fine from mobile
Supabase's JS client runs the same in React Native/Capacitor as on web (same JS runtime), and Supabase publishes official Flutter and Swift/Kotlin clients too — the backend is not a blocker for any of these paths. The auth/session differences in Step 5 are the only meaningful adaptation required.

### Push notification infrastructure (a genuinely new piece vs. the web app)
- **iOS** needs **APNs** (Apple Push Notification service) — push certificates/keys generated in the Apple Developer portal, the Push Notifications capability enabled in Xcode, and runtime permission requests. ([Registering with APNs](https://developer.apple.com/documentation/usernotifications/registering-your-app-with-apns))
- **Android** needs **FCM** (Firebase Cloud Messaging) plus, on Android 13+, the runtime `POST_NOTIFICATIONS` permission — which is **off by default** for new installs and should be requested only after the user has experienced value, not on first launch (Google's own guidance). ([Android Notification Permission](https://developer.android.com/develop/ui/views/notifications/notification-permission))
- In practice, most teams use a unifying layer (Expo's push service, or FCM routing to both platforms) rather than integrating APNs/FCM by hand. This is genuinely new infrastructure beyond what the web app needs — **web push doesn't exist in the same form on iOS Safari** — and is the technical dependency the push-notification plan (doc 03 of this folder) is waiting on.

---

## Part B: Wearables & Native Health Data Integration

### What data is realistically syncable, and through what
**Apple HealthKit (iOS)** — confirmed directly from Apple's docs ([HealthKit](https://developer.apple.com/documentation/healthkit), [Setting Up HealthKit](https://developer.apple.com/documentation/healthkit/setting-up-healthkit)) — exposes: steps/distance/calories, heart rate (incl. irregular-rhythm notifications), sleep analysis, workouts (type/duration/calories/distance), body measurements (weight, height, BMI, body fat), and vitals (blood oxygen, blood pressure, body temperature). Apps request authorization **per data type** (read and/or write), gated by specific `Info.plist` usage strings and a HealthKit entitlement. Apple Watch data flows into HealthKit automatically — no separate Watch integration needed.

**Google Health Connect (Android)** — confirmed directly from Google's docs ([Health Connect overview](https://developer.android.com/health-and-fitness/guides/health-connect), [Get Started](https://developer.android.com/health-and-fitness/health-connect/get-started)) — is **the unified replacement for the now-deprecated Google Fit APIs** ("Google Fit support ends in 2026" — any new Android work should target Health Connect directly). It covers activity/exercise, cardiovascular (HR, BP, SpO₂), body measurements, sleep, even mental-health metrics (mindfulness/stress) and skin temperature, and as of Android 16 has started supporting **FHIR-formatted medical records** — a sign the platform is moving toward clinical-grade data over time. On **Android 14+ it's built into the OS**; Android 13 and below requires users to separately install the Health Connect app.

**Wearable-specific APIs** (a separate, higher-effort integration layer):
- **Fitbit Web API**: relatively open OAuth2-based access for steps/HR/sleep/activity/weight, but **production-level access historically requires app review/approval**, and — critically — **the legacy Fitbit Web API is being deprecated/migrated through 2026**, with developers pointed to Google's unified Health API as the forward path.
- **Garmin Connect / Health API**: requires a **formal partner application and Garmin's approval** — "longer application processes... manual reviews... commercial use requires a license fee or minimum device order quantity." A meaningfully heavier gate than Fitbit.
- **Whoop / Samsung Health**: similar registration/approval gates; notably, **much Samsung Health data already flows into Health Connect** on modern Android, meaning a direct Samsung integration may be largely redundant once Health Connect is wired up.

**Practical implication**: HealthKit + Health Connect alone cover the large majority of useful data for the most common devices (iPhone/Apple Watch and most Android phones, including data that companion apps like Samsung Health and newer Fitbit/Garmin integrations write into Health Connect). Going *directly* to vendor APIs is a separate, partner-gated, higher-effort layer that mainly buys you users who don't sync through the OS-level platforms.

### Costs
| Platform | Cost | Approval needed? |
|---|---|---|
| **HealthKit** | Free (covered by the $99/yr Apple Developer Program) | No partnership; standard entitlement + usage strings, but App Review scrutinizes health apps closely |
| **Health Connect** | **Confirmed free directly from Google's docs** ("No costs are associated with using Health Connect") | No partnership; standard Play policy + health-data-type declarations |
| **Fitbit Web API** | Free at the access-tier level | **Yes** — production review/approval gate, plus a 2026 migration in progress |
| **Garmin** | Free evaluation tier; **commercial use requires a license fee or device-order minimum** | **Yes** — formal partner application |
| **Whoop / Samsung** | Registration/approval-gated | Likely yes |

For broader context, agency-built mHealth integrations are quoted at **$15,000-$30,000** for basic HealthKit/Health Connect work, **$50,000-$150,000** for normalized multi-device integration (50+ wearables), and **$200,000-$500,000+** for enterprise-grade FHIR/HIPAA/FDA-level builds, with annual maintenance at 15-25% of build cost — useful as a signal of *genuine technical complexity* (not a quote a solo founder should expect to pay; you pay in time, not these dollar figures, when self-building with the existing community libraries). ([premiumappdeveloper.com](https://premiumappdeveloper.com/healthcare-app-development-cost-2026/))

### Compliance — what's actually required (this is the part to take seriously)
Confirmed directly from Apple's and Google's own developer documentation:
- **Apple Guideline 5.1.3** explicitly **prohibits using HealthKit-derived data for advertising, marketing, or data mining** — permitted uses are limited to health management, consented research, and direct user benefit. This needs to be reflected explicitly in FitPath's privacy policy and internal data-handling rules the moment HealthKit is integrated.
- Apps **must not store personal health information in iCloud**, and **must not write false/inaccurate data** into HealthKit.
- **Guideline 1.4.1**: no claiming to *measure* health metrics from device sensors without regulatory clearance — display synced data, don't claim to generate it.
- **Google Health Connect** technically *enforces* a privacy-policy requirement at the permission-screen level — apps must implement a `PermissionsRationaleActivity` describing exactly how health data is used, and must **declare every health data type they read/write in the Play Console**, matching the privacy policy precisely.
- **Across both platforms**: explicit, granular, purpose-limited consent; minimal-necessary permission requests (ask for *steps and sleep*, not blanket "all health data"); and a privacy policy specific enough to survive platform review — not generic boilerplate. This is a genuinely reviewed compliance surface, not a checkbox — **budget real implementation time for the disclosure flows themselves**, and note that HIPAA itself is likely *not* a strict legal requirement for a consumer wellness app (it generally applies to covered entities/business associates), though its underlying principles (encryption, access logs, breach plans) remain good practice and overlap with the prior roadmap's compliance work (doc 01).

([App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), [Health Connect overview](https://developer.android.com/health-and-fitness/guides/health-connect))

### Technical complexity from React Native
The standard approach is the community libraries `react-native-health` (HealthKit) and `react-native-health-connect` (Health Connect) — these wrap the native authorization/read/write APIs in a JS-callable interface. Using them with Expo typically requires a **config plugin** (to inject native entitlements/manifest entries) or ejecting to bare workflow — meaningfully more involved than installing a typical pure-JS package, since it touches native project files. *(Verify current maintenance status of these specific libraries before committing — community npm packages can go stale.)* The genuinely hard part isn't calling the API — **it's the permission UX and data architecture**: granular per-type consent flows, graceful handling of partial/denied permissions, background sync scheduling, deduplication when multiple sources report the same metric (e.g. phone + watch both reporting steps), and reconciling Apple's and Google's different data models into one unified internal schema for Supabase.

### Recommended phased approach
1. **Phase 1 (pair with the mobile beta or shortly after)**: **read-only** sync of the highest-value, lowest-compliance-risk metrics — **steps, workouts, weight, sleep** — via HealthKit + Health Connect, behind one unified internal data model, with the privacy policy/disclosure flows built *as part of* this phase (it's a hard gate, not an afterthought).
2. **Phase 2 (after Phase 1 is stable with real users)**: add **heart rate and blood oxygen** sync (staying in "display synced data," never "measuring" framing) and **write-back** (logging FitPath-completed workouts into Health/Health Connect — a strong engagement feature, but adds attribution/dedup complexity).
3. **Phase 3 (only with clear demand and budgeted partner-approval lead times)**: direct Fitbit/Garmin/Whoop integrations — separate OAuth flows, weeks-to-months approval processes, ongoing API maintenance as vendor programs change. A genuinely separate Apple Watch/Wear OS companion app is its own platform investment, best deferred well beyond the initial beta.

---

## Part C: Reporting/Dashboarding on Wearable Data (Ticket #6)

Naturally **sequenced after** Part B's Phase 1 — there's nothing to report on until sync exists. Once it does:
- Generalize the `<MetricChart>` concept proposed in the prior roadmap's tracking/reporting plan (`docs/planning/03-tracking-vitals-dashboards-profile.md`) — wearable-sourced metrics (resting HR, sleep stages, step trends, workout load) are simply more "metric types" feeding the same Recharts-based infrastructure.
- The genuinely new design problem is **provenance and trust**: clearly distinguish manually-entered data from auto-synced data (users care, and it interacts with the "vitals can't be updated" integrity rules from doc 03 — synced data has a different correction/dedup model than manual entries).
- Consider **cross-referencing synced data against the AI-generated plan** — *"Your phone shows 5.5 hrs of sleep — your plan recommends 7-8. Want to adjust your evening routine?"* This is the point where wearable integration stops being a vanity dashboard and starts closing the loop with the AI plan core (and connects naturally to the "auto plan adjustment" idea in doc 03 of this folder).

---

## Sources
- [React Native — Getting Started](https://reactnative.dev/docs/getting-started)
- [Apple Developer Program — What's Included](https://developer.apple.com/programs/whats-included/)
- [Apple App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple — TestFlight Overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)
- [Apple — HealthKit Documentation](https://developer.apple.com/documentation/healthkit)
- [Apple — Setting Up HealthKit](https://developer.apple.com/documentation/healthkit/setting-up-healthkit)
- [Apple — Registering Your App with APNs](https://developer.apple.com/documentation/usernotifications/registering-your-app-with-apns)
- [Android — Health Connect Overview](https://developer.android.com/health-and-fitness/guides/health-connect)
- [Android — Health Connect Get Started Guide](https://developer.android.com/health-and-fitness/health-connect/get-started)
- [Android — Notification Permission (POST_NOTIFICATIONS)](https://developer.android.com/develop/ui/views/notifications/notification-permission)
- [Supabase: Native Mobile Deep Linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking)
- [The Debuggers: Cross-Platform App 2026 — Flutter, React Native, or Capacitor](https://thedebuggersitsolutions.com/blog/cross-platform-app-2026-flutter-react-native-capacitor)
- [premiumappdeveloper.com: Healthcare App Development Cost 2026](https://premiumappdeveloper.com/healthcare-app-development-cost-2026/)

*Note: API deprecation timelines (Fitbit/Google Fit migrations through 2026), Android closed-testing thresholds, and developer-program costs are time-sensitive and have moved recently — re-verify directly in the relevant developer consoles immediately before committing engineering time. Community library names (`react-native-health`, `react-native-health-connect`) should be checked for current maintenance status before adoption.*
