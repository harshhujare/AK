# Bugfix Requirements Document

## Introduction

The AjitSir Academy web application currently suffers from widespread UI inconsistencies that negatively impact user experience, learnability, and trust. Users encounter different visual treatments for the same actions (e.g., login buttons styled three different ways), unpredictable interaction feedback, and inconsistent spacing/typography across pages. This creates cognitive friction, makes the interface harder to learn, and reduces perceived product quality.

This bugfix addresses the systematic UI inconsistency problem by establishing and enforcing a unified design system with consistent spacing scales, typography, button variants, border radii, interactive states, and responsive breakpoints across all components.

**Impact:** Users currently experience confusion when the same action (login) appears with different visual styles, cannot predict hover behavior, and face jarring visual shifts when navigating between pages. This undermines trust and increases cognitive load.

**Root Cause:** Lack of a centralized design system with defined tokens and component variants. Each component was styled independently without reference to shared standards.

---

## Bug Analysis

### Current Behavior (Defect)

#### 1. Inconsistent Button Styles

1.1 WHEN a user views the login button in the navbar THEN the system displays a border-style button (`.navbar-login-btn` with `border: 1px solid var(--border-strong)`)

1.2 WHEN a user views the login button on the homepage hero THEN the system displays a filled background button (`.btn-primary` with `background: var(--accent-bg)`)

1.3 WHEN a user views the login button in the mobile menu THEN the system displays a filled background button (`.mobile-menu-login-btn` with `background: var(--accent-bg)`)

1.4 WHEN a user hovers over different buttons THEN the system applies inconsistent feedback (some use opacity changes, some use background color changes, some use transform animations)

#### 2. Inconsistent Spacing & Padding

1.5 WHEN a user views navbar elements THEN the system applies padding of `0.4rem 1rem`

1.6 WHEN a user views note cards THEN the system applies padding of `1.5rem`

1.7 WHEN a user views admin nav items THEN the system applies padding of `0.6rem 0.75rem`

1.8 WHEN a user views the login card THEN the system applies padding of `2.5rem 2rem`

1.9 WHEN spacing is applied across components THEN the system uses arbitrary values instead of a consistent spacing scale (4px/8px grid system)

#### 3. Inconsistent Border Radius

1.10 WHEN a user views navbar elements THEN the system applies `border-radius: 8px`

1.11 WHEN a user views note cards THEN the system applies `border-radius: 16px`

1.12 WHEN a user views the login card THEN the system applies `border-radius: 20px`

1.13 WHEN a user views subject filter chips THEN the system applies `border-radius: 9999px` (pill shape)

1.14 WHEN a user views admin sidebar items THEN the system applies `border-radius: 8px`

#### 4. Inconsistent Typography Scale

1.15 WHEN a user views the hero title THEN the system displays font size `clamp(2rem, 5vw, 4rem)`

1.16 WHEN a user views section titles (Notes, About) THEN the system displays font size `2.5rem`

1.17 WHEN a user views the login title THEN the system displays font size `2rem`

1.18 WHEN a user views admin brand text THEN the system displays font size `1rem`

1.19 WHEN typography is applied THEN the system uses arbitrary font sizes without a modular scale system

#### 5. Inconsistent Interactive States

1.20 WHEN a user hovers over navbar links THEN the system changes color and background

1.21 WHEN a user hovers over the primary button THEN the system changes opacity to `0.9`

1.22 WHEN a user hovers over note cards THEN the system applies `transform: translateY(-2px)` and changes background/border

1.23 WHEN a user hovers over admin nav items THEN the system only changes background and color without transform

1.24 WHEN a user interacts with different elements THEN the system provides unpredictable feedback patterns

#### 6. Inconsistent Focus States

1.25 WHEN a user navigates with keyboard to interactive elements THEN the system shows inconsistent or missing focus indicators

1.26 WHEN a user tabs through the navbar THEN the system may not provide visible focus states on all interactive elements

1.27 WHEN a user tabs through note cards THEN the system may not provide WCAG-compliant focus indicators

#### 7. Inconsistent Loading States

1.28 WHEN the navbar is loading user data THEN the system shows a skeleton with pulse animation

1.29 WHEN the notes section is loading THEN the system shows skeleton cards with pulse animation

1.30 WHEN the login page is loading THEN the system shows a static skeleton without animation

1.31 WHEN different sections are loading THEN the system uses different skeleton patterns and animations

#### 8. Inconsistent Responsive Breakpoints

1.32 WHEN the viewport width changes THEN the system uses different breakpoints across components (some at `768px`, some at `900px`, some at `480px`)

1.33 WHEN the layout adapts to mobile THEN the system causes layout shifts at inconsistent viewport widths

1.34 WHEN a user resizes the browser THEN the system provides an inconsistent responsive experience

#### 9. Accessibility Issues

1.35 WHEN a user with low vision uses the interface in dark mode THEN the system may display text with insufficient color contrast (text-muted may fail WCAG AA)

1.36 WHEN a user navigates with keyboard THEN the system provides inconsistent or missing focus indicators

1.37 WHEN a screen reader user navigates THEN the system may have inconsistent ARIA label patterns

#### 10. Component-Specific Issues

1.38 WHEN a user views a locked note card THEN the system displays a paywall overlay that blocks the entire card interaction

1.39 WHEN a user scrolls the subject filter horizontally THEN the system provides no visual indicators for scrollability

1.40 WHEN a user opens the navbar dropdown THEN the system uses a different animation than the mobile menu animation

1.41 WHEN a user switches between admin sections THEN the system provides no visual feedback for the active section transition

---

### Expected Behavior (Correct)

#### 1. Consistent Button System

2.1 WHEN a user views any login/CTA button across the application THEN the system SHALL display a consistent button variant from a unified button component system (primary, secondary, ghost, danger)

2.2 WHEN a user hovers over any button THEN the system SHALL apply consistent hover feedback based on the button variant (e.g., primary buttons use opacity 0.9, secondary buttons use background change)

2.3 WHEN a user views the navbar login button THEN the system SHALL use the "ghost" button variant with consistent styling

2.4 WHEN a user views the homepage/mobile menu login button THEN the system SHALL use the "primary" button variant with consistent styling

#### 2. Consistent Spacing System

2.5 WHEN spacing is applied to any component THEN the system SHALL use values from a defined spacing scale based on a 4px/8px grid (e.g., 0.25rem, 0.5rem, 0.75rem, 1rem, 1.5rem, 2rem, 2.5rem, 3rem, 4rem)

2.6 WHEN padding is applied to navbar elements THEN the system SHALL use spacing tokens (e.g., `padding: var(--spacing-2) var(--spacing-4)`)

2.7 WHEN padding is applied to cards THEN the system SHALL use consistent spacing tokens (e.g., `padding: var(--spacing-6)`)

2.8 WHEN margins and gaps are defined THEN the system SHALL use spacing tokens from the defined scale

#### 3. Consistent Border Radius System

2.9 WHEN border radius is applied to any component THEN the system SHALL use values from a defined scale (sm: 8px, md: 12px, lg: 16px, xl: 20px, full: 9999px)

2.10 WHEN border radius is applied to small interactive elements (buttons, badges) THEN the system SHALL use `var(--radius-sm)` (8px)

2.11 WHEN border radius is applied to cards THEN the system SHALL use `var(--radius-lg)` (16px)

2.12 WHEN border radius is applied to modals/large containers THEN the system SHALL use `var(--radius-xl)` (20px)

2.13 WHEN border radius is applied to pills/chips THEN the system SHALL use `var(--radius-full)` (9999px)

#### 4. Consistent Typography System

2.14 WHEN typography is applied THEN the system SHALL use a modular type scale with defined CSS custom properties (e.g., `--text-xs`, `--text-sm`, `--text-base`, `--text-lg`, `--text-xl`, `--text-2xl`, `--text-3xl`, `--text-4xl`)

2.15 WHEN page titles are displayed THEN the system SHALL use `var(--text-4xl)` or `var(--text-3xl)` consistently

2.16 WHEN section titles are displayed THEN the system SHALL use `var(--text-2xl)` consistently

2.17 WHEN body text is displayed THEN the system SHALL use `var(--text-base)` consistently

2.18 WHEN small text (captions, labels) is displayed THEN the system SHALL use `var(--text-sm)` or `var(--text-xs)` consistently

#### 5. Consistent Interactive States

2.19 WHEN a user hovers over primary buttons THEN the system SHALL apply `opacity: 0.9` transition

2.20 WHEN a user hovers over secondary/ghost buttons THEN the system SHALL apply background color change to `var(--bg-hover)`

2.21 WHEN a user hovers over cards THEN the system SHALL apply `transform: translateY(-2px)` with background and border color changes

2.22 WHEN a user hovers over navigation links THEN the system SHALL apply background color change to `var(--bg-hover)` and text color change to `var(--text-primary)`

2.23 WHEN a user interacts with any element THEN the system SHALL provide predictable feedback based on the element type

#### 6. Consistent Focus States

2.24 WHEN a user navigates with keyboard to any interactive element THEN the system SHALL display a consistent focus indicator (e.g., `outline: 2px solid var(--accent-bg)`, `outline-offset: 2px`)

2.25 WHEN a user tabs through buttons THEN the system SHALL show a visible WCAG-compliant focus ring

2.26 WHEN a user tabs through links THEN the system SHALL show a visible WCAG-compliant focus ring

2.27 WHEN a user tabs through cards THEN the system SHALL show a visible WCAG-compliant focus ring

#### 7. Consistent Loading States

2.28 WHEN any section is loading THEN the system SHALL display skeleton elements with a consistent pulse animation

2.29 WHEN the navbar is loading THEN the system SHALL use the same skeleton pattern and animation as other loading states

2.30 WHEN note cards are loading THEN the system SHALL use the same skeleton pattern and animation as other loading states

2.31 WHEN the login page is loading THEN the system SHALL use the same skeleton pattern and animation as other loading states

#### 8. Consistent Responsive Breakpoints

2.32 WHEN the viewport width changes THEN the system SHALL use a unified set of breakpoints defined as CSS custom properties or constants (e.g., mobile: 480px, tablet: 768px, desktop: 1024px, wide: 1280px)

2.33 WHEN the layout adapts to mobile THEN the system SHALL use the same breakpoint value (e.g., 768px) across all components

2.34 WHEN media queries are defined THEN the system SHALL reference the shared breakpoint values

#### 9. Accessibility Compliance

2.35 WHEN text is displayed in dark mode THEN the system SHALL ensure all text colors meet WCAG AA contrast requirements (4.5:1 for normal text, 3:1 for large text)

2.36 WHEN text-muted is used THEN the system SHALL ensure the color value provides sufficient contrast against the background

2.37 WHEN interactive elements are focused THEN the system SHALL provide visible focus indicators that meet WCAG 2.1 Level AA requirements

2.38 WHEN ARIA labels are used THEN the system SHALL follow consistent patterns across similar components

#### 10. Component-Specific Fixes

2.39 WHEN a user views a locked note card THEN the system SHALL display a paywall overlay that allows interaction with the card metadata (title, subject) while only blocking PDF access

2.40 WHEN a user views the subject filter THEN the system SHALL provide visual indicators (fade gradients, scroll arrows) to show horizontal scrollability

2.41 WHEN a user opens the navbar dropdown THEN the system SHALL use the same animation timing and easing as the mobile menu

2.42 WHEN a user switches between admin sections THEN the system SHALL provide visual feedback (loading indicator, transition animation) for the active section change

---

### Unchanged Behavior (Regression Prevention)

#### 3.1 Theme System

3.1 WHEN a user toggles between light and dark themes THEN the system SHALL CONTINUE TO apply the correct CSS custom property values for each theme

3.2 WHEN theme colors are referenced THEN the system SHALL CONTINUE TO use CSS custom properties (e.g., `var(--text-primary)`, `var(--bg-surface)`)

#### 3.2 Component Functionality

3.3 WHEN a user clicks a login button THEN the system SHALL CONTINUE TO navigate to the login page or trigger authentication

3.4 WHEN a user clicks a note card THEN the system SHALL CONTINUE TO open the secure PDF viewer (if user has access)

3.5 WHEN a user clicks a subject filter chip THEN the system SHALL CONTINUE TO filter notes by the selected subject

3.6 WHEN a user opens the navbar dropdown THEN the system SHALL CONTINUE TO display user information and logout option

3.7 WHEN a user opens the mobile menu THEN the system SHALL CONTINUE TO display navigation links and authentication options

#### 3.3 Layout Structure

3.8 WHEN a user views any page THEN the system SHALL CONTINUE TO maintain the current layout structure (navbar, content sections, footer)

3.9 WHEN a user views the admin panel THEN the system SHALL CONTINUE TO display the sidebar navigation and main content area

3.10 WHEN a user resizes the viewport THEN the system SHALL CONTINUE TO adapt the layout responsively (with consistent breakpoints)

#### 3.4 Accessibility Features

3.11 WHEN a screen reader user navigates THEN the system SHALL CONTINUE TO provide semantic HTML and ARIA labels

3.12 WHEN a keyboard user navigates THEN the system SHALL CONTINUE TO support keyboard navigation (with improved focus indicators)

3.13 WHEN a user with reduced motion preferences views the site THEN the system SHALL CONTINUE TO respect `prefers-reduced-motion` media query

#### 3.5 Performance

3.14 WHEN a user loads any page THEN the system SHALL CONTINUE TO load with similar or better performance (design tokens should not negatively impact performance)

3.15 WHEN CSS is loaded THEN the system SHALL CONTINUE TO use efficient selectors and avoid unnecessary specificity

#### 3.6 Existing Visual Hierarchy

3.16 WHEN a user views page content THEN the system SHALL CONTINUE TO maintain the current visual hierarchy (headings, body text, captions) with consistent sizing

3.17 WHEN a user views color-coded elements (danger, success, info) THEN the system SHALL CONTINUE TO use the appropriate semantic colors

#### 3.7 Animation Behavior

3.18 WHEN animations are triggered THEN the system SHALL CONTINUE TO use smooth transitions with appropriate timing

3.19 WHEN the navbar scrolls THEN the system SHALL CONTINUE TO apply the backdrop blur and background change animation

3.20 WHEN the mobile menu opens THEN the system SHALL CONTINUE TO slide in from the right with the current animation

#### 3.8 Content Display

3.21 WHEN a user views announcements THEN the system SHALL CONTINUE TO display the slider with the current functionality

3.22 WHEN a user views notes THEN the system SHALL CONTINUE TO display the grid layout with pagination

3.23 WHEN a user views the about section THEN the system SHALL CONTINUE TO display the content with stats and social links

#### 3.9 Authentication Flow

3.24 WHEN a user signs in THEN the system SHALL CONTINUE TO authenticate via Google OAuth and redirect appropriately

3.25 WHEN a user signs out THEN the system SHALL CONTINUE TO clear authentication state and redirect to homepage

#### 3.10 Admin Functionality

3.26 WHEN an admin user accesses the admin panel THEN the system SHALL CONTINUE TO enforce role-based access control

3.27 WHEN an admin user navigates between admin sections THEN the system SHALL CONTINUE TO display the appropriate content for each section

---

## Bug Condition Derivation

### Bug Condition Function

```pascal
FUNCTION isBugCondition(Component, Property)
  INPUT: Component (UI element), Property (style property being evaluated)
  OUTPUT: boolean
  
  // Returns true when inconsistent styling is applied
  RETURN (
    (Property = "button-style" AND hasMultipleVariantsForSameAction(Component)) OR
    (Property = "spacing" AND NOT usesSpacingScale(Component)) OR
    (Property = "border-radius" AND NOT usesBorderRadiusScale(Component)) OR
    (Property = "typography" AND NOT usesTypeScale(Component)) OR
    (Property = "hover-state" AND NOT usesConsistentHoverPattern(Component)) OR
    (Property = "focus-state" AND NOT hasConsistentFocusIndicator(Component)) OR
    (Property = "loading-state" AND NOT usesConsistentSkeletonPattern(Component)) OR
    (Property = "breakpoint" AND NOT usesSharedBreakpointValues(Component)) OR
    (Property = "color-contrast" AND NOT meetsWCAGAA(Component)) OR
    (Property = "interaction-feedback" AND NOT hasPredictableFeedback(Component))
  )
END FUNCTION
```

### Property Specification

```pascal
// Property: Fix Checking - Consistent Design System
FOR ALL Component, Property WHERE isBugCondition(Component, Property) DO
  result ← applyDesignSystem'(Component, Property)
  ASSERT (
    (Property = "button-style" IMPLIES usesButtonVariant(result)) AND
    (Property = "spacing" IMPLIES usesSpacingToken(result)) AND
    (Property = "border-radius" IMPLIES usesBorderRadiusToken(result)) AND
    (Property = "typography" IMPLIES usesTypeScaleToken(result)) AND
    (Property = "hover-state" IMPLIES usesConsistentHoverPattern(result)) AND
    (Property = "focus-state" IMPLIES hasWCAGCompliantFocus(result)) AND
    (Property = "loading-state" IMPLIES usesConsistentSkeleton(result)) AND
    (Property = "breakpoint" IMPLIES usesSharedBreakpoint(result)) AND
    (Property = "color-contrast" IMPLIES meetsWCAGAA(result)) AND
    (Property = "interaction-feedback" IMPLIES hasPredictableFeedback(result))
  )
END FOR
```

### Preservation Goal

```pascal
// Property: Preservation Checking - Maintain Existing Functionality
FOR ALL Component, Property WHERE NOT isBugCondition(Component, Property) DO
  ASSERT applyDesignSystem(Component, Property) = applyDesignSystem'(Component, Property)
END FOR

// Specifically preserve:
// - Theme switching functionality
// - Component click handlers and navigation
// - Layout structure and responsive behavior
// - Accessibility features (semantic HTML, ARIA)
// - Performance characteristics
// - Visual hierarchy
// - Animation behavior
// - Content display
// - Authentication flow
// - Admin role-based access control
```

### Key Definitions

- **F**: The original styling system - inconsistent styles applied directly in component files
- **F'**: The fixed styling system - consistent design tokens and component variants applied via a centralized design system

### Counterexamples

**Example 1: Inconsistent Button Styles**
- **Input:** User views login button in navbar vs. homepage
- **Current Behavior (F):** Navbar shows border button, homepage shows filled button
- **Expected Behavior (F'):** Both use appropriate button variants from unified system (navbar uses "ghost", homepage uses "primary")

**Example 2: Inconsistent Spacing**
- **Input:** Padding applied to navbar (0.4rem 1rem) vs. note cards (1.5rem)
- **Current Behavior (F):** Arbitrary padding values
- **Expected Behavior (F'):** Both use spacing tokens (e.g., `var(--spacing-2) var(--spacing-4)` and `var(--spacing-6)`)

**Example 3: Inconsistent Hover States**
- **Input:** User hovers over primary button vs. note card
- **Current Behavior (F):** Button uses opacity change, card uses transform + background change
- **Expected Behavior (F'):** Both use predictable patterns based on element type (buttons use opacity, cards use transform + background)

**Example 4: Missing Focus Indicators**
- **Input:** User tabs through interactive elements
- **Current Behavior (F):** Inconsistent or missing focus rings
- **Expected Behavior (F'):** All interactive elements show consistent WCAG-compliant focus indicators

**Example 5: Inconsistent Breakpoints**
- **Input:** Viewport width changes from 900px to 768px
- **Current Behavior (F):** Some components adapt at 900px, others at 768px
- **Expected Behavior (F'):** All components use shared breakpoint value (768px)
