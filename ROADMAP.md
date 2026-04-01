# Dreamland - Museum-Quality Roadmap

## Phase 1: Foundation & Polish (COMPLETE)

Migrated from monolithic 1558-line HTML to modern Next.js 15 application:
- TypeScript, Tailwind CSS v4, 15+ reusable React components
- Zustand state management for game state
- CRT shader effects, pixel transitions, particles
- Web Audio API with synthesized 8-bit sounds
- Press Start 2P font, Game Boy green palette

---

## Phase 2: Graphics Overhaul (COMPLETE)

### 2.1 Pixel Art Backgrounds
- [x] 12 authentic 8-bit Game Boy style backgrounds
- [x] Proper green palette (darkest, dark, light, lightest)
- [x] Locations: nursery, kitchen, classroom, bedroom, dorm, office, nice_home, rundown, prison, hospital, bar, park

### 2.2 Character Sprites
- [x] 9 life stage sprites: baby, child (m/f), teen (m/f), adult (m/f), elder (m/f)
- [x] Sprite configuration system mapping ages to sprites
- [x] NPC relationship sprite handling
- [x] CharacterDisplay component with age badge and transitions

### 2.3 Animated Scene Elements
- [x] SceneAtmosphere component with location-specific particles
- [x] Ambient lighting effects per location (gentle-glow, neon-flicker, fluorescent, etc.)
- [x] Mood-based color overlays (danger/success/sad/happy)
- [x] Particle types: dust, sparkle, float, rain, snow

### 2.4 Title Screen & UI
- [x] Pixel art title background (silhouette on path toward horizon)
- [x] DREAMLAND logo in retro pixel style with sparkles
- [x] TitleScreen component with animated menu
- [x] Keyboard navigation support (arrows, WASD, Enter)
- [x] Twinkling stars animation

### 2.5 Integration & Polish
- [x] CharacterDisplay wired into GameWrapper with age transitions
- [x] SceneAtmosphere integrated into game flow
- [x] TitleScreen connected to game wrapper with transition effects
- [x] Mobile-responsive layout with character and stats overlays
- [x] Dream sidebar with life progress indicator

---

## Phase 3: Aging Mechanics & Backend Fixes (NEXT)

### 3.1 Age Jump System
- [ ] Review and fix age jump distribution (currently too aggressive in early years)
- [ ] Ensure more turns during dream-chasing years (18-35)
- [ ] Balance turn frequency across life stages

### 3.2 Death & Close Call Tuning
- [ ] Review close call shield percentages (currently 100/85/55/20)
- [ ] Tune natural death curves for 90+ years
- [ ] Fix any edge cases in mortality system
- [ ] Test age 111 hard cap behavior

### 3.3 Stat Volatility Balance
- [ ] Review effect ranges (-0.40 to +0.40)
- [ ] Ensure stats don't yo-yo too dramatically
- [ ] Test extreme stat scenarios

### 3.4 Parent Death Modeling
- [ ] Review probability curve (currently 3% at 4, 60% at 40)
- [ ] Ensure organic parent death timing
- [ ] Test edge cases

### 3.5 Session & Analytics
- [ ] Review session TTL (currently 2 hours)
- [ ] Test prefetch cache behavior
- [ ] Verify analytics tracking

---

## Phase 4: Experience Enhancement

### 4.1 Mobile-First Redesign
- [ ] Touch-optimized controls with haptic feedback
- [ ] Portrait/landscape adaptive layouts
- [ ] PWA support with offline play capability
- [ ] Install prompt for home screen

### 4.2 Social & Sharing Features
- [ ] Life Story Generator: shareable image/card
- [ ] Obituary Page: public URL for completed lives
- [ ] Social sharing (Twitter/X, Instagram Stories)
- [ ] Comparison mode against others

### 4.3 Accessibility (WCAG AA)
- [ ] Full keyboard navigation
- [ ] Screen reader support with ARIA labels
- [ ] High contrast mode
- [ ] Reduced motion option
- [ ] Font size controls

### 4.4 Localization
- [ ] i18n infrastructure
- [ ] Initial languages: English, Spanish, French, Japanese, Chinese

---

## Phase 5: Museum Installation Features

### 5.1 Kiosk Mode
- [ ] Auto-start on idle
- [ ] Attract screen with animated life montages
- [ ] Session timeout with graceful reset
- [ ] Admin panel for museum staff
- [ ] Usage analytics for museum reporting

### 5.2 Installation Art Features
- [ ] Big Screen Mode: Optimized for 4K displays
- [ ] Sound design for gallery environment
- [ ] Multiple simultaneous players (video wall)
- [ ] Collective visualization of all visitors' lives

### 5.3 Exhibition Integration
- [ ] QR code to continue at home
- [ ] Email life story to yourself
- [ ] Printed souvenir card option

---

## Phase 6: Community & Scale

### 6.1 Multiplayer & Community
- [ ] Spectator mode
- [ ] Life challenges (weekly prompts)
- [ ] Community leaderboards
- [ ] Hall of Fame

### 6.2 Content Expansion
- [ ] Era selection (1920s, 1960s, 1990s, 2020s, 2050s)
- [ ] Starting condition presets
- [ ] Guest writers for narrative variations
- [ ] Cultural consultants

### 6.3 Platform & Distribution
- [ ] iOS/Android native apps
- [ ] Steam release
- [ ] Museum licensing package
