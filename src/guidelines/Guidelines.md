# Design System Guidelines - Material Design 3

## Overview

This project follows Google Material Design 3 (M3) principles and specifications.
Reference: https://m3.material.io/

## Color System (Material Design 3)

### Theme Colors

- **Primary**: `#3B82F6` (blue-500) - Main brand color, primary actions
- **Secondary**: `#A855F7` (purple-500) - Supporting actions
- **Tertiary**: Use for accents and highlights
- **Surface**: `#FFFFFF` (white) - Card and sheet backgrounds
- **Surface Container**: `#F3F4F6` (gray-100)
- **Surface Container Highest**: `#E5E7EB` (gray-200)
- **Background**: `#F8F9FA` - Page background
- **On Primary**: `#FFFFFF` - Text/icons on primary color
- **On Surface**: `#111827` (gray-900) - Text on surface
- **On Surface Variant**: `#6B7280` (gray-500) - Secondary text
- **Outline**: `#E5E7EB` (gray-200) - Borders and dividers
- **Outline Variant**: `#F3F4F6` (gray-100) - Subtle borders

### Custom Overrides

- **Header Background**: `#111111` (dark) - App bar background
- **User Message Background**: `#3B82F6` (primary)
- **AI Message Background**: `#F3F4F6` (surface container)

## Typography (Material Design 3 Scale)

Use Material Design 3 typography scale. Do not override font-size, font-weight, or line-height unless specifically requested.

### Type Scale

- **Display Large**: 57px, -0.25px letter-spacing
- **Display Medium**: 45px, 0px letter-spacing
- **Display Small**: 36px, 0px letter-spacing
- **Headline Large**: 32px, 0px letter-spacing
- **Headline Medium**: 28px, 0px letter-spacing
- **Headline Small**: 24px, 0px letter-spacing
- **Title Large**: 22px, 0px letter-spacing
- **Title Medium**: 16px, 0.15px letter-spacing (medium weight)
- **Title Small**: 14px, 0.1px letter-spacing (medium weight)
- **Body Large**: 16px, 0.5px letter-spacing
- **Body Medium**: 14px, 0.25px letter-spacing
- **Body Small**: 12px, 0.4px letter-spacing
- **Label Large**: 14px, 0.1px letter-spacing (medium weight)
- **Label Medium**: 12px, 0.5px letter-spacing (medium weight)
- **Label Small**: 11px, 0.5px letter-spacing (medium weight)

### Application

- App Bar Title: Title Large
- Message Text: Body Large
- Timestamps: Label Small
- Button Labels: Label Large
- Input Placeholder: Body Large

## Elevation & Shadows (Material Design 3)

Use Material Design 3 elevation levels:

- **Level 0**: No shadow (flat surfaces)
- **Level 1**: Subtle shadow for cards at rest - `shadow-sm`
- **Level 2**: Medium shadow for raised elements - `shadow`
- **Level 3**: Cards on hover, FAB at rest - `shadow-md`
- **Level 4**: FAB on hover - `shadow-lg`
- **Level 5**: Dialogs, modal sheets - `shadow-xl`

### Application

- Chat messages: Level 0 (no shadow, use background color only)
- Input container: Level 0 with top border
- Header/App Bar: Level 0 (no shadow)
- Floating elements: Level 3+

## Shape (Material Design 3)

Material Design 3 uses rounded corners with specific values:

### Corner Radius

- **Extra Small**: 4px - `rounded` - Small components like chips
- **Small**: 8px - `rounded-lg` - Buttons, input fields
- **Medium**: 12px - `rounded-xl` - Cards, smaller containers
- **Large**: 16px - `rounded-2xl` - Larger cards, sheets
- **Extra Large**: 28px - `rounded-[28px]` - FABs, special containers
- **Full**: 9999px - `rounded-full` - Pills, avatars

### Application

- Chat Messages: Large (16px / rounded-2xl)
- Avatars: Full (rounded-full)
- Input Field: Small (8px / rounded-lg)
- Buttons: Full (rounded-full) for primary actions
- Cards: Medium (12px / rounded-xl)

## Spacing (Material Design 3)

Use 4px base unit (Tailwind's default spacing scale aligns with this):

- **xs**: 4px - `gap-1` or `p-1`
- **sm**: 8px - `gap-2` or `p-2`
- **md**: 12px - `gap-3` or `p-3`
- **lg**: 16px - `gap-4` or `p-4`
- **xl**: 24px - `gap-6` or `p-6`
- **2xl**: 32px - `gap-8` or `p-8`

### Application

- Message spacing: 16px between messages (`space-y-4`)
- Message padding: 16px horizontal, 12px vertical (`px-4 py-3`)
- Container padding: 16px (`p-4`)
- Component gaps: 8px-12px (`gap-2` to `gap-3`)

## Components (Material Design 3)

### Chat Messages

- Follow Material Design 3 chat bubble guidelines
- User messages: Aligned right, primary color background
- AI messages: Aligned left, surface container background
- Maximum width: 70% of container
- Shape: Large corners (rounded-2xl)
- Padding: 16px horizontal, 12px vertical
- Elevation: Level 0 (flat)
- Timestamps: Label Small, on-surface-variant color

### Avatars

- Shape: Circular (rounded-full)
- Size: 40x40px (standard M3 avatar size)
- User avatar: Primary background
- AI avatar: Secondary background
- Icon size: 20x20px inside avatar

### Buttons (Material Design 3)

- **Filled Button** (Primary): Primary color background, rounded-full, min-height 40px
- **Outlined Button**: Border with outline color, rounded-full
- **Text Button**: No background, rounded-full
- Touch target: Minimum 48x48px (M3 requirement)
- Label: Label Large typography
- Icon size: 18-24px
- Padding: 24px horizontal for text, 16px for icon buttons

### Text Fields (Material Design 3)

- **Filled variant**: Preferred for forms
- **Outlined variant**: Use for distinct separation
- Shape: Small corners (rounded-lg)
- Height: 56px (standard M3 height)
- Padding: 16px horizontal
- Label: Body Large when focused, Body Medium when inactive
- Helper text: Body Small

### App Bar / Header

- Background: `#111111` (custom override)
- Height: 64px (standard M3 app bar height)
- Padding: 16px horizontal
- Title: Title Large
- Icons: 24x24px
- Elevation: Level 0 (no shadow by default)

### Cards

- Shape: Medium corners (rounded-xl)
- Elevation: Level 1 at rest, Level 2 on hover
- Padding: 16px
- Background: Surface color

### FAB (Floating Action Button)

- Shape: Large corners (16px) for regular, Extra Large (28px) for large FAB
- Elevation: Level 3 at rest, Level 4 on hover
- Size: 56x56px (regular), 96x96px (large)
- Icon: 24x24px

## Layout

### Container

- Full screen height: `h-screen`
- Flex column layout: `flex flex-col`
- Maximum content width: 896px (`max-w-4xl`) centered with `mx-auto`

### App Structure

- Fixed app bar at top (64px height)
- Scrollable content area in middle
- Fixed bottom input area
- Use proper spacing between sections

### Responsive

- Mobile-first approach
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Touch targets minimum 48x48px on mobile

## State Layers (Material Design 3)

Apply state layers for interactive elements:

- **Hover**: 8% opacity overlay
- **Focus**: 12% opacity overlay
- **Press**: 12% opacity overlay
- **Dragged**: 16% opacity overlay

Use Tailwind hover and focus states:

- `hover:bg-primary/8` (8% opacity)
- `focus:bg-primary/12`
- `active:bg-primary/12`

## Motion & Animation

### Duration (Material Design 3)

- **Short**: 100ms - Small component changes
- **Medium**: 250ms - Entering/exiting elements
- **Long**: 400ms - Large/complex animations

### Easing

- **Standard**: Default for most animations
- **Emphasized**: For important state changes
- **Decelerate**: Elements entering the screen
- **Accelerate**: Elements leaving the screen

### Application

- Typing indicator: Bounce animation with 150ms delay
- Scroll to message: Smooth behavior
- Button press: 100ms scale/color change
- Transitions: `transition-all duration-200`

## Interactions

### Touch Targets

- Minimum 48x48px (M3 requirement)
- Add padding if visual element is smaller

### Feedback

- Show ripple effect on touch (use state layers)
- Disable state for unavailable actions
- Loading indicators when processing

### Keyboard Navigation

- Enter to send message
- Shift+Enter for new line
- Tab navigation support
- Focus indicators visible

## Accessibility (Material Design 3)

- Color contrast ratio minimum 4.5:1 for text
- Touch targets minimum 48x48px
- Focus indicators clearly visible
- Semantic HTML elements
- ARIA labels where needed
- Support for screen readers

## Icons

- Use Material Symbols or Lucide React icons
- Size: 18px (small), 24px (default), 32px (large)
- Align icons vertically centered with text
- Icon-only buttons must have 48x48px touch target

## General Rules

- Follow Material Design 3 guidelines for all components
- Use Tailwind utilities that align with M3 specifications
- Explicitly set spacing, colors, and shapes per M3 guidelines
- Prefer flexbox and grid for layouts
- Keep components modular in separate files
- Use semantic HTML5 elements
- Maintain consistency with M3 elevation, shape, and color systems
- Override component defaults when they conflict with M3 specs