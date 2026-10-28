# Phoenix — Feature Map for Manual Review

Expo Router (React Native) app · UI language: French (with English leaks) · Dark-first purple→pink brand (`#8E2DE2 → #FF2E93`) · TanStack Query + Zustand + Socket.IO.
Brand shown in UI: **"Chuyassi Emmanuel CE"** (single-artist app).

---

## 1. App shell & navigation

- **Root layout** — Splash held until auth restore + download hydration; header-less stack of `(auth)` and `(tabs)`; global `CallOverlay` mounted above everything so calls work from any screen; `AppLockGate` mounted last (see §19) so a locked device covers even the call overlay (which also refuses to render while locked).
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

- **Artist page** — 170px gradient hero (banner or flame icon); 80px avatar overlapping the header; name + pink verified checkmark; bio; stats caption; **Suivre/Following** button (owners see a "Gérez votre espace créateur depuis l'onglet Profil." caption — no direct studio entry); "Titres populaires" with "▶ Tout écouter"; videos section; sections hidden when empty.
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

## 13. Wallet / Pay ("Chuyassi Pay")

- **Flow experience** — the pay routes are a **nested stack (`app/pay/_layout.tsx`)** with their own transition language: every screen **rises softly into place** (`fade_from_bottom`, 340 ms, iOS duration + fade status-bar animation, swipe-back gestures on); send/top-up **push up like sheets** (`slide_from_bottom`); the root stack enters/leaves `/pay` with the same rise. Every pay screen mounts an identical **`PayBackdrop`** (soft purple→pink glow fading out over 280px, scheme-tuned) at the same position, so transitions read as one continuous branded space; in-screen sections keep their staggered FadeIn entrances.
- **Follow graph (user-to-user)** — new `UserFollow` model + `/users` API: `POST/DELETE /users/:id/follow` (idempotent, returns `{isFollowing, isMutual}`; self-follow 400, unknown target 404) and `GET /users/following`. Wallet recipients merge **mutual follows first**, then one-way follows, then chat contacts/recent counterparties — every entry carries `isFollowing`/`isMutual`; **with a search term, trigram matches win outright**. Send list rows show a **Suivre / Suivi / Mutuel pill** for unfollowed people ("Suivi mutuel" / "Suivi" subtitle otherwise); the transaction detail counterparty card has the same follow toggle; **follow actions reflect optimistically in all cached lists**. Payments are not hard-blocked for non-mutual contacts.
- **Wallet home** — header is a **close (X) button + "Chuyassi Pay" title** (no overline); **gradient hero card** (decorative translucent circles, flash brand chip, "CHUYASSI PAY" label, **eye toggle hides the balance to "••••••" — persisted in AsyncStorage**, tabular-nums auto-shrinking amount, Recharger + Envoyer as translucent glass pills on the card); **circular quick-action row** (46px discs: Recharger highlighted gradient / Envoyer / Activité / Panier → `/boutique/cart`); **"Envoi rapide" rail** (44px avatars, mutual-follows-first, tap deep-links into `/pay/send` with the recipient preselected; dashed "Nouveau" tile); "Activité récente" (4 latest, tappable → detail) with "Tout voir"; sections stagger-fade in; section titles are subheading-sized (16px).
- **Send money** — **two-stage flow**: (1) destination picker ("Choisissez un contact" header, no balance subtitle) with a **Contacts / Numéro mobile mode toggle**: contacts mode has borderless rows on surface cards, **search bar on `surfaceHighlight` with no border**, "RÉCENTS" rail with 38px avatars, rows show a **Suivre / Suivi / Mutuel pill** for unfollowed people ("Suivi mutuel" / "Suivi" subtitle otherwise) — **follow toggles patch the query cache optimistically so they reflect instantly**; search is **trigram-based server-side (pg_trgm)**, so mistyped names still match, and search matches take priority over the follow/contact suggestions (they used to be pushed out by the 20-item cap — the "search not working" bug). **Phone mode** wires real-world money to **Orange Money / MTN Money numbers**: operator selector (brand-dotted chips), manual number entry (phone-pad, local or +225 format), or **native contact picker (`expo-contacts` — requires a dev-client rebuild)** that prefills the number + contact name; Continuer validates and moves to the amount stage. (2) amount stage: selected-recipient card with "Modifier" jump-back, **big centered amount display with blinking caret and a custom 3×4 keypad** (digits + "000" + backspace, no system keyboard — it yields while the note field is focused), live fr-FR thousand separators, balance caption + inline over-balance warning, quick-amount chips 1k/2k/5k/10k (no "Max"), optional 200-char note; validation integer ≥1 and ≤ balance; dynamic button label "Envoyer {amount}". Phone sends chain initiate → dev-confirm before showing the receipt. **Confirmation screen**: springy check disc, "TRANSFERT RÉUSSI", then a receipt card with Destinataire, **Opérateur + Numéro for phone transfers**, Date, Heure, Référence, Montant/Frais/Total débité, Nouveau solde, note + share button ("Partager le reçu"). **Failure screen**: red disc + "TRANSFERT ÉCHOUÉ" with the server error as message, the **peer summary of the failed attempt**, and Réessayer / Modifier le montant / Retour au portefeuille. Accepts `recipientId/recipientName/recipientImage` params (quick-send deep link skips stage 1).
- **Top-up** — 3-step flow (form → pending → done); big centered amount input with live separators; amount ≥ 100 FCFA with inline error; **preset chips** 1k/2k/5k/10k/25k/50k; info card discloses "Mode démo : la confirmation est simulée côté serveur"; **animated success** ("RECHARGEMENT RÉUSSI", "+{amount}" in green, new balance) + reference card with StatusChip; back from done goes to the wallet.
- **Transactions** — filter chips: Tout / Rechargements / Envoyés / Reçus (server-refetch on change); **month summary strip** (Ce mois · entrées / sorties, computed from the loaded page, "Tout" filter only); **date-grouped sections** (AUJOURD'HUI / HIER / "Lundi 12 mai"); **pull-to-refresh** (the only list in the app with it); **rows tap → detail screen**.
- **Transaction detail (`/pay/transactions/[id]`)** — wired to the previously-unused `GET /wallet/transactions/:id`: 48px avatar/icon hero, label, big signed amount, StatusChip (Succès / En attente / Échoué), long fr-FR date; details card surfaces **`note`, `balanceAfter`, reference and paired `transferRef`** (all previously never displayed); counterparty card (32px avatar, "Suivi mutuel"/"Suivi" subtitle) with a **Suivre/Suivi/Mutuel follow toggle**.
- **Transaction row** — counterparty 36px avatar for transfers / 36px tinted icon tile for topups; title = name (or type label), subtitle = type · time (HH:MM today, else "12 mai"); **discreet 13px/600 signed amounts (+ green / − muted grey)**; amber "En attente" badge on pending; pressable when given `onPress`.
- **Shared wallet kit (`src/components/wallet-ui.tsx`)** — FadeIn (staggered entrances), QuickAction (46px discs), GlassButton, Chip, QuickRecipient (44px avatars, size prop), SectionHeader (subheading), SuccessHero (spring check + fade, success/danger tones), PeerFlow (sender→recipient avatars), AmountKeyboard (custom 3×4 numeric keypad), SummaryRow, StatusChip, FollowButton (Suivre/Suivi/Mutuel pill).
- **Mobile money phone transfers** — `PHONE_TRANSFER` ledger type + `MobileMoneyProvider` enum (ORANGE_MONEY / MTN_MONEY) with `phone_number`/`provider` columns; `POST /wallet/phone-transfers` {phoneNumber, provider, amount, note?}. **A registered number is a wallet address**: when it belongs to another user's payment method the money lands instantly as a paired internal transfer (counterparty set, provider/number stamped on the sender's leg); otherwise a **PENDING** external wire is created (fail-fast balance check, separators normalized); `POST /wallet/phone-transfers/:reference/dev-confirm` is the provider-webhook stand-in: atomic conditional decrement → SUCCESS (idempotent, insufficient balance → 422 while staying PENDING). Sending to your own registered number is a cash-out wire. **No real operator is wired** — the dev confirm simulates the webhook.
- **Moyens de paiement (`/pay/methods`)** — new `PaymentMethod` model (**globally-unique `phone_number`** — a number is one owner; first method becomes default). CRUD: `GET/POST /wallet/methods`, `DELETE /wallet/methods/:id` (204), `PATCH /wallet/methods/:id/default` (returns the refreshed list; duplicates or taken numbers → 409). Screen reachable from the **wallet hub's new "Paiement" quick action** and a **profile-tab row** (live method count): registered numbers with provider dots + a PAR DÉFAUT badge (tap to promote, trash to delete with confirm), an add form (operator chips + number) and a "your number is your address" explainer. The send screen preselects the default method's operator.
- **Backend behaviors behind these screens** — lazy wallet creation; PENDING topup credited only on confirm (idempotent, webhook-ready) with dev-confirm shortcut; atomic P2P transfer (self-transfer blocked, row locking, insufficient-balance 422, paired ledger entries sharing a transferRef); recipient list merges the follow graph + chat contacts + search; transaction detail counterparty carries follow state; payment service supports categories/services with dynamic fields, FIXED/FREE pricing, webhook confirm → receipt generation → order fulfillment (`markPaid`). **No payment provider is wired** — hence checkout polling + dev confirms.

## 14. Notifications

- Placeholder screen: back button + title + a permanent empty state ("Aucune notification"). Backend has no list endpoint yet; only push-to-chat exists. No pull-to-refresh, no list, no filters.

## 15. Premium / subscriptions

- **Screen** — gold hero card (star, brand name); non-subscriber: gold-bordered plan card "Abonnement mensuel" + "SANS ENGAGEMENT" badge + price in gold; 4 feature rows (artist page access, downloads, offline playback, **"1 FCFA/mois reversés à l'artiste"** per-download royalty); "S'abonner — {price}/mois" CTA.
- **Active state** — swap to status card ("Abonnement actif", renewal date in fr-FR) + royalty usage card (downloaded tracks / dû ce mois-ci / total versé) + "Se désabonner" secondary button.
- **Flows** — subscribe: login-gate Alert if signed out → API call → success Alert; errors via **Alert dialogs, no inline UI**. Cancel: confirm Alert with "Garder mon abonnement" / "Annuler l'abonnement".
- **Hardcoded fallbacks** (2500 XOF/FCFA, royalty 1) render before data loads; **subscribe API returns a payment transaction that the UI discards — subscribing appears free/instant, no payment step** (single tier, no plan chooser, no trial/proration). API also exposes listener royalty history + artist earnings — **neither is surfaced in any screen**.

## 16. Creator Studio

- **Access** — entry points live **only on the Profile tab** (studio row + analytics preview, both gated behind the ARTIST role); the artist page shows owners a caption pointing at the profile instead, and the studio route itself **bounces non-artists back to the profile tab** (guards deep links/back-stack).
- **Studio dashboard** — custom back arrow (bare `AppText`, not an IconButton — a11y gap); ContextMenu with "Modifier le profil"; **6-tile stats grid** (Écoutes, Vues, Téléch., Abonnés, Favoris, Titres — accent-colored values); **hand-rolled 30-day bar chart** with Écoutes/Vues toggle (no animation, no per-bar interaction); "Titres les plus écoutés" top-5 (only if >1 song); dual publish CTAs; "Mes titres (N)" / "Mes vidéos (N)" lists with per-row ⋮ edit (params into forms) + delete (confirm Alert, error Alert on failure); songs play the artist queue, videos navigate.
- **Progressive rendering** — song/video lists appear before stats load; no-artist state shows an **error-style "Vous n'avez pas encore de profil artiste." with no CTA** (onboarding lives in the profile modal).
- **Edit artist profile** — name + bio form; save refreshes the auth session (so the header name updates); **headings/labels in English**; no success toast.
- **Song form (publish/edit)** — audio source: file picker chip (name, size, ✕) **or** HTTPS URL behind progressive-disclosure link; optional artwork (preview, choose/remove); title/genre/album; "Téléchargeable par les fans" switch default **ON**; validation messages in French; audio duration read with a 4s timeout; uploads are sequential with **indeterminate "Envoi des fichiers en cours…" spinner — no percentage, no cancel**.
- **Video form** — mirror of song form (file/URL, poster, title + multiline description, same switch, no duration read).

## 17. Profile tab & creator onboarding

- **Profile tab** — **centered identity header** (reference-style): avatar inside a **brand-gradient ring** with a **CRÉATEUR/AUDITEUR badge straddling the ring** and a camera shortcut, large centered name, muted email, "Membre depuis {mois année}", and a **"Modifier le profil" tinted pill** — all opening the **EditProfileModal**: change display name (≥2 chars) and profile photo (galerie → `expo-image-picker` crop → upload `kind=image` → better-auth `update-user` → session refresh, so chat/wallet/paiements all pick up the new identity; email shown read-only). **Live stats strip** (Suivis → Explore, Favoris → Bibliothèque, Téléch. → Bibliothèque) fed by real query totals; **Portefeuille & achats card** (Chuyassi Pay with live balance → `/pay`, Panier with live item count, Mes commandes with total); premium entry, theme segmented control, audio quality, wi-fi-only downloads, push toggle; settings rows now use **circular icon tiles**; creator section (Studio + artist profile edit + analytics preview, or BecomeArtistModal); followed-artist rows; **sign-out now confirms via Alert**.
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

## 19. App lock (3-day periods)

Every device blocks itself when its own 3-day period lapses, until that moment's 6-character unlock code is entered — including the sign-in screen, and calls can't be placed or answered while locked. **The period is per-device, the code is global**: periods anchor to first use (a fresh install is usable for 3 days, no code needed), while codes rotate globally every 3 days so one code can't unlock a device forever.

- **Codes are derived, not stored** — `appLockService` (`apps/api`) computes `HMAC-SHA256(APP_LOCK_SECRET, "phoenix-app-lock:v1:<windowIndex>")` mapped onto an unambiguous uppercase alphabet (no I/L/O/0/1), where the window is the global 3-day epoch window. Same window → same code for all devices; rotating `APP_LOCK_SECRET` invalidates codes instantly. No database tables involved.
- **Current code for the owner** — `curl -H "x-admin-key: $APP_LOCK_ADMIN_KEY" $API_URL/api/v1/app-lock/code` → `{ code, windowIndex, startsAt, endsAt }`. Constant-time key check; dev fallbacks for both env vars, required in production.
- **Unlock from the device** — `POST /api/v1/app-lock/verify` (public on purpose — the lock gates the login screen too): normalizes input (case-insensitive, strips spaces/punctuation), 401 on a wrong code, per-IP throttle of 10 failures / 15 min → 429, success returns `{ windowIndex, endsAt }` (`endsAt` = when the current global code stops being valid — informational).
- **Device flow** — `useAppLockStore` (MMKV-persisted) anchors each device's period locally: on first use (`firstUsedAt` unset) it grants 3 days from that moment, each successful code entry re-grants 3 days from the unlock moment, and `useAppLock` re-checks `unlockedUntil` on mount, on foreground and every minute — so devices lock at their own dates, not a shared one. Clearing app data / reinstalling restarts the period (device-local anchor); devices updating from the pre-period build are treated as first use. The lock screen (`app-lock-gate.tsx`) shows 6 uppercase cells over a hidden input with auto-submit and shake + error on rejection. `EXPO_PUBLIC_APP_LOCK_DISABLED=1` (inlined at build time) skips the gate in development builds.
- **Tests** — `apps/api/tests/app-lock.test.ts`: admin-key guard, code↔verify round-trip, per-window derivation, input normalization, throttling.
