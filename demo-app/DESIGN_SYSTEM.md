# Minimalist Design System

Inspired by clean typography and subtle spacing, this design system provides a sophisticated, readable interface.

## Design Principles

1. **Typography First**: Large, light headings with tight tracking
2. **Subtle Borders**: Gray-200/300 borders instead of heavy shadows
3. **No Colors**: Pure black and white with grayscale
4. **Minimal Icons**: Text-based navigation and UI
5. **Clean Spacing**: Generous whitespace and breathing room

## Color Palette

### Grayscale

- `gray-50`: #fafafa (lightest backgrounds)
- `gray-100`: #f5f5f5
- `gray-200`: #e5e5e5 (borders)
- `gray-300`: #d4d4d4 (hover borders)
- `gray-600`: #525252 (secondary text)
- `gray-900`: #171717 (primary text, buttons)
- `white`: #ffffff (backgrounds)

## Typography

### Headings

```tsx
<h1>  // text-5xl font-light tracking-tightest
<h2>  // text-3xl font-light tracking-tight
<h3>  // text-2xl font-light tracking-tight
```

### Body Text

- **Primary**: text-gray-900 (almost black)
- **Secondary**: text-gray-600 (medium gray)
- **Labels**: text-sm font-medium

## Components

### Buttons

```tsx
// Primary Button
<button class="btn">
  Sign in
</button>

// Secondary Button
<button class="btn btn-secondary">
  Cancel
</button>

// Ghost Button
<button class="btn btn-ghost">
  Learn more
</button>
```

**Styles**:

- Default: Black background, white text
- Hover: White background, black text
- Border: Always visible (gray-900 or gray-300)
- No rounded corners or heavy shadows
- Clean state transitions

### Inputs

```tsx
<input class="input" type="email" placeholder="your@email.com" />
```

**Features**:

- Border: gray-300 default
- Focus: gray-900 border with subtle ring
- No rounded corners
- Consistent padding (py-3 px-4)
- Placeholder: gray-400

### Cards

```tsx
<div class="card">
  <!-- Content -->
</div>

// With hover effect
<div class="card card-hover">
  <!-- Content -->
</div>
```

**Styles**:

- White background
- Gray-200 border
- No shadows (or very subtle on hover)
- No rounded corners

### Badges

```tsx
// Success badge
<span class="badge badge-success">Verified</span>

// Warning badge
<span class="badge badge-warning">Pending</span>
```

**Features**:

- Uppercase text (text-2xs)
- Border-based styling
- No background colors (or white only)
- Wide letter spacing

## Layout

### Container

```tsx
<div class="container-custom">
  <!-- Max-width 4xl, centered, responsive padding -->
</div>
```

### Section Spacing

```tsx
<section class="section">
  <!-- py-12 md:py-16 lg:py-20 -->
</section>
```

### Dividers

```tsx
<div class="divider" />
<!-- border-t border-gray-200 -->
```

## Examples

### Login Page Pattern

```tsx
<div class="min-h-screen bg-white flex items-center justify-center px-6">
  <div class="w-full max-w-md">
    {/* Header */}
    <div class="mb-12">
      <h1 class="text-5xl font-light tracking-tightest mb-4">Sign In</h1>
      <p class="text-sm text-gray-600">Enter your credentials</p>
    </div>

    {/* Form */}
    <form class="space-y-6">
      <div>
        <label class="block text-sm font-medium text-gray-900 mb-2">
          Email
        </label>
        <input class="input" type="email" />
      </div>

      <button class="btn w-full">Sign in</button>
    </form>

    {/* Footer */}
    <div class="mt-8 pt-8 border-t border-gray-200">
      <a href="/forgot">Forgot password?</a>
    </div>
  </div>
</div>
```

### Dashboard Header Pattern

```tsx
<header class="border-b border-gray-200">
  <div class="container-custom py-6">
    <div class="flex items-center justify-between">
      <a href="/" class="text-2xl font-light tracking-tightest">
        Auth
      </a>

      <div class="flex items-center space-x-3">
        <span class="text-sm text-gray-600">user@example.com</span>
        <button class="btn-ghost">Sign out</button>
      </div>
    </div>
  </div>
</header>
```

## Customization

The design system is defined in:

- `tailwind.config.js` - Theme extensions
- `src/global.css` - Component classes and base styles

### Tailwind Config Highlights

```js
{
  fontFamily: {
    sans: ['-apple-system', 'BlinkMacSystemFont', ...],
  },
  letterSpacing: {
    tightest: '-0.075em',
  },
  lineHeight: {
    tightest: '1.1',
  },
}
```

## Migration Guide

### Old → New

**Colors**:

- `bg-blue-600` → `bg-gray-900`
- `text-blue-600` → `text-gray-900`
- `border-blue-500` → `border-gray-900`

**Buttons**:

- Remove `rounded-lg` → Sharp edges
- Remove gradients → Solid colors
- Add `btn` class for consistency

**Typography**:

- `font-bold` → `font-light`
- Add `tracking-tight` or `tracking-tightest`
- Remove emojis and icons

**Spacing**:

- Increase gaps between sections
- Use generous whitespace
- Consistent vertical rhythm

## Best Practices

1. **Keep it Simple**: Less is more
2. **Typography Hierarchy**: Let font size and weight do the work
3. **Consistent Spacing**: Use defined spacing scale
4. **Minimal Color**: Stick to grayscale
5. **Clear Labels**: No icons without text
6. **Accessible**: High contrast, clear focus states
7. **Fast**: Minimal CSS, no heavy animations
