# 📱 Vision Assistance App

## 📝 Overview
The **Vision Assistance App** is designed to help individuals who are completely or heavily partially blind navigate the real world independently. It utilizes AI-powered object detection, haptic feedback, and emergency features to enhance accessibility and safety.

## ✨ Features

### 🔍 Object Detection & Distance Feedback
- Uses the mobile device’s camera to detect objects in real-time.
- Divides the field of view into **9 quadrants (3x3 grid)** to indicate object location.
- Estimates object distance using **vibration motors** (intensity-based feedback).
- Provides **haptic feedback** for better interaction.
- Recognizes **household items and human faces** accurately.

### 🎛️ Interactive Buttons & Controls
- **9 on-screen buttons** mapped to the 9 quadrants:
  1. 📝 **Describe Object in Detail** – Short description first, detailed info on press.
  2. 📞 **Call Emergency Contact** – Quick dial to a preset number (family, caretaker, etc.).
  3-9. 🎛️ Additional customizable buttons for:
     - **Voice commands** 🎙️.
     - **Saving object details** for later reference.
     - **Adjusting vibration intensity** ⚙️.
     - **Toggling features on/off** 📴.
- **Physical button shortcuts** using volume and power button combinations.

### 🚨 Accident Detection & Emergency Alerts
- **GPS functionality** for navigation and location tracking.
- **Fall detection** that automatically sends emergency alerts 📡.
- **Health info storage** at startup for medical emergencies 🏥.
- **Auto emergency message** 📩 with location and medical info sent to hospitals and family members.

### 🔧 Additional Features
- **Voice assistance** 🎙️ for optional audio cues.
- **Configurable grid system** (3x3 or 2x4) 📐 for different navigation needs.
- **AI-powered object recognition** 🤖 for improved accuracy.
- **Offline functionality** ⚡ for essential features.
- **Customizable vibration patterns** for different object types.

## 🚀 How It Works
1. Open the app 📲.
2. Point the camera at your surroundings 🎥.
3. Receive **real-time object detection feedback** with vibration and haptic cues 📳.
4. Use on-screen buttons for additional assistance 🎛️.
5. Enable **GPS navigation** or **fall detection alerts** for added safety 🗺️.

## 🛠️ Tech Stack
- **Language:** Java/Kotlin (Android) or Swift (iOS)
- **Machine Learning:** TensorFlow Lite / OpenCV
- **Haptic Feedback:** Android Vibration API, iOS Core Haptics
- **GPS & Emergency Alerts:** Google Maps API, Twilio API

## 📌 Future Enhancements
- 🌍 Multi-language support.
- 🎵 Dynamic sound cues for navigation.
- 🦾 Integration with smart wearables (e.g., neosapien).
- 🗂️ Cloud-based object recognition for improved AI training.

## 🏗️ Installation & Setup
1. Clone the repo:
   ```bash
   git clone https://github.com/yourusername/Vision-Assistance-App.git
   ```
2. Open the project in Android Studio/Xcode.
3. Build and install on a test device.

## 📜 License
This project is licensed under the **MIT License**.

---
👨‍💻 **Contributions are welcome!** Open an issue or create a pull request to suggest improvements. 🚀

