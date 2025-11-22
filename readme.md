# 2025-Econ-Life-Four-Cut

A comprehensive project for creating interactive "Life Four-Cut" photo strips by Economics students. This application integrates a backend server, printer communication, and a responsive frontend to deliver a seamless user experience from photo capture to physical print output.

## Overview

This project enables users to generate custom four-cut photos (a popular strip format with four frames) with economic life themes. It includes:
- A backend server for image processing and real-time communication
- A printer client for handling physical print output
- Responsive frontend interfaces for different devices (iPad, iMac, admin)
- Google Drive integration for image storage

## Project Structure

```
2025-Econ-Life-Four-Cut/
├── server/                 # Backend server and core logic
│   ├── public/             # Frontend static assets
│   │   ├── css/            # Stylesheets
│   │   ├── js/             # Client-side scripts
│   │   ├── ipad.html       # iPad interface
│   │   ├── imac.html       # iMac interface
│   │   ├── admin.html      # Admin control panel
│   │   └── manifest.json   # PWA configuration
│   ├── index.js            # Server entry point
│   └── package.json        # Server dependencies
├── printer/                # Printer client
│   ├── index.js            # Printer client logic
│   └── package.json        # Printer dependencies
└── .gitignore              # Git ignore configuration
```

## Core Components

### 1. Server

The backend server handles image processing, API endpoints, real-time communication, and Google Drive integration.

#### Key Features:
- Composite image generation using `sharp` and `canvas`
- Real-time updates with Socket.io
- Google Drive integration for image storage
- File upload handling with `multer`
- Device status tracking (iPad, iMac, PrinterPC, Admin)

#### Dependencies:
- `express`: Web framework
- `socket.io`: Real-time communication
- `sharp`: High-performance image processing
- `canvas`: 2D drawing API for image composition
- `googleapis`: Google Drive integration
- `multer`: File upload handling

#### Server Setup Instructions:
1. Navigate to the server directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   node index.js
   ```

   *Note: The server requires Node.js version `^18.12.0 || >= 20.9.0` due to the `canvas` dependency.*

### 2. Printer Client

Manages communication between the server and physical printers to output generated four-cut photos.

#### Key Features:
- Processes image URLs from the server
- Formats images for optimal printing
- Handles printer communication

#### Dependencies:
- `axios`: HTTP client for server communication
- `socket.io-client`: Real-time updates from the server

#### Printer Client Setup Instructions:
1. Navigate to the printer directory:
   ```bash
   cd printer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the client:
   ```bash
   node index.js
   ```

### 3. Frontend Interfaces

Responsive web interfaces optimized for different devices, configured as a Progressive Web App (PWA).

#### Available Interfaces:
- **iPad Interface**: `/ipad.html` - Optimized for iPad devices
- **iMac Interface**: `/imac.html` - Desktop interface
- **Printer PC Interface**: `/printerPC.html` - Printer management
- **Admin Panel**: `/admin.html` - Administrative controls

#### PWA Features:
- Fullscreen and minimal UI options
- Themed color scheme (`#FFC0CB` for background and theme)
- Offline capabilities (configured via `manifest.json`)

## Admin Panel Usage

The admin panel (`/admin.html`) provides control over the application with the following features:

### Authentication
- Click "Sign-in with Google" to authenticate with Google Drive
- Check authentication status in the "Google Drive Authentication" section

### Quick Actions
- "Send Test Message": Sends a test message to connected devices
- "Refresh Status": Updates the status of all connected devices
- "Back": Returns to the main interface

### Device Status Monitoring
- Tracks online/offline status for:
  - iPad
  - iMac
  - PrinterPC
  - Admin

### Command Console
- Input field for sending commands to connected devices
- Supported commands (see `admin.js` for details):
  - `clear`: Clears the console
  - `reload()`: Reloads the iMac interface
  - `alert("message")`: Sends an alert to the iPad
  - `:ready`: Sends a ready status to devices
  - Any other executable JavaScript Commands

## Google Drive

Photos are automatically uploaded to a dedicated Google Drive folder "Econ Life Four-Cut Photos" under the school-provided account `infoday2526@scc.edu.hk`.

This leverages the institution’s Google Workspace for Education suite, ensuring seamless integration, sufficient storage, and secure access control.

Visitors simply scan the displayed QR code to instantly view and download their high-resolution photo online.

## Image Processing Workflow

1. The server loads a background template
2. User photos are positioned according to frame definitions
3. Foreground elements are added to complete the composition
4. The final image is saved locally and uploaded to Google Drive
5. A link to the image is broadcast to connected devices
6. The printer client processes the image URL and handles printing

## Environment Configuration

### Required Environment Variables
Create a `.env` file in the server directory with the following variables:
- Google API credentials
- Server configuration parameters
- Printer settings

## Technical Requirements

- **Server Node.js Version**: `^18.12.0 || >= 20.9.0` (required by `canvas`)
- **Printer Client Node.js Version**: `>=4.0`
- Modern web browser for frontend interfaces

## Demo Report

**Author:** Ming Chu  
**Project Objective:** To develop a fully automated, interactive photo booth service for visitors at the Economics Booth during the 2025 SCC Open Day.  
**Status:** Functional demo completed; requires further UI/UX design, hardware integration testing, and debugging.

### Development Progress Timeline

| Date       | Achievements |
|------------|--------------|
| **14 Nov** | Project assigned. Brainstormed features, designed system flowchart, and planned hardware setup (iMac as camera host, iPad as user interface, printer integration). |
| **15 Nov** | Implemented real-time server–client communication using Socket.IO.<br>Preliminarily designed and scripted `/iMac.html` (camera host interface). |
| **16 Nov** | Completed core functionality of `/iPad.html` (user-facing interaction tablet).<br>Further refined `/iMac.html` with improved camera controls and synchronization. |
| **17 Nov** | Built result-generation system (frame + filter overlay).<br>Integrated Google Drive automatic upload and online photo gallery for review.<br>Added “Skip” button for optional steps (currently unstyled). |
| **18 Nov** | Developed `/printer` service endpoint and basic print queue logic (untested with physical printer). |
| **20 Nov** | Tested with the camera, succes. |

### Current Demo Features (End-to-End Flow)

Visitors can now complete the entire experience independently:

1. **Select Frame** – Choose from available decorative frames  
2. **Select Filter** – Apply real-time color/effect filters  
3. **Take Photo** – Live camera view on iMac, triggered from iPad  
4. **Preview Photo** – Full-screen preview with applied frame and filter  
5. **Access Online Copy** – Scan QR code linking to high-resolution photo on Google Drive  
6. **Optional Purchase** – Add a physical keychain printout (printer integration pending)

The demo is fully functional from start to finish without dedicated styling.

### Next Steps & Action Plan

| Priority | Task                              | Details                                      | Status     |
|----------|-----------------------------------|----------------------------------------------|------------|
| 1        | Redesign `/iPad.html`             | Modern, booth-themed UI/UX with large touch targets | Not started |
| 2        | Redesign Frames & Overlays        | Create Economics/SCC 2025 themed frames       | Not started |
| 3        | Re-configure Filters              | Add fun, event-relevant filters (e.g., money rain, charts) | Not started |
| 4        | Printer Integration & Testing     | Test with actual thermal/photo printer, handle errors | In progress (code only) |
| 5        | Full-System Stress Test           | Simulate 50–100 consecutive users, check stability | Pending    |
| 7        | Final Polish & On-site Deployment | Styling, error handling, offline fallback    | Pending    |

## Remarks
The core technical backbone (camera → processing → upload → QR display) is complete and stable. The remaining work is primarily aesthetic enhancement and robust hardware integration to ensure smooth operation during the actual Open Day event.

**Target Completion:** Before SCC Open Day 2025  
We are on track for a polished, reliable, and engaging photo booth experience.