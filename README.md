# Form State Remembrancer 🔥

A modern, feature-rich Firefox extension that remembers and restores form states with beautiful animations, statistics tracking, and advanced functionality.

![Form State Remembrancer](icons/icon-96.png)

## ✨ Features

### 🎨 **Modern UI Design**
- **Beautiful gradient interface** with smooth animations
- **Tabbed navigation** for organized access to features
- **Responsive design** that adapts to content
- **Dark theme** with eye-catching purple-to-pink gradients
- **Micro-interactions** and hover effects throughout

### 📊 **Statistics & Analytics**
- **Real-time tracking** of saves and restores
- **Visual charts** showing 7-day usage history
- **Domain statistics** with most-used websites
- **Form detection** with accurate counting
- **Historical data** with timestamps

### 📝 **Advanced Form Management**
- **Smart form detection** including dynamic content
- **Auto-restore** functionality per website
- **Enhanced data structure** with metadata
- **Privacy-focused** with local storage only
- **Cross-browser compatibility**

### 🔔 **User Experience**
- **Toast notifications** for action confirmations
- **Keyboard shortcuts** for power users
- **Context menu** integration
- **Visual feedback** with animated indicators
- **Settings panel** for customization

### 💾 **Data Management**
- **Export functionality** for data backup
- **Import capability** to restore from backups
- **History tracking** with search and filter
- **Selective deletion** of history items
- **Clear all data** option

## 🚀 Installation

### From Firefox Add-ons Store
1. Visit the [Firefox Add-ons Store](https://addons.mozilla.org/)
2. Search for "Form State Remembrancer"
3. Click "Add to Firefox"
4. Grant necessary permissions

### From Source
1. Clone this repository:
   ```bash
   git clone https://github.com/zacpr/remembrancer.git
   ```
2. Open Firefox and navigate to `about:debugging`
3. Click "Load Temporary Add-on"
4. Select the `manifest.json` file from the cloned repository

## 🎮 Usage

### Basic Operations
1. **Save Form State**: Click the extension icon, then "Remember Form"
2. **Restore Form State**: Click "Restore Form" to repopulate saved data
3. **Auto-restore**: Toggle automatic restoration for specific websites
4. **Forget Data**: Remove saved form data for current page

### Keyboard Shortcuts
- **Ctrl+Shift+S** (Cmd+Shift+S on Mac): Save form state
- **Ctrl+Shift+R** (Cmd+Shift+R on Mac): Restore form state
- **Ctrl+Shift+A** (Cmd+Shift+A on Mac): Toggle auto-restore
- **Ctrl+Shift+F** (Cmd+Shift+F on Mac): Open extension popup

### Context Menu
Right-click on any page to access:
- Save Form State
- Restore Form State
- Open Form Remembrancer

### Statistics Dashboard
- View total saves and restores
- Check usage history with visual charts
- See top domains where forms are saved
- Track form detection across websites

### History Management
- Search through form save/restore history
- Export data for backup
- Import data from previous backups
- Clear specific history items

## ⚙️ Settings

### Notifications
- **Enable toast notifications** for visual feedback
- **Sound effects** for audio confirmations

### Keyboard Shortcuts
- Customize keyboard combinations
- View all available shortcuts
- Enable/disable specific shortcuts

### Data Management
- **Export all data** as JSON backup
- **Import data** from backup files
- **Clear all data** with confirmation
- **Auto-restore settings** per website

## 🔧 Technical Details

### Permissions Required
- `activeTab`: Access current tab content
- `storage`: Save form data locally
- `notifications`: Show toast notifications
- `contextMenus`: Add right-click menu options
- `commands`: Handle keyboard shortcuts

### Data Storage
- **Local storage only** - no data sent to external servers
- **Encrypted form data** with privacy protection
- **Metadata tracking** for statistics (URLs, timestamps, counts)
- **Password masking** for security

### Browser Compatibility
- **Firefox 60+** with WebExtensions API
- **Chrome compatibility** with minor modifications
- **Edge support** with Chromium-based versions

## 🛠️ Development

### Project Structure
```
FIREFOXFORMEMBEMER/
├── manifest.json          # Extension configuration
├── popup.html             # Main popup interface
├── popup.css              # Modern styling with gradients
├── popup.js               # Popup logic and interactions
├── background.js           # Background script handling
├── content.js             # Content script for form detection
├── icons/                 # Extension icons
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   └── icon-96.png
└── README.md              # This file
```

### Building from Source
1. Install dependencies (if any):
   ```bash
   npm install
   ```
2. Load extension in Firefox:
   - Navigate to `about:debugging`
   - Click "Load Temporary Add-on"
   - Select `manifest.json`

### Contributing
1. Fork the repository
2. Create a feature branch:
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. Commit your changes:
   ```bash
   git commit -m 'Add amazing feature'
   ```
4. Push to the branch:
   ```bash
   git push origin feature/amazing-feature
   ```
5. Open a Pull Request

## 🐛 Troubleshooting

### Common Issues

**Extension not working?**
- Check if Firefox is up to date
- Verify all permissions are granted
- Try disabling and re-enabling the extension

**Forms not being detected?**
- Refresh the page after extension loads
- Check if forms are inside iframes
- Verify form elements have proper attributes

**Data not saving/restoring?**
- Check browser storage permissions
- Clear extension data and try again
- Verify form fields have proper names/IDs

**Keyboard shortcuts not working?**
- Check for conflicts with other extensions
- Verify shortcuts in extension settings
- Try different key combinations

### Debug Mode
Enable debug logging by:
1. Open browser console (F12)
2. Look for "Form State Remembrancer" messages
3. Report issues with console output

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Acknowledgments

- **Firefox Add-ons Team** for extension framework
- **Open Source Community** for inspiration and tools
- **Users** for feedback and suggestions

## 📞 Support

- **GitHub Issues**: [Report bugs](https://github.com/zacpr/remembrancer/issues)
- **Feature Requests**: [Suggest improvements](https://github.com/zacpr/remembrancer/discussions)
- **Email**: [Contact developer](mailto:developer@example.com)

## 🔄 Changelog

### Version 2.0.0
- ✨ Complete UI redesign with modern gradients
- 📊 Added statistics and analytics dashboard
- 📝 Enhanced history tracking with search
- 🔔 Implemented toast notifications
- ⌨️ Added keyboard shortcuts
- 💾 Added export/import functionality
- 🎨 Created modern icon set
- 🚀 Performance improvements and bug fixes

### Version 1.1.0
- 🐛 Fixed form detection issues
- 🔧 Improved auto-restore functionality
- 📱 Better mobile compatibility

### Version 1.0.0
- 🎉 Initial release
- 💾 Basic save/restore functionality
- 🔄 Auto-restore feature

---

**Made with ❤️ by the Form Remembrancer Team**

[![GitHub stars](https://img.shields.io/github/stars/zacpr/remembrancer?style=social)](https://github.com/zacpr/remembrancer)
[![GitHub forks](https://img.shields.io/github/forks/zacpr/remembrancer?style=social)](https://github.com/zacpr/remembrancer)
[![GitHub issues](https://img.shields.io/github/issues/zacpr/remembrancer)](https://github.com/zacpr/remembrancer/issues)