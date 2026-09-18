# 🎓 Sayraa — Envistream EduSkill AI Chatbot

> A multilingual, voice-enabled AI education companion for Envistream EduSkill, built with React, Vite, Google Gemini, Firebase, and PWA technologies.

Sayraa is an AI-powered educational and career guidance assistant designed specifically for **Envistream EduSkill**. It helps students and freshers understand training programs, internships, projects, placements, and career opportunities through conversational text and voice interaction.

---

## ✨ Overview

**Sayraa** is the official AI guide for Envistream EduSkill.

The chatbot is designed to help students with:

- 📚 Course and training information
- 💼 Internship program guidance
- 🎯 Placement and career support
- 🛠️ Project guidance
- 📝 Enrollment-related information
- 📍 Envistream EduSkill location and contact information
- 🎙️ Voice-based interaction
- 🌐 Hinglish conversational support

Sayraa uses **Google Gemini** for AI responses and speech-to-text processing.

The application also includes:

- Google authentication
- Firebase Firestore
- Persistent chat history
- Voice input
- Voice output
- Progressive Web App support
- Responsive UI
- Error handling
- Lazy/optimized frontend loading
- Serverless API endpoints

---

# 🚀 Features

## 🤖 AI Education Assistant

Sayraa uses Google Gemini to provide conversational guidance related to Envistream EduSkill.

The AI is configured to focus on:

- Courses
- Training programs
- Internships
- Projects
- Placement support
- Career guidance
- Enrollment
- Location
- Contact information

The chatbot is intentionally restricted to Envistream EduSkill-related queries.

---

## 🎙️ AI Voice Input

Sayraa supports voice interaction using browser microphone capabilities.

The application can:

1. Request microphone permission
2. Record the user's voice
3. Process the audio
4. Send the audio to the Gemini speech-to-text endpoint
5. Convert the speech into text
6. Send the transcript to Sayraa
7. Generate an AI response

The voice system includes:

- MediaRecorder
- Microphone access
- Noise suppression
- Echo cancellation
- Automatic gain control
- Gemini-based speech transcription
- Hinglish transcription
- Custom Envistream EduSkill pronunciation correction

---

## 🔊 Voice Output

Sayraa uses the browser's **Web Speech API** for voice responses.

The application:

- Selects an available Hindi voice
- Prefers clearer/natural voices when available
- Uses a slightly feminine voice profile
- Speaks Sayraa's responses automatically
- Removes emojis from spoken output
- Keeps emojis visible in the chat interface

Voice output depends on the voices available in the user's browser and operating system.

---

## 🌐 Hinglish Support

Sayraa is currently designed around **Hinglish conversation**.

The AI understands English and Hindi/Hinglish input and responds using:

> Hindi written using English/Roman letters.

Example:

```text
User:
Envistream EduSkill me kaun kaun se courses available hain?

Sayraa:
Envistream EduSkill me Web Development, Python, Java,
AI, Software Testing, SAP aur Digital Marketing jaise courses available hain.