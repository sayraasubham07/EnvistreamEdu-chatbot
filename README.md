# 🎓 Sayraa — Envistream EduSkill AI Chatbot

> A multilingual, voice-enabled AI education and career assistant for **Envistream EduSkill**, built with React, Vite, Google Gemini, Firebase, and PWA technologies.

**Sayraa** is the official AI guide for Envistream EduSkill. It helps students, freshers, and learners discover training programs, internships, projects, career opportunities, and placement resources through conversational **text and voice interaction**.

---

## ✨ Overview

Sayraa is designed as a dedicated AI assistant for the Envistream EduSkill ecosystem.

It helps users with:

* 📚 Training and course information
* 💼 Internship program guidance
* 🎯 Placement and career support
* 🛠️ Project recommendations and guidance
* 📄 Resume and portfolio guidance
* 🎤 Interview and mock-interview preparation
* 🧭 Training and internship recommendations
* 📋 Course and program comparison
* 📝 Enrollment-related information
* 📍 Envistream location and contact information
* 🎙️ Voice-based interaction
* 🌐 English, Hindi, Odia and Hinglish conversations
* 📊 Persistent conversation history

---

# 🚀 Key Features

## 🤖 AI Education & Career Assistant

Sayraa uses **Google Gemini** to provide conversational assistance focused on the Envistream EduSkill ecosystem.

The AI can assist with:

* Courses
* Training programs
* Internships
* Projects
* Career paths
* Placement preparation
* Resume guidance
* Interview preparation
* Enrollment information
* Envistream information

The assistant is configured to keep conversations relevant to **education, training, internships, projects, and career development**.

---

## 🎯 Personalized Career Guidance

Sayraa can help users understand different career paths based on their:

* Skills
* Interests
* Educational background
* Preferred technology
* Career goals

Example:

```text
User:
Mujhe web development me career banana hai. Main beginner hoon.

Sayraa:
Aap Full Stack Web Development se start kar sakte hain.
Pehle HTML, CSS aur JavaScript fundamentals seekhiye,
phir React, Node.js aur database development par move kijiye.
```

---

## 🧭 Training & Internship Recommendations

Sayraa helps students identify suitable Envistream programs.

It can guide users based on:

* Current skill level
* Technology preference
* Career goal
* Training requirements
* Internship interests

Example:

```text
User:
Mujhe AI me interest hai aur main Python jaanta hoon.

Sayraa:
Aap AI/ML training aur AI/ML internship programs explore
kar sakte hain. Python ke saath NumPy, Pandas,
scikit-learn aur machine-learning projects par focus karna useful hoga.
```

---

## 📋 Course & Program Comparison

Users can ask Sayraa to compare different learning options.

Example:

```text
User:
Java aur MERN Stack me kya difference hai?

Sayraa:
Java backend and enterprise development ke liye widely used hai,
jabki MERN Stack modern full-stack web development ke liye
MongoDB, Express, React aur Node.js use karta hai.
```

---

## 🛠️ Project Guidance

Sayraa can recommend project ideas and explain how to build them.

It can help with:

* Project selection
* Technology selection
* Project architecture
* Feature planning
* Development roadmap
* Portfolio projects
* Internship project ideas

Example project areas:

* Full Stack Web Applications
* AI Applications
* Data Analytics
* Python Applications
* Java Applications
* Software Testing
* Digital Marketing

---

## 📄 Resume & Portfolio Guidance

Sayraa can guide students in improving their professional profile.

It can provide guidance for:

* Resume structure
* Project descriptions
* Technical skills
* GitHub profile
* Portfolio development
* LinkedIn profile
* Internship experience
* Fresher resume preparation

---

## 🎤 Placement & Interview Preparation

Sayraa supports career preparation through:

* Technical interview preparation
* HR interview preparation
* Mock interview questions
* Communication guidance
* Resume-based questions
* Programming interview preparation
* Role-specific preparation

Example:

```text
User:
Mujhe MERN developer interview ke liye prepare karna hai.

Sayraa:
Aapko JavaScript, React, Node.js, Express, REST APIs,
database concepts, authentication aur Git/GitHub par focus karna chahiye.
```

---

# 🎙️ AI Voice Input

Sayraa supports voice interaction using browser microphone capabilities.

### Voice Flow

```text
🎙️ User speaks
       ↓
🎤 Microphone
       ↓
🎧 Audio Recording
       ↓
🤖 Gemini Speech Processing
       ↓
📝 Speech-to-Text
       ↓
💬 Sayraa AI
       ↓
🔊 Voice Response
```

The voice system includes:

* MediaRecorder API
* Browser microphone access
* Noise suppression
* Echo cancellation
* Automatic gain control
* Gemini-based speech processing
* Hinglish transcription
* Custom Envistream terminology handling

---

# 🔊 Voice Output

Sayraa uses the browser's **Web Speech API** for voice responses.

The application:

* Detects available browser voices
* Selects a suitable Hindi/English voice
* Provides a natural conversational experience
* Automatically speaks AI responses
* Removes emojis from spoken responses
* Keeps emojis visible inside the chat UI

> Voice quality depends on the voices available on the user's browser and operating system.

---

# 🌐 Multilingual & Hinglish Support

Sayraa is designed for multilingual student interaction.

Supported conversational languages include:

* 🇬🇧 English
* 🇮🇳 Hindi
* 🟠 Odia
* 💬 Hinglish

### Hinglish Example

```text
User:
Envistream EduSkill me kaun kaun se courses available hain?

Sayraa:
Envistream EduSkill me Web Development, Python, Java,
AI, Software Testing, SAP aur Digital Marketing jaise
courses available hain.
```

---

# 🧠 Context-Aware Conversations

Sayraa maintains conversational context to provide more relevant responses.

For example:

```text
User:
Mujhe Python seekhna hai.

Sayraa:
Aap beginner hain ya Python ka basic knowledge hai?

User:
Basic knowledge hai.

Sayraa:
Aap Python ke saath AI/ML ya Data Analytics projects
explore kar sakte hain.
```

---

# 📊 Persistent Chat History

Authenticated users can maintain their conversation history.

Chat history can include:

* Previous conversations
* User messages
* AI responses
* Conversation timestamps
* Session information

Firebase Firestore is used for persistent data storage.

---

# 🔐 Authentication

Sayraa supports authentication using **Firebase Authentication**.

Current authentication functionality includes:

* Google Sign-In
* Authenticated user sessions
* Protected user data
* Persistent chat history

---

# 📱 Progressive Web App

Sayraa is built with **PWA capabilities**, allowing users to use the application like an installable app.

Features include:

* Installable application
* Responsive design
* Mobile-friendly interface
* Desktop support
* Optimized loading
* App-like experience

---

# ⚡ Performance & UX

The frontend is optimized for a smooth conversational experience.

The application includes:

* Lazy loading
* Optimized frontend assets
* Responsive UI
* Loading states
* Error handling
* API failure handling
* Mobile-first interaction
* Accessible voice controls

---

# 📍 Envistream Information Assistant

Sayraa can provide information related to:

* Envistream EduSkill
* Training programs
* Internship programs
* Enrollment
* Contact information
* Location
* Available learning opportunities

The goal is to provide students with a single conversational entry point to the Envistream ecosystem.

---

# 🏗️ Technology Stack

### Frontend

* React.js
* Vite
* JavaScript
* CSS / Tailwind CSS
* Responsive UI

### AI

* Google Gemini API
* Gemini-based conversational responses
* Gemini speech processing

### Backend / Services

* Firebase
* Firebase Authentication
* Firebase Firestore
* Serverless API endpoints

### Voice

* MediaRecorder API
* Web Speech API
* Browser microphone APIs

### Application

* Progressive Web App
* Responsive Web Design
* Lazy Loading

### Development Tools

* Git
* GitHub
* VS Code
* Vite

---

# 📂 Project Structure

```text
sayraa/
│
├── public/
│   ├── icons/
│   ├── images/
│   └── manifest.json
│
├── src/
│   ├── components/
│   ├── pages/
│   ├── services/
│   ├── hooks/
│   ├── utils/
│   ├── firebase/
│   ├── styles/
│   └── App.jsx
│
├── api/
│   └── Gemini API endpoints
│
├── package.json
├── vite.config.js
├── README.md
└── .gitignore
```

> Adjust the structure above to match the actual repository structure.

---

# 🔑 Environment Variables

Create a `.env` file for local development.

```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
```

For Gemini API credentials, use a secure server-side/serverless environment whenever possible.

> Never commit private API keys, service-account credentials, or secrets to GitHub.

---

# 🔄 Application Flow

```text
                    ┌─────────────────┐
                    │      User       │
                    └────────┬────────┘
                             │
                 ┌───────────┴───────────┐
                 │                       │
             💬 Text                  🎙️ Voice
                 │                       │
                 └───────────┬───────────┘
                             ↓
                    ┌─────────────────┐
                    │     Sayraa      │
                    │   AI Assistant  │
                    └────────┬────────┘
                             ↓
                    ┌─────────────────┐
                    │ Google Gemini   │
                    └────────┬────────┘
                             ↓
                 ┌───────────┴───────────┐
                 │                       │
             💬 Text Response       🔊 Voice Response
                 │                       │
                 └───────────┬───────────┘
                             ↓
                         👤 User
```

---

# 🎓 Student Journey

Sayraa connects the major Envistream EduSkill services:

```text
Explore Training
       ↓
Choose Skills
       ↓
Learn
       ↓
Build Projects
       ↓
Apply for Internship
       ↓
Gain Practical Experience
       ↓
Prepare for Placement
       ↓
Build Career
```

---

# 🛡️ Security Considerations

The application follows basic security practices including:

* Firebase Authentication
* Protected database access
* Environment variables
* Server-side API handling where applicable
* Input validation
* Error handling
* Restricted AI scope
* No API secrets committed to the repository

---

# 🚀 Getting Started

## 1. Clone the Repository

```bash
git clone <repository-url>
cd sayraa
```

## 2. Install Dependencies

```bash
npm install
```

## 3. Configure Environment Variables

Create the required `.env` file and add your Firebase and Gemini configuration.

## 4. Start Development Server

```bash
npm run dev
```

The application will run on the local Vite development server.

---

# 🏭 Production Build

Create a production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

---

# 🌐 Deployment

Sayraa can be deployed using platforms such as:

* Vercel
* Firebase Hosting
* Netlify
* Other compatible web hosting platforms

Ensure all required environment variables are configured in the deployment platform.

---

# 🧪 Error Handling

Sayraa handles common application failures such as:

* Microphone permission denial
* Gemini API errors
* Network failures
* Authentication errors
* Firestore errors
* Empty voice input
* Unsupported browser voice features
* Invalid user input

Users receive clear feedback instead of application crashes.

---

# 🔮 Future Enhancements

Planned or possible improvements include:

* 🗣️ Improved native Odia voice quality
* 🎧 Real-time voice conversation
* 🧠 More personalized career recommendations
* 📊 Student learning dashboard
* 📚 AI-powered study plans
* 🎤 AI mock interviews
* 📄 AI resume analysis
* 🧑‍💼 Internship application tracking
* 🔔 Important application notifications
* 🌐 Expanded regional-language support
* 📱 Enhanced offline PWA capabilities

---

# 🎯 Mission

> **Make learning, internships, projects and career guidance more accessible through an intelligent conversational AI assistant.**

Sayraa aims to become a single AI-powered companion that helps students move from:

**Learning → Practice → Projects → Internship → Career**

---

# 👨‍💻 Developed For

**Envistream EduSkill**

Training • Internships • Projects • Career Development

---

## 📄 License

This project is intended for use within the **Envistream EduSkill** ecosystem.

Add the appropriate license here if this repository will be distributed publicly.
