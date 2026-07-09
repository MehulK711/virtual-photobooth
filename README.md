# 📸 SyncBooth: Real-Time Virtual Photobooth & AI Studio

[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white)](https://socket.io/)
[![WebRTC](https://img.shields.io/badge/WebRTC-333333?style=for-the-badge&logo=webrtc&logoColor=white)](https://webrtc.org/)

**SyncBooth** is a full-stack, peer-to-peer virtual photobooth that allows users to connect across the globe, sync their video feeds, and take synchronized photos. It features client-side machine learning for expression matching and a custom HTML5 Canvas engine for real-time decoration and exporting.

[**🌍 View Live Demo**](https://virtual-photobooth-ten.vercel.app/) | [**👨‍💻 Developer Portfolio**](https://mehul-kataria.vercel.app)

---

## ✨ Core Features

* **Peer-to-Peer Video Streaming:** Utilizes **WebRTC** for ultra-low latency, decentralized video streaming between clients, with **Socket.io** handling the initial signaling handshake.
* **Client-Side AI Pose Matching:** Integrates `@vladmandic/face-api` to run a lightweight neural network directly in the browser. The camera automatically triggers only when both users successfully match a randomized facial expression prompt (e.g., Surprise, Smile, Anger).
* **Synchronized State Management:** Real-time WebSockets ensure that when one user changes a frame theme, applies a CSS filter, or triggers the countdown, the partner's UI updates within milliseconds.
* **Custom Canvas Export Engine:** Bypasses heavy third-party image libraries by using native `HTML5 Canvas` math to intercept video streams, stitch frames side-by-side, apply filters, layer user drawings, and export a high-resolution PNG locally.
* **Interactive Decorator:** Features an interactive drawing pad with Pythagorean scaling logic for sticker placement, allowing users to customize their final photo strip before downloading.

## 🛠️ System Architecture

SyncBooth is built on a split architecture to separate the signaling logic from the heavy video processing.

### Frontend (Client)
* **Framework:** React + Vite + TypeScript
* **Styling:** Tailwind CSS
* **Media Handling:** `navigator.mediaDevices` & `RTCPeerConnection`
* **Machine Learning:** `face-api.js` (TinyFaceDetector & FaceExpressionNet)
* **Deployment:** Vercel

### Backend (Signaling Server)
* **Runtime:** Node.js + Express
* **WebSockets:** Socket.io
* **Role:** Acts purely as a signaling server to establish WebRTC peer connections and relay UI state changes. Video data is **never** routed through the server.
* **Deployment:** Render

---

## 🚀 Running Locally

To run this project on your local machine for development or testing:

### 1. Clone the repository
```bash
git clone [https://github.com/MehulK711/virtual-photobooth.git](https://github.com/MehulK711/virtual-photobooth.git)
cd virtual-photobooth

### 2. Start the server
```bash
cd server
npm install
npm run dev

### 3. Start the client
```bash
cd client
npm install
npm run dev

*The React app will start on `http://localhost:5173`*

### 4. Testing WebRTC Locally
Because modern browsers strictly block camera access on non-HTTPS connections, the easiest way to test the peer-to-peer connection locally is to open `http://localhost:5173` in your main browser, create a room, and open the invite link in an **Incognito Window** on the same machine.

---

## 🧠 Technical Learnings & Challenges
* **The WebRTC Handshake:** Managing the asynchronous exchange of ICE candidates and Session Descriptions (SDP) required careful Promise handling to ensure the video streams connected reliably regardless of which user joined the room first.
* **Vite vs. CommonJS AI Models:** Encountered and resolved strict module resolution conflicts during production builds by configuring Vite's `optimizeDeps` to properly handle legacy CommonJS machine learning libraries.
* **Hardware Camera Locks:** Engineered a resilient capture loop to gracefully handle scenarios where the operating system locks the physical webcam from being accessed by multiple browser instances simultaneously.

---
*Designed and engineered by [Mehul Kataria](https://mehul-kataria.vercel.app)*