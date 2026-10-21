# Phoenix — Feature Map for Manual Review

Expo Router (React Native) app · UI language: French (with English leaks) · Dark-first purple→pink brand (`#8E2DE2 → #FF2E93`) · TanStack Query + Zustand + Socket.IO.
Brand shown in UI: **"Chuyassi Emmanuel CE"** (single-artist app).

---

## 1. App shell & navigation

- **Root layout** — Splash held until auth restore + download hydration; header-less stack of `(auth)` and `(tabs)`; global `CallOverlay` mounted above everything so calls work from any screen.
- **Tab bar** — 6 tabs: Accueil, Messages, Boutique, Artistes (explore), Bibliothèque, Profil. Auth-gated (redirect to login). Icons switch filled/outline on focus; active tint = accent pink; 60px + safe-area; surface background with hairline top border; 11px/600 labels.
- **Offline banner** — gold strip at top of tabs: "You are offline — events will sync automatically" (English string in a French UI).
- **MiniPlayer** — floating pill docked above the tab bar on every tab (`bottom: 66 + insets`); 3px brand-gradient progress line across its top; 44px artwork, title, artist · time/duration; play/pause + skip-forward; tap body → Now Playing. No swipe-to-dismiss, no swipe-to-expand, no seek, no previous button.
- **Realtime plumbing** — Socket.IO while signed in (cookie session auth, websocket-only, reconnect 1s→10s): incoming messages invalidate conversation caches live; offline event queue flushes on reconnect/foreground; push notifications registered/unregistered on sign-in/out; tap deep-links to `/chat/{id}` (messages) or Messages tab (calls); cold-start taps during auth restore are ignored.
- **Query config** — staleTime 60s, retry 1, no refetch-on-focus, network status wired to `expo-network`.

## 2. Theme & design system (`src/theme`, `src/components/ui`)

- **Theme** — `system | dark | light` persisted in AsyncStorage, default system. Dark: bg `#0A0914`, surface `#151225`, elevated `#1E1B33`, text `#F4F2FF`, primary `#8E2DE2`, accent `#FF2E93`, gold `#FFC24B`, danger `#FF4D67`, success `#37D99A`. Light palette mirrors it. Gradients: `brand` (purple→pink), `brandDeep` (deep purple→black, full-bleed headers/player), `premium` (gold). Scheme-aware boxShadow presets + colored glows under gradient elements.
- **Typography scale** — title 26/800, heading 20/700, subheading 16/600, body 15, caption 13, small 11 (negative letter-spacing on headings).
- **`PressableScale`** — signature pressable: interruptible spring scale (default 0.97) used everywhere.
- **Button** — 48px pill; primary = brand gradient + glow; secondary/danger/ghost variants; inline loading spinner.
- **IconButton** — 40px round, optional tinted disc, legacy glyph→Ionicons map.
- **Input** — 48px pill field. **Card** — surface, radius 22, hairline border + shadow (iOS-settings grouped style).
- **State components** — `LoadingView` (pink spinner + label), `ErrorView` ("Something went wrong" + "Try again" — English), `EmptyView` (title + subtitle, no illustrations), `OfflineBanner`, `ProgressBar` (4px pill), `ContextMenu` (⋮ opens a centered modal card over a scrim, destructive rows in red).

## 3. Auth (`app/(auth)`)

- **Login** — email + password (Better Auth); trimmed email; inline red error under fields; button-level loading; redirects to `(tabs)`. Placeholder-only inputs (no labels). KeyboardAvoidingView + keyboard-persist taps. Modern tech-styled form card (labeled fields, show/hide password, French copy, footer copyright).
- **Register** — name/email/password; client validation: name ≥ 2 chars, password ≥ 8 chars (validation messages in **English** despite French UI); no email format validation client-side; French headline, English cross-link label.
- **Auth guard** — logged-in users redirected away from auth screens; `(auth)/index` is a pure redirect to login.

## 4. Home tab (`Accueil`)

- **Greeting header** — uppercase French date + "Bonjour/Bonsoir, {first name}"; bell button (44px circle) → Notifications.
- **Tendances** — horizontal scroll of 116px square song cards; tap plays the popular queue at that index; hidden when empty.
- **Actions rapides** — 4 shortcuts: Payer (gradient-highlighted tile → `/pay`), Reçus (`/pay/transactions`), Panier (`/boutique/cart`), Premium (`/premium`).
- **New releases** — horizontal scroll of 10 bare 120px artwork tiles (no text, no play action).
- **Popular right now** — top-5 as rows with favorite hearts + play buttons (queue).
- **Artistes à suivre** — horizontal rail of up to 8 circular 80px avatars → artist pages.
- Loading = full-screen pink spinner; error = retry. Bottom padding 180 everywhere to clear MiniPlayer + tab bar.

## 5. Explore tab ("Artistes")

- **Search** — one debounced (350ms) search box drives all three segments ("Rechercher artistes, musiques, vidéos…").
- **Segmented control** — Artistes / Musique / Vidéos in a tinted pill container; active = solid purple pill, white text.
- **Artistes** — card rows (56px avatar, name, "X followers · Y titres"); artist filtering is **client-side** on the loaded list.
- **Musique** — top 30 by playCount or search results; tap plays the visible list as a queue; hearts shown.
- **Vidéos** — top 20 by viewCount or search results; tap → video detail page (no inline play).
- Per-tab loading/error/empty states, contextualized to search vs browse.

## 6. Library tab (`Bibliothèque`)

- **Section chips** — Favorites / Playlists / Downloaded music / Downloaded videos; single-select pill chips.
- **Favorites** — mixed songs+videos; tapping a song plays the entire favorites list as a queue; videos navigate to detail. Optimistic heart toggle with rollback.
- **Playlists** — inline create form (autofocus input + Create/Cancel); playlist cards with generated gradient artwork; ⋮ delete **without confirmation** (inconsistent with playlist detail, which confirms). No rename in list (rename lives in detail).
- **Downloads** — local downloads store; rows show "offline"; tap plays all downloaded songs as an offline queue; per-row red trash deletes **immediately, no confirm**; empty states instruct via ⋮ menu.
- **Download engine (background)** — real 0..1 progress; requires an active subscription (gate alert routes to `/premium`); a lapsed subscription deletes local copies; interrupted downloads marked failed on hydrate; **pause is fake** (UI state only, no real task pause); completed downloads hot-swap the current track from stream to local file.

## 7. Music playback

- **Player engine** — single global `AudioPlayer`; one queue (`playQueue(queue, index)`, `playSingle`); background playback; `doNotMix`; auto-advance on track end (no repeat/shuffle anywhere); `previous()` restarts the track if >3s in; every play fires an offline-safe analytics event; prefers downloaded local file over stream (Now Playing shows "LECTURE HORS LIGNE").
- **Mini player** — see §1.
- **Now Playing (`/song/[id]`)** — full-screen `brandDeep` gradient; chevron-down to collapse; status label: "EN LECTURE" / "LECTURE HORS LIGNE" / "APERÇU" (deep-linked static preview); heart toggle; 280px artwork; tap-to-seek 5px gradient bar (**seek math hardcodes 320pt width — bug on wide screens**); prev/play/next; 76px gradient play disc with glow, dims while buffering; inline "Buffering…" + playback error text; queue section lists all tracks (current highlighted; tap to jump; **no reorder/remove**). No share/lyrics/comments.
- **No shuffle, no repeat, no volume control** in the whole UI.

## 8. Artist / Playlist / Video

- **Artist page** — 170px gradient hero (banner or flame icon); 80px avatar overlapping the header; name + pink verified checkmark; bio; stats caption; **Suivre/Following** button (owner sees "Manage in artist studio"); "Titres populaires" with "▶ Tout écouter"; videos section; sections hidden when empty.
- **Playlist detail** — ⋮ menu with Rename (inline form swap) and Delete (with confirm Alert); "▶ Play all"; per-song ✕ remove; empty state says "Add songs from any ⋮ menu → 'Add to playlist'" — **but no screen ever passes `onAddToPlaylist`, so that action doesn't exist anywhere** (the "Add to playlist" menu item is defined but unreachable). No cover art, no reorder, no add-from-library picker.
- **Video detail** — full-width 16:9 `expo-video` player (autoplay, native controls, fullscreen, PiP); floating back chevron; title/meta/description; favorite as a plain text link "♥ In favorites"; one `VIEW` analytics event per visit; **"Up next"**: 2 preview cards that are 180×101 **autoplaying, muted, looping** video players with dark scrim; "More videos": up to 5 rows that navigate. No comments, no share, no download button on the screen itself (only via row ⋮ menus).

## 9. Media rows & artwork

- **MediaRow/InteractiveRow** — 56px artwork, title, "artist · duration · N plays" caption (K/M formatting); heart (pink when active, optimistic); ⋮ ContextMenu: favorites toggle, View artist, Download (only if `isDownloadable` — shows live progress bar + file size, becomes "Delete download", subtitle flips to "available offline").
- **Artwork** — `expo-image` with 150ms cross-fade; deterministic seeded gradient + initials/"♪" fallback from the id (consistent placeholder per item).

## 10. Messages tab & Chat (`SCL`)

> Note: **"SCL" = the messaging + calls module**, not a token/currency.

- **Conversations list** — search box (server-side filter); segmented control "Discussions / Appels"; rows: 52px avatar of other participant, time (HH:MM today, else dd/MM), preview ("Message vocal" + mic icon for voice), unread preview in brighter text; unread badge pink, caps "9+"; new-conversation icon button.
- **Call history segment** — direction arrow (green/red for missed), call/video icon, French status labels ("Appel manqué", "Sans réponse", "Répondu", "En cours…"…), duration; rows are **static — no tap-to-call-back**.
- **New conversation picker** — modal pageSheet; search fires at ≥2 chars; tap creates the conversation and jumps straight into the chat.
- **Chat screen** — header: avatar, name, audio + video call buttons (disabled unless idle); messages infinite-paginated (30/page, loads **older pages on drag-up begin**); day separator chips ("Aujourd'hui", "Hier", dates); burst grouping (same sender within 5 min → 2px spacing, tail bubble gets the 7px corner + avatar).
- **Bubbles** — mine = brand-gradient fill, white text; theirs = elevated surface + hairline border; max width 78%; radius 20 with 7px tail corner; timestamps inside every bubble (10pt tabular-nums); status icons: clock (pending, 70% opacity bubble) → checkmark → double-checkmark (read); failed = amber warning. Only optimistic messages animate (spring fade-in from +14px).
- **Read receipts** — computed from the other participant's `lastReadAt`; **socket `message:read` hook exists but is never wired**, so double-checks can lag until a refetch; mark-read happens when the chat is open and on new messages.
- **Voice messages** — mic button → recording composer (cancel, animated 4-bar equalizer, elapsed timer); <1s recordings silently discarded; permission-denied shows a red rationale banner; uploading disables send; incoming/outgoing render a **VoicePlayer**: 24-bar waveform deterministically hashed from the attachment id (same note = same waveform), played bars fill pink, position/duration readout, expo-audio playback.
- **Not implemented in chat** (types exist, UI doesn't): typing indicators, presence (online-dot component is dead code), replies/quotes, delete/edit, image/video/file messages (a non-voice attachment renders as blank content).
- **Empty state** — personalized: "Envoyez le premier message à {name}."

## 11. Calls (WebRTC)

- **Global CallOverlay** — full-screen fade modal from root layout; Zustand-driven phases (outgoing/incoming/connecting/active/ended); French status chips ("Appel entrant", "Connexion…", live elapsed timer when active); `brandDeep` gradient background; repeating vibration for both ringing directions.
- **Video calls** — fullscreen remote `RTCView`; local PiP preview top-right (110×160); **audio calls** — 110px avatar.
- **Incoming controls** — decline (red 60px) / accept (green 72px, larger). **Active controls** — mic mute (inverts to white/black), camera toggle, flip camera (video), speaker toggle via InCallManager (audio), red hang-up.
- **Signaling** — Socket.IO (`call:start` 10s timeout → "Le correspondant est injoignable", accept/reject/end, offer/answer/ICE); ICE servers fetched from API, cached 10 min, Google STUN fallback; offer created only after accept; busy callers reject duplicate calls; reconnect-safe listener rebinding.

## 12. Boutique

- **Boutique tab** — header with orders + cart icons (cart badge caps "9+"); server-side product search; category chips ("Toutes" + categories); **featured card** for the first product (130px image, DIGITAL/PHYSIQUE overline); 2-column grid tiles with type pill, "Épuisé" banner on sold-out, seeded gradient placeholder when imageless; pressed opacity 0.8.
- **Product detail** — horizontal paging image carousel (400×340) with dot indicators; floating back button; type overline · category; large accent price; seller row with verified checkmark; **stock state card** (sold out / "N téléchargements autorisés" / "N en stock"); variant chips (with priceOverride, disabled "épuisé", tap-to-deselect, price updates); quantity stepper (physical only, capped by stock/99); bottom action bar: "Acheter maintenant" (digital, no variants — add to cart + jump to cart) + "Ajouter au panier"; inline success/error messages.
- **Cart** — "Vider" (clear-all) link in red, **no confirmation**; line rows with 72px thumb, variant line, Digital/Physique tag, trash; steppers capped by stock; sticky subtotal + checkout button; empty state.
- **Checkout — 4-step wizard** with 4-segment progress bar (Infos → Récapitulatif → Paiement → Confirmation). Digital-only carts skip the address form entirely. Address form: 6 fields, validation by gating the Continue button (name/phone/city minimums) — **no per-field inline errors**. Recap: line totals, "Livraison: À confirmer" (shipping never priced client-side), address card with "Modifier" jump-back. **Paiement step is a placeholder**: hourglass, "Paiement en attente", polls the order every 4s and auto-advances when PAID (no provider wired; dev-only confirm endpoints). Confirmation: green check, shipping vs digital wording.
- **Orders** — expandable cards (reference, long French date, total, item preview, status chip with colored dot: green paid/delivered, red cancelled/refunded, warning pending, primary processing/shipped); expanded detail shows items + delivery block; **digital downloads**: "Télécharger" link with count "N/M téléchargements" or "illimités", "Limite atteinte" in red at the cap; downloads into a cache dir then OS share sheet; "Téléchargement…" feedback.

## 13. Wallet / Pay ("CHUYASSI EMMANUEL PAY")

- **Wallet home** — brand header (back + "CHUYASSI EMMANUEL PAY / Portefeuille"); **gradient hero card** (decorative translucent circles, flash brand chip, "CHUYASSI PAY" label, **eye toggle hides the balance to "••••••" — persisted in AsyncStorage**, tabular-nums auto-shrinking amount, Recharger + Envoyer as translucent glass pills on the card); **circular quick-action row** (Recharger highlighted gradient / Envoyer / Activité / Panier → `/boutique/cart`); **"Envoi rapide" rail** (chat contacts + recent counterparties, tap deep-links into `/pay/send` with the recipient preselected; dashed "Nouveau" tile); "Activité récente" (4 latest, tappable → detail) with "Tout voir"; sections stagger-fade in on entry.
- **Send money** — **two-stage flow**: (1) recipient picker: debounced search + "RÉCENTS" avatar rail + full contact rows (avatar, name, chevron; tap → stage 2); (2) amount stage: selected-recipient card with "Modifier" jump-back, **big 40px centered amount input with live fr-FR thousand separators**, balance caption + inline over-balance warning, quick-amount chips 1k/2k/5k/10k + "Max", optional 200-char note; validation integer ≥1 and ≤ balance; dynamic button label "Envoyer {amount}"; **animated success**: springy check disc, "ARGENT ENVOYÉ" overline, "−{amount}", "{name} a bien reçu votre envoi." + new balance, "Envoyer à nouveau" (returns to amount stage) / "Retour au portefeuille". Accepts `recipientId/recipientName/recipientImage` params (quick-send deep link skips stage 1).
- **Top-up** — 3-step flow (form → pending → done); big centered amount input with live separators; amount ≥ 100 FCFA with inline error; **preset chips** 1k/2k/5k/10k/25k/50k; info card discloses "Mode démo : la confirmation est simulée côté serveur"; **animated success** ("RECHARGEMENT RÉUSSI", "+{amount}" in green, new balance) + reference card with StatusChip; back from done goes to the wallet.
- **Transactions** — filter chips: Tout / Rechargements / Envoyés / Reçus (server-refetch on change); **month summary strip** (Ce mois · entrées / sorties, computed from the loaded page, "Tout" filter only); **date-grouped sections** (AUJOURD'HUI / HIER / "Lundi 12 mai"); **pull-to-refresh** (the only list in the app with it); **rows tap → detail screen**.
- **Transaction detail (`/pay/transactions/[id]`)** — wired to the previously-unused `GET /wallet/transactions/:id`: avatar/icon hero, label, big signed amount, StatusChip (Succès / En attente / Échoué), long fr-FR date; details card surfaces **`note`, `balanceAfter`, reference and paired `transferRef`** (all previously never displayed); counterparty card.
- **Transaction row** — counterparty avatar for transfers / tinted icon tile for topups; title = name (or type label), subtitle = type · time (HH:MM today, else "12 mai"); signed tabular-nums amounts (+ green / − default); amber "En attente" badge on pending; pressable when given `onPress`.
- **Shared wallet kit (`src/components/wallet-ui.tsx`)** — FadeIn (staggered entrances), QuickAction, GlassButton, Chip, QuickRecipient, SectionHeader, SuccessHero (spring check + fade), SummaryRow, StatusChip.
- **Backend behaviors behind these screens** — lazy wallet creation; PENDING topup credited only on confirm (idempotent, webhook-ready) with dev-confirm shortcut; atomic P2P transfer (self-transfer blocked, row locking, insufficient-balance 422, paired ledger entries sharing a transferRef); recipient list merges chat contacts + search; payment service supports categories/services with dynamic fields, FIXED/FREE pricing, webhook confirm → receipt generation → order fulfillment (`markPaid`). **No payment provider is wired** — hence checkout polling + dev confirms.

## 14. Notifications

- Placeholder screen: back button + title + a permanent empty state ("Aucune notification"). Backend has no list endpoint yet; only push-to-chat exists. No pull-to-refresh, no list, no filters.

## 15. Premium / subscriptions

- **Screen** — gold hero card (star, brand name); non-subscriber: gold-bordered plan card "Abonnement mensuel" + "SANS ENGAGEMENT" badge + price in gold; 4 feature rows (artist page access, downloads, offline playback, **"1 FCFA/mois reversés à l'artiste"** per-download royalty); "S'abonner — {price}/mois" CTA.
- **Active state** — swap to status card ("Abonnement actif", renewal date in fr-FR) + royalty usage card (downloaded tracks / dû ce mois-ci / total versé) + "Se désabonner" secondary button.
- **Flows** — subscribe: login-gate Alert if signed out → API call → success Alert; errors via **Alert dialogs, no inline UI**. Cancel: confirm Alert with "Garder mon abonnement" / "Annuler l'abonnement".
- **Hardcoded fallbacks** (2500 XOF/FCFA, royalty 1) render before data loads; **subscribe API returns a payment transaction that the UI discards — subscribing appears free/instant, no payment step** (single tier, no plan chooser, no trial/proration). API also exposes listener royalty history + artist earnings — **neither is surfaced in any screen**.

## 16. Creator Studio

- **Studio dashboard** — custom back arrow (bare `AppText`, not an IconButton — a11y gap); ContextMenu with "Modifier le profil"; **6-tile stats grid** (Écoutes, Vues, Téléch., Abonnés, Favoris, Titres — accent-colored values); **hand-rolled 30-day bar chart** with Écoutes/Vues toggle (no animation, no per-bar interaction); "Titres les plus écoutés" top-5 (only if >1 song); dual publish CTAs; "Mes titres (N)" / "Mes vidéos (N)" lists with per-row ⋮ edit (params into forms) + delete (confirm Alert, error Alert on failure); songs play the artist queue, videos navigate.
- **Progressive rendering** — song/video lists appear before stats load; no-artist state shows an **error-style "Vous n'avez pas encore de profil artiste." with no CTA** (onboarding lives in the profile modal).
- **Edit artist profile** — name + bio form; save refreshes the auth session (so the header name updates); **headings/labels in English**; no success toast.
- **Song form (publish/edit)** — audio source: file picker chip (name, size, ✕) **or** HTTPS URL behind progressive-disclosure link; optional artwork (preview, choose/remove); title/genre/album; "Téléchargeable par les fans" switch default **ON**; validation messages in French; audio duration read with a 4s timeout; uploads are sequential with **indeterminate "Envoi des fichiers en cours…" spinner — no percentage, no cancel**.
- **Video form** — mirror of song form (file/URL, poster, title + multiline description, same switch, no duration read).

## 17. Creator onboarding

- **BecomeArtistModal** (from Profile) — full-screen slide modal; gradient pitch hero; 4 benefit rows; artist name (required, French error) + optional bio; "Plus tard" disabled while submitting; refreshes session on success.

## 18. Cross-cutting observations (quick review targets)

1. **Language mix** — French UI with English leaks: ErrorView ("Something went wrong"/"Try again"), OfflineBanner, register validation, edit-profile labels, library section titles, premium a11y label "Back".
2. **"Add to playlist" is advertised but unreachable** (no screen passes `onAddToPlaylist`).
3. **Read receipts lag** — `message:read` socket hook implemented but never subscribed.
4. **Seek-bar bug** — tap-to-seek math hardcodes 320pt width.
5. **Mini player lacks** swipe-dismiss/expand, seek, previous.
6. **No real payment provider** — checkout polls a PENDING order; top-up & bill-pay confirm via dev endpoints (disclosed as "Mode démo").
7. **Premium subscribe is free/instant** in the UI (returned transaction discarded); royalty history & artist earnings APIs unused.
8. **Almost no pull-to-refresh** (the wallet transactions list now has it); loading is always a plain spinner (no skeletons); empty states are text-only.
9. **Downloads**: pause is fake; library-list deletes (playlist, download, cart-clear) skip confirmation while detail flows confirm.
10. **Chat gaps**: no typing indicators, presence (dead code), replies, deletion, image/file messages.
11. **Notifications screen is a stub** (no backend list endpoint).
12. **Accessibility** is mostly good on IconButtons/rows but studio's back arrow and some text-link actions are bare pressables.
13. **Single-artist hardcoding** — brand and artist strings baked into premium/studio copy even though the API supports multiple artists.
