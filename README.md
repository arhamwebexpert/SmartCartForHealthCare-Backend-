# Smart Cart for Healthcare - Backend

This is the backend server for the Smart Cart for Healthcare project. It provides RESTful APIs and WebSocket functionality for real-time communication with the smart cart system.

## 🚀 Features

- RESTful API endpoints for cart management
- WebSocket server for real-time communication
- SQLite database for data persistence
- CORS enabled for cross-origin requests

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v14 or higher)
- npm (Node Package Manager)

## 🛠️ Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd SmartCartForHealthCare-Backend-
```

2. Install dependencies:
```bash
npm install
```

## 🔧 Configuration

The server uses the following default configurations:
- Port: 5000
- Database: SQLite (database.sqlite)

## 🚀 Running the Server

To start the server:

```bash
node app.js
```

For development with auto-reload:
```bash
npx nodeman app.js
```

## 📦 Dependencies

- express: ^5.1.0 - Web framework for Node.js
- cors: ^2.8.5 - Cross-Origin Resource Sharing middleware
- sqlite3: ^5.1.7 - SQLite database driver
- ws: ^8.18.2 - WebSocket client and server implementation
- nodeman: ^1.1.2 - Development tool for auto-reloading

## 📁 Project Structure

```
SmartCartForHealthCare-Backend-/
├── app.js              # Main application file
├── ws-server.js        # WebSocket server implementation
├── database.sqlite     # SQLite database file
├── package.json        # Project dependencies and scripts
└── node_modules/       # Installed dependencies
```

## 🔌 API Endpoints

The backend provides various RESTful endpoints for cart management. Detailed API documentation will be added here.

## 🔐 Security

- CORS is enabled for cross-origin requests
- SQLite database for secure data storage
- WebSocket connections are handled securely

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the ISC License.

## 👥 Authors

- Your Name - Initial work

## 🙏 Acknowledgments

- Thanks to all contributors who have helped shape this project
