# ModTube - Video Streaming Platform Frontend

A modern video streaming platform built with React, Vite, and Tailwind CSS with JWT authentication.

## Features

- 🔐 JWT Authentication (Login/Register)
- 📹 Video Upload with Chunked Upload Support
- 🎬 HLS Video Streaming
- 🔍 Video Search
- 👍 Like/Unlike Videos
- 👁️ View Counter
- 📱 Responsive Design
- 🎨 Modern UI with Tailwind CSS

## Tech Stack

- **React 18** - UI Framework
- **Vite** - Build Tool
- **React Router** - Routing
- **Axios** - HTTP Client
- **HLS.js** - Video Streaming
- **Tailwind CSS** - Styling
- **Lucide React** - Icons

## Prerequisites

- Node.js 16+ 
- npm or yarn
- Backend API running on `http://172.22.111.47:8081`

## Installation

1. **Clone the repository or navigate to the project directory**

```bash
cd video-streaming-frontend
```

2. **Install dependencies**

```bash
npm install
```

3. **Start the development server**

```bash
npm run dev
```

The application will start on `http://172.22.111.47:3000`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Project Structure

```
src/
├── components/          # Reusable components
│   ├── Navbar.jsx
│   ├── VideoCard.jsx
│   ├── VideoPlayer.jsx
│   └── PrivateRoute.jsx
├── pages/              # Page components
│   ├── Login.jsx
│   ├── Register.jsx
│   ├── Home.jsx
│   ├── VideoDetail.jsx
│   ├── Upload.jsx
│   ├── Search.jsx
│   └── MyVideos.jsx
├── services/           # API services
│   ├── api.js
│   ├── authService.js
│   └── videoService.js
├── context/            # React Context
│   └── AuthContext.jsx
├── App.jsx            # Main App component
├── main.jsx           # Entry point
└── index.css          # Global styles
```

## Authentication

The application uses JWT tokens stored in localStorage:

- Token is automatically added to all API requests
- Protected routes redirect to login if not authenticated
- Token is removed on logout or 401 errors

## API Endpoints

The frontend expects the following backend endpoints:

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register

### Videos
- `GET /api/videos` - List all videos (paginated)
- `GET /api/videos/{id}` - Get single video
- `GET /api/videos/search` - Search videos
- `POST /api/videos/{id}/view` - Increment view count
- `POST /api/videos/{id}/like` - Like video
- `DELETE /api/videos/{id}/like` - Unlike video
- `DELETE /api/videos/{id}` - Delete video

### Upload
- `POST /api/upload/init` - Initialize upload
- `POST /api/upload/chunk` - Upload video chunk
- `POST /api/upload/complete` - Complete upload
- `GET /api/upload/videos` - Get my videos

### HLS Streaming
- `GET /hls/**` - HLS video segments

## Environment Variables

You can configure the API base URL in `vite.config.js`:

```javascript
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://172.22.111.47:8081', // Your backend URL
        changeOrigin: true,
      }
    }
  }
})
```

## Building for Production

```bash
npm run build
```

The build output will be in the `dist` directory.

## Video Upload

The upload feature supports:
- Chunked uploads (5MB chunks)
- Progress tracking
- File validation
- Large file support (up to 10GB)

## Video Player

The video player features:
- HLS streaming support
- Custom controls
- Progress bar
- Volume control
- Fullscreen mode
- Mobile responsive

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

## License

MIT
