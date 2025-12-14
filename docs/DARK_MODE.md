# Dark Mode Implementation

This document describes the dark mode toggle implementation added to the demo-app.

## Overview

A complete dark mode system has been added to the demo application with:

- **Theme persistence** via localStorage
- **Smooth transitions** between light and dark modes
- **System preference detection** (defaults to user's OS preference)
- **Global dark mode support** across all pages

## Components Added

### 1. Theme Context (`src/contexts/theme-context.tsx`)

Manages the global dark mode state with:

- `theme` signal for current theme state
- `toggleTheme` QRL function for theme switching
- `getInitialTheme()` helper to load from localStorage or system preference
- `applyTheme()` helper to apply theme class to document root

### 2. Dark Mode Toggle Component (`src/components/ui/dark-mode-toggle.tsx`)

A minimal toggle button that:

- Shows moon icon in light mode
- Shows sun icon in dark mode
- Matches the minimalist design system
- Includes proper ARIA labels for accessibility

## Integration

### Root Component (`src/root.tsx`)

- Theme context provider added
- Initializes theme on mount using `useVisibleTask$`
- Persists theme changes to localStorage

### Global Styles (`src/global.css`)

Dark mode styles added for:

- Body background and text colors
- Headings
- Links
- Buttons (all variants: primary, secondary, ghost)
- Inputs
- Cards
- Badges
- Dividers

All components use smooth 200ms transitions for theme changes.

### Tailwind Config (`tailwind.config.js`)

- Enabled `darkMode: "class"` configuration
- Works with the `.dark` class on the root element

## Page Updates

### 1. Login Page (`src/routes/index.tsx`)

- Dark mode toggle in top-right corner (fixed position)
- Updated border colors to support dark mode
- Background transitions smoothly

### 2. Dashboard Layout (`src/routes/dashboard/layout.tsx`)

- Dark mode toggle added to header (next to user menu)
- All header elements support dark mode
- Dropdown menu supports dark mode
- Main container transitions smoothly

### 3. Logged In Page (`src/routes/logged-in/index.tsx`)

- **Complete redesign** from colored scheme to minimalist black/white
- Removed:
  - Gradient backgrounds (`bg-linear-to-br from-green-50 to-blue-100`)
  - Colored icons and badges (`bg-green-100`, `text-green-600`, `bg-blue-50`)
  - Rounded corners and shadows
- Added:
  - Clean typography-first design
  - Border-based layout using `.card` component
  - Minimalist status indicators (✓/✗)
  - Dark mode toggle in top-right
  - Large, light headings with tight tracking
  - Generous whitespace and breathing room

## Design System Compliance

The implementation follows the minimalist design system defined in `DESIGN_SYSTEM.md`:

✅ **Typography First**: Large, light headings with tight tracking  
✅ **Subtle Borders**: Gray borders instead of heavy shadows  
✅ **No Colors**: Pure black and white with grayscale  
✅ **Minimal Icons**: Text-based UI with simple SVG icons  
✅ **Clean Spacing**: Generous whitespace and breathing room

## Dark Mode Color Scheme

### Light Mode

- Background: White (`#ffffff`)
- Text: Black (`#000000`)
- Borders: Black (`#000000`)

### Dark Mode

- Background: Black (`#000000`)
- Text: White (`#ffffff`)
- Borders: White (`#ffffff`)

All interactive elements (buttons, inputs, cards) automatically invert colors in dark mode while maintaining the same visual hierarchy.

## Usage

### Adding Dark Mode to New Components

1. Use Tailwind's `dark:` prefix for dark mode styles:

```tsx
<div class="bg-white dark:bg-black text-black dark:text-white">Content</div>
```

2. Use CSS classes that already support dark mode:

- `.btn`, `.btn-secondary`, `.btn-ghost`
- `.input`
- `.card`
- `.badge`, `.badge-success`, `.badge-warning`
- `.divider`

3. For custom borders:

```tsx
<div class="border-black dark:border-white">Content</div>
```

### Accessing Theme Context

```tsx
import { useTheme } from "~/contexts/theme-context";

export default component$(() => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme.value === "dark";

  // Use theme state or toggle function
});
```

## Browser Support

- **localStorage**: Used for persistence (all modern browsers)
- **CSS transitions**: Smooth color transitions (all modern browsers)
- **System preference detection**: `prefers-color-scheme` media query (all modern browsers)

## Accessibility

- Toggle button includes proper `aria-label` attributes
- Maintains proper contrast ratios in both modes
- Smooth transitions don't interfere with screen readers
- Keyboard navigation fully supported

## Future Enhancements

Potential improvements for the future:

1. Add theme transition animations (fade, slide)
2. Support for custom color schemes beyond black/white
3. Per-page theme preferences
4. Sync theme across browser tabs
5. Add theme to user preferences API
