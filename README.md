# FotoOwl Gallery

A multi-user real-time image interaction web application built with React, InstantDB, and Unsplash API.

## Features

- 🖼️ **Image Gallery**: Browse images from Unsplash with infinite scroll
- 😊 **Emoji Reactions**: React to images with emojis in real-time
- 💬 **Comments**: Add and view comments on images with real-time sync
- 📰 **Live Feed**: See all interactions across images in a real-time activity feed
- 🎨 **User Identity**: Each user gets a unique color and username
- ✨ **Smooth Animations**: Polished UI with smooth transitions

## Tech Stack

- **React 19** - UI framework
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **InstantDB** - Real-time database
- **React Query** - Data fetching and caching
- **Zustand** - State management
- **Unsplash API** - Image source

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- Unsplash API key (optional - falls back to Picsum)
- InstantDB account

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd fotoowl-gallery
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Create a `.env` file in the root directory:
   ```env
   VITE_INSTANT_APP_ID=your_instant_app_id
   VITE_UNSPLASH_KEY=your_unsplash_access_key
   ```

   - Get your InstantDB App ID from [InstantDB Dashboard](https://www.instantdb.com/)
   - Get your Unsplash Access Key from [Unsplash Developers](https://unsplash.com/developers)
   - Note: The app will fallback to Picsum Photos if Unsplash API key is not provided

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Build for production**:
   ```bash
   npm run build
   ```

### Deployment

The app can be deployed to:
- **Vercel**: `vercel deploy`
- **Netlify**: `netlify deploy`
- **Cloudflare Pages**: Connect your Git repository

Make sure to set environment variables in your deployment platform.

## API Handling Strategy

### Unsplash API Integration

The app uses a layered API strategy for image fetching:

```javascript
// Primary: Unsplash API with access key
const url = `https://api.unsplash.com/photos?page=${page}&per_page=${perPage}&order_by=latest&client_id=${accessKey}`;

// Fallback: Picsum Photos (no API key required)
const fallbackUrl = `https://picsum.photos/v2/list?page=${page}&limit=${limit}`;
```

**Key Features:**
- **Graceful Degradation**: Automatically falls back to Picsum if Unsplash fails or no API key provided
- **Error Handling**: Comprehensive try/catch with fallback mechanisms
- **Caching**: React Query caches images for 5 minutes to reduce API calls
- **Rate Limiting**: Uses reasonable per_page limits (12 images per request)

**Data Transformation:**
```javascript
// Standardizes image data from both sources
return data.map((img) => ({
  id: img.id,
  urls: {
    small: img.urls.small,
    regular: img.urls.regular,
    full: img.urls.full,
  },
  alt_description: img.alt_description || img.description || "Unsplash photo",
  user: {
    name: img.user.name,
    username: img.user.username,
  },
}));
```

### Real-Time Data Strategy

**InstantDB Integration:**
- **Connection**: Single db instance initialized with app ID
- **Queries**: Real-time subscriptions using `db.useQuery()`
- **Transactions**: Batched operations for atomic updates
- **Conflict Resolution**: Optimistic UI updates with server reconciliation

## InstantDB Schema & Usage

### Schema Definition

The app uses three main collections:

```javascript
export const instantDBSchema = {
  // Reactions collection
  reactions: {
    imageId: "string", // Unsplash image ID
    emoji: "string",   // The emoji reacted with
    userId: "string",  // Unique user identifier
    username: "string", // Display name
    createdAt: "number", // Timestamp
  },

  // Comments collection
  comments: {
    imageId: "string", // Unsplash image ID
    text: "string",    // Comment content
    userId: "string",  // Unique user identifier
    username: "string", // Display name
    createdAt: "number", // Timestamp
  },

  // FeedEvents collection (referred to as 'feed' in queries)
  feed: {
    type: "string",    // "reaction" or "comment"
    imageId: "string", // Unsplash image ID
    emoji: "string",   // For reactions
    text: "string",    // For comments
    reactionId: "string", // For reactions
    commentId: "string", // For comments
    userId: "string",  // Unique user identifier
    username: "string", // Display name
    createdAt: "number", // Timestamp
  },
};
```

### Usage Patterns

**Real-Time Queries:**
```javascript
// Gallery component - reactions for specific image
const { data: reactions } = db.useQuery({
  reactions: { where: { imageId: imageId } },
});

// Feed component - global activity stream
const { data, isLoading } = db.useQuery({
  feed: {
    $: {
      order: { createdAt: "desc" },
      limit: 50,
    },
  },
});
```

**Transactions:**
```javascript
// Atomic reaction + feed update
const reactionId = id();
await db.transact([
  db.tx.reactions[reactionId].update({
    imageId, emoji, userId, username, createdAt: Date.now()
  }),
  db.tx.feed[id()].update({
    type: "reaction",
    imageId, emoji, reactionId, userId, username, createdAt: Date.now()
  }),
]);
```

**Data Relationships:**
- Reactions and comments are linked to images via `imageId`
- Feed items reference reactions/comments via `reactionId`/`commentId`
- Users are identified by `userId` with display `username`

## Key React Decisions

### State Management Architecture

**Zustand for Global State:**
```javascript
export const useUserStore = create((set, get) => ({
  userId: crypto.randomUUID(), // Persistent across session
  username: `User${Math.floor(Math.random() * 1000)}`, // Random display name
  userColor: generateUserColor(), // Consistent color per user
  selectedImage: null,
  isModalOpen: false,
}));
```

**Why Zustand over Context/Redux:**
- Lightweight (no boilerplate)
- TypeScript-friendly
- Simple API for small to medium apps
- Better performance than Context for frequent updates

### Component Architecture

**Separation of Concerns:**
- `Gallery`: Image browsing and infinite scroll
- `ImageModal`: Detailed view with interactions
- `Feed`: Real-time activity stream
- `EmojiPicker`: Reusable emoji selection

**Custom Hooks Pattern:**
- `useQuery` for data fetching
- `db.useQuery` for real-time subscriptions
- Custom logic encapsulated in components

### Performance Optimizations

**React Query for Caching:**
```javascript
const { data: imagesData } = useQuery({
  queryKey: ["images", "feed-cache"],
  queryFn: async () => { /* fetch multiple pages */ },
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

**Memoization:**
- `useMemo` for expensive computations (image mapping)
- `useCallback` for event handlers
- Prevents unnecessary re-renders

**Optimistic Updates:**
- UI updates immediately on user action
- Server reconciliation handles conflicts
- Better perceived performance

## Challenges Faced and Solutions

### 1. Data Persistence Issues

**Challenge:** Initial implementation had data disappearing after page refresh due to incorrect InstantDB transaction syntax.

**Solution:**
```javascript
// Before (problematic)
await db.transact([
  db.tx.reactions[id()].update({...}), // ID generated inside transaction
]);

// After (fixed)
const reactionId = id(); // Generate ID explicitly
await db.transact([
  db.tx.reactions[reactionId].update({...}),
]);
```

**Impact:** Ensured reliable data persistence across sessions.

### 2. Real-Time Synchronization Conflicts

**Challenge:** Multiple users interacting simultaneously caused duplicate reactions and inconsistent state.

**Solution:**
- Implemented optimistic UI updates
- Added conflict detection and resolution
- Used atomic transactions for related operations
- Added loading states to prevent double-submissions

**Result:** Smooth real-time collaboration without data corruption.

### 3. API Rate Limiting and Fallbacks

**Challenge:** Unsplash API has rate limits, and API keys might not be configured.

**Solution:**
- Implemented automatic fallback to Picsum Photos
- Added comprehensive error handling
- Used React Query caching to minimize API calls
- Graceful degradation without breaking the app

### 4. Component State Management

**Challenge:** Managing modal state, selected images, and user interactions across components.

**Solution:**
- Centralized user and modal state in Zustand store
- Used React Query for server state
- Clear separation between local and global state
- Event-driven architecture for cross-component communication

### 5. Real-Time Feed Animation

**Challenge:** Animating only new feed items without affecting existing ones.

**Solution:**
- Used `useRef` to track previous feed items
- Compared current vs previous IDs to detect new items
- Applied CSS animation classes conditionally
- Automatic cleanup after animation completes

## What Would I Improve with More Time

### 1. Enhanced User Experience

**Authentication System:**
- Replace random user IDs with proper authentication
- User profiles with avatars and persistent usernames
- Social features like following other users

**Advanced Interactions:**
- Nested comments/replies
- Image tagging and categorization
- Advanced emoji picker with search
- Reaction analytics (most popular images)

### 2. Performance Optimizations

**Virtual Scrolling:**
- Implement virtualized lists for large galleries
- Reduce DOM nodes for better performance
- Infinite scroll with better memory management

**Image Optimization:**
- Implement progressive image loading
- WebP format support with fallbacks
- Lazy loading with intersection observer
- Image CDN integration

### 3. Advanced Real-Time Features

**Presence Indicators:**
- Show which users are currently viewing an image
- "User is typing" indicators for comments
- Live collaboration cursors

**Conflict Resolution:**
- Advanced CRDT-based synchronization
- Better handling of offline/online transitions
- Real-time conflict resolution UI

### 4. Code Quality & Architecture

**TypeScript Migration:**
- Full TypeScript implementation
- Better type safety for InstantDB operations
- Improved developer experience

**Testing Suite:**
- Unit tests for components and utilities
- Integration tests for real-time features
- E2E tests with Cypress or Playwright

**Error Boundaries:**
- React Error Boundaries for better error handling
- Sentry integration for error tracking
- Better offline support

### 5. Scalability & Deployment

**Database Optimization:**
- Database indexing strategy
- Query optimization for large datasets
- Database migration system

**Monitoring & Analytics:**
- Performance monitoring
- User analytics
- Real-time usage metrics

**Progressive Web App:**
- Service worker for offline functionality
- App manifest for mobile installation
- Push notifications for new activity

### 6. UI/UX Enhancements

**Responsive Design:**
- Better mobile experience
- Touch gestures for image navigation
- Adaptive layouts for different screen sizes

**Accessibility:**
- Full screen reader support
- Keyboard navigation improvements
- High contrast mode support

**Theming:**
- Dark mode toggle
- Custom user themes
- Better color accessibility

## Project Structure

```
src/
├── components/
│   ├── EmojiPicker/     # Emoji picker component
│   ├── Feed/            # Real-time activity feed
│   └── Gallery/         # Image gallery and modal
├── services/
│   ├── instantdb.js    # InstantDB configuration
│   └── unsplash.js     # Unsplash API service
├── store/
│   └── userStore.js    # User state (Zustand)
├── utils/
│   └── userColors.js   # User color utilities
├── App.jsx             # Main app component
└── main.jsx            # App entry point
```

## License

MIT
