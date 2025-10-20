# 🐺 QA Wolf Take Home Assignment - Enhanced with Web Interface

Welcome to the enhanced QA Wolf take home assignment! This project now includes a modern web interface inspired by the web scraper application you saw.

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm

### Installation & Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the web interface:**
   ```bash
   npm start
   ```

3. **Open your browser:**
   Navigate to `http://localhost:3000`

### Alternative: Run Scraper Directly
```bash
npm run scrape
```

## 🎯 Assignment Requirements

### Question 1 - Enhanced Implementation

The original assignment has been enhanced with:

1. **Modern Web Interface**: A beautiful, responsive web UI inspired by modern web scraper applications
2. **Real-time Progress Tracking**: Visual progress bar and status updates
3. **Dark/Light Theme**: Toggle between themes with persistent preferences
4. **Structured Results**: Clean, formatted output display
5. **Error Handling**: Comprehensive error reporting and user feedback

**Core Functionality:**
- Navigates to [Hacker News/newest](https://news.ycombinator.com/newest)
- Validates that EXACTLY 100 articles are sorted from newest to oldest
- Uses Playwright for web automation
- Handles pagination to collect sufficient articles
- Provides detailed validation results

### Question 2 - Video Submission

Please record a ~2 min video using [Loom](https://www.loom.com/) that includes:

1. Your answer to why you want to work at QA Wolf
2. A walk-through demonstration of the enhanced web interface
3. Show successful execution of the scraper

## 🏗️ Project Structure

```
qa_wolf_take_home/
├── public/
│   ├── index.html          # Main web interface
│   ├── styles.css          # Modern CSS styling
│   └── script.js           # Frontend JavaScript
├── index.js                # Enhanced Playwright scraper
├── server.js               # Express server for web interface
├── package.json            # Dependencies and scripts
├── playwright.config.js    # Playwright configuration
└── README.md              # This file
```

## ✨ Features

### Web Interface Features
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Theme Toggle**: Switch between light and dark modes
- **Progress Tracking**: Real-time progress updates during scraping
- **Results Display**: Formatted output with syntax highlighting
- **Error Handling**: User-friendly error messages
- **Loading States**: Visual feedback during operations

### Scraper Enhancements
- **Modular Architecture**: Clean, maintainable code structure
- **Comprehensive Error Handling**: Try-catch blocks throughout
- **Detailed Logging**: Step-by-step progress reporting
- **Configuration Management**: Centralized settings
- **Robust Pagination**: Handles multiple pages reliably
- **Timestamp Parsing**: Supports both ISO and relative time formats

## 🛠️ Technical Implementation

### Backend (Node.js + Express)
- Serves static files and API endpoints
- Spawns Playwright processes
- Parses scraper output into structured data
- Handles errors gracefully

### Frontend (Vanilla JavaScript)
- Modern ES6+ JavaScript
- CSS Grid and Flexbox layouts
- Local storage for theme preferences
- Fetch API for backend communication

### Playwright Integration
- Headless browser automation
- Robust element selection and waiting
- Multi-page navigation
- Comprehensive data extraction

## 🎨 Design Philosophy

The interface follows modern web design principles:
- **Clean & Minimal**: Focus on functionality without clutter
- **Accessible**: Proper contrast ratios and keyboard navigation
- **Responsive**: Adapts to different screen sizes
- **Intuitive**: Clear visual hierarchy and user flow

## 🔧 Development

### Available Scripts
- `npm start` - Start the web server
- `npm run scrape` - Run scraper directly (command line)
- `npm run dev` - Development mode (same as start)

### Customization
- Modify `public/styles.css` for styling changes
- Update `public/script.js` for frontend behavior
- Adjust `server.js` for backend modifications
- Enhance `index.js` for scraper improvements

## 📝 Submission

When ready to submit:

1. **Delete node_modules**: `rm -rf node_modules`
2. **Zip the project folder**
3. **Upload to the application page**: [QA Wolf Application](https://www.task-wolf.com/apply-qae)
4. **Include your Loom video** with the walkthrough

## 🌟 Going Above and Beyond

This enhanced implementation demonstrates:
- **Full-stack development** skills
- **Modern web technologies** proficiency
- **User experience** consideration
- **Code organization** and maintainability
- **Error handling** and robustness
- **Responsive design** principles

The web interface makes the assignment more engaging and showcases additional technical skills beyond the core Playwright requirements.

---

**Note**: This is a development preview. The web interface is designed to demonstrate technical capabilities and provide a better user experience for testing the scraper functionality.