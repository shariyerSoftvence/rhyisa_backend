# Health & Wellness Platform — Comprehensive Project Flow Documentation

## 1. Project Overview & Vision

This platform is a unified, preventative healthcare ecosystem that bridges the gap between individual health tracking, professional wellness services, and future corporate/insurance integrations. As emphasized by the client, **"This is NOT just a fitness app."** It combines:
- Personalized user health tracking
- AI-powered health coaching (acting like a smart, proactive assistant)
- A "Fiverr-style" provider marketplace and service matching
- In-app payment and subscription management (via Stripe Connect)
- Secure, user-controlled data sharing
- Comprehensive admin financial and provider management

The platform is designed for a **Three-Player Ecosystem**:
1. **Individual Users (Consumers):** Seeking health guidance, tracking daily metrics, and hiring professionals.
2. **Providers (Health/Wellness Professionals):** Offering services, tracking client progress, and earning via the platform.
3. **Admin / Platform Operations (and Future Insurance):** Managing operations, revenue, compliance, and eventually integrating with insurance companies for preventative healthcare monitoring.

> **Note:** Screen-sharing functionality has been explicitly excluded from the current project scope. All other workflow elements are included.

---

## 2. The Three-Player Ecosystem Flow

```mermaid
graph TD
    A([👤 User / Consumer]) -->|Pays subscription & provider fees| B([🏥 App Platform])
    C([🩺 Provider / Health Professional]) -->|Pays commission split| B
    D([🏢 Insurance Company (Future)]) -->|Pays bulk/umbrella deal| B
    B -->|AI recommendations + reports| A
    B -->|Client data reports + earnings| C
    B -->|Proven user health improvement data| D
    A -->|Approves data access| C
```

---

## 3. User Journey (Consumer Flow)

### A. Onboarding & Health Profile Setup
- **Registration:** Users install the app and create an account (Email/Google).
- **Mandatory Health Profile:** 
  - Age, Height, Weight, Waist size
  - Body type, average fat level
  - Health conditions & Lifestyle information
  - Short-term & Long-term goals (typed or spoken to AI)
- **Optional:** Take a body photo at signup (prominent privacy/security notice displayed).
- *System Action:* Profile data is stored, initiating the AI-generated recommendations and progress tracking.

### B. Daily Health Tracking
Users actively log data via camera, voice, or text:
- Meals, Calories, and Macronutrients
- Water intake
- Weight updates (prompted weekly via notifications)
- Physical activity and daily habits

*System Action:* The system calculates calorie surplus/deficit, weight projection, goal progress, and health trends. 

### C. AI Health Coach Interaction
The AI acts as a proactive health assistant ("an annoying mom behind your ear").
- **Capabilities:** Frequent reminders, smart recommendations, habit tracking, health nudging.
- **Example AI Logic:** 
  - *User eats above calorie target (e.g., 1,200 surplus).*
  - *AI responds:* "You exceeded your calorie target today. Tomorrow, aim for 1,800 kcal to stay on track."
- **Nudges:** "Drink more water," "You are progressing toward your goal."

### D. Free vs. Premium Subscription ($8.99/mo)
- **Free Version:** Basic tracking (calories, limited AI), 1 recommendation/day, basic monitoring.
- **Premium Version ($8.99/mo):** 
  - Triggered via strategic upgrade prompts during usage.
  - Features: Full weekly/monthly health analytics, 5–10 AI recommendations/day, full calorie surplus/deficit analysis, detailed progress charts, and **access to professional health providers**.

### E. Provider Connection & Collaboration
1. **Browse & Hire:** Premium user selects a provider and books a service.
2. **In-App Payment:** User pays via the in-app Stripe system.
3. **Data Access Request:** Provider sends a request to view user analytics.
4. **User Approval:** User explicitly approves access to reports.
5. **Collaboration:** Provider and user communicate via in-app chat, voice calls, and video meetings (all within the app ecosystem).

---

## 4. Provider Journey (Professional Flow)

### A. Registration & Onboarding
- **Profile Setup:** Providers input specialization, location, bio, and upload professional credentials (certifications, driver’s license).
- **Payment Setup:** Providers input bank information directly into the app (via Stripe Connect) for payouts.
- **Agreements:** Providers digitally sign (e-sign) a commission agreement (flat fee or revenue share).
- *System Action:* Profile submitted for Admin approval.

### B. Provider Dashboard
- **Overview:** Total appointments, upcoming sessions, ratings, total earnings.
- **Client Management:** Active clients list, booking history, and services management (pricing/duration).
- **Client Data Access:** Can view AI-generated user progress reports, weight changes, nutrition tracking **(only after explicit user approval)**.
- **Communication:** Tools to offer advice, recommendations, remote health monitoring via chat, voice, and video.

### C. Automatic Revenue Distribution
- Earnings are automatically tracked and disbursed via Stripe Connect.
- Real-time notifications of payments and platform fee splits.

---

## 5. Admin & Operations Flow

### A. Admin Dashboard
- High-level oversight: Total users, providers, insurance partners, revenue overview.
- Revenue charts (daily/weekly/monthly), recent signups.

### B. Platform Management Controls
- **User Management:** View, edit, suspend users.
- **Provider Management:** Approve/deny credentials, suspend providers.
- **Financial Dashboard:** P&L reporting, cash flow analysis, transaction history, financial statements.

### C. Commission Management System
- Admins configure the platform fee structure.
- **Options:** 
  - **Flat Fee:** (e.g., Platform takes $10, Provider gets $70 from an $80 booking).
  - **Percentage Split:** (e.g., Platform takes 10% of session charge).
- Configurable as a global default, with per-provider custom overrides.

---

## 6. Payment & Revenue Architecture

> **Core Requirement:** ALL payment flows must happen **inside the app**. No redirects to external pages.

### A. Stripe Connect Architecture
1. **User Subscription:** User adds credit/debit card, Apple/Google Pay for recurring $8.99/mo premium.
2. **Provider Booking:** User pays for a session.
3. **Auto-Split Routing:** Stripe Connect automatically routes the platform cut to the Admin's bank and the remainder to the Provider's bank account.
4. **Notifications:** Real-time push notifications sent to Admin and Provider for every transaction.

### B. Revenue Streams
1. **User Side:** Recurring premium subscriptions.
2. **Provider Side:** Commission splits (referral fees) on services rendered.
3. **Future (Insurance Side):** Bulk deals for anonymized health improvement data.

---

## 7. Security, Privacy & Data Access Rules

The client heavily emphasized privacy, security, and legal protection.

### A. Controlled Data Access
- **Explicit Consent:** Users must explicitly approve provider access before *any* data is shared.
- **Report-Only Access:** Providers can only access analytics and statistical reports.
- **Photo Privacy:** User photos are **NEVER** shared automatically. Providers cannot access user photo albums. Photos are only shared if the user manually sends them via in-app chat.

### B. Security Messaging & Compliance
- **Fine-print notices:** Visible during signup, uploads, and data entry.
- **Example Copy:** "Your personal information is 100% secure."
- **Communication Logging:** All text, voice, and video communication is strictly kept within the app for legal logging and ecosystem retention.

---

## 8. Future Roadmap

### A. Insurance Integration
- **Vision:** Transform the app into a preventative healthcare ecosystem.
- **Business Model:** Insurance companies mandate the app for members to reduce claims, purchasing enterprise access to monitor broad health improvements. Currently, insurance transactions occur outside the app, but will eventually be brought in-app.

### B. Social & Reviews
- **Current:** Users can leave Fiverr-style reviews for providers within the app.
- **Future:** Potential for social media sharing/integration, but strictly avoiding becoming a full-fledged social media platform.
