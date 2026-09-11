# Instagram Download Helper (IG Helper)
<div align="center">
  
  [![](https://img.shields.io/badge/Kofi-F16061.svg?logo=ko-fi&logoColor=white)](https://ko-fi.com/F1F1J6VZH)
  [![](https://img.shields.io/discord/505936774531514388?color=5865F3&logo=discord&logoColor=white)](https://discord.gg/q3KT4hdq8x)

  Buy me a coffee, Donate to ig-helper if it makes your help. Your donation makes ig-helper better: [https://ko-fi.com/snkoarashi](https://ko-fi.com/snkoarashi)
</div>

**Simple and fast download of resources from Instagram (posts, reels, stories, and more).**

## 🎉 Features
- Force the fetching of all resources in the post.
- Download the resources in the post with one click.
- Download the resources currently displayed in the post with one click.
- Open the resource in a new window.
- Download the video thumbnail.
- Fetch high-quality photos or videos through the Media API.
- Disable video looping.
- Enable the native HTML5 video controller for video resources.
- Download the user's profile picture.
- Provide scroll buttons for Reels pages.
- Automatically modify and control the playback volume of all video elements.
- Redirect to a user's profile page when clicking on their avatar in the story area on the homepage.
- Customize the naming format when downloading according to your preferences.

## ⚙ How to Change Settings
1. Go to Instagram.com.
2. Check your Tampermonkey extension.
3. See the following:
<img src="https://i.imgur.com/tSSsl5K.gif" />

## 📌 Hot keys
- `ALT+Q` - Close pop-up window
- `ALT+W` - Open the settings menu
- `ALT+Z` - Open the debug menu
- `ALT+S` - Download resource in story page

## 📢 Developer Statement
1. All code development and testing are based on the Chrome browser and the extension Tampermonkey.
2. Due to the framework and personal differences used in Instagram development, the page layout and node names presented by each person may be different. Therefore, all development and testing are based on the pages I have seen, which may cause a few people to The script does not work, please forgive me.
3. Extensive use of this script, especially when enabling the "Media API" or "Force Fetch API," may trigger Instagram's automation bot checks, potentially leading to account warnings, being logged out, or even being banned. Please use it with caution.

> [!IMPORTANT]
> On GreasyFork: https://greasyfork.org/scripts/404535-ig-helper
> 
> The extensions we support and test is Tampermonkey and make sure that you are downloaded the script from GreasyFork.

Finally, I want to say that Instagram's inconsistent UI layout increased the development pain, especially the need to de-parse components built with React. Therefore, the malfunction of IG Helper was incredibly frustrating, but there was nothing I could do. I could only try to fix these parts in my spare time.

## ✨ Development Guide
This guide provides comprehensive documentation for developers who want to understand, modify, or contribute to the IG Helper codebase. It covers the build system, development environment setup, and contribution workflow.

### Development Environment Setup
#### Prerequisites
- Bun
- A userscript manager (Tampermonkey, Greasemonkey, or Violentmonkey)

#### Setup Steps
1. Clone the repository:
```
git clone https://github.com/martesi/ig-helper.git
cd ig-helper
```
2. Install dependencies:
```
bun install
```
3. Start the Vite development server:
```
bun run dev
```
Install the development userscript offered by vite-plugin-monkey for live development.

4. Build the release script:
```
bun run build
```
Install the generated `dist/ig-helper.user.js` file in your userscript manager.

For a GitHub release, update the version in `package.json`, then run the **Publish Release** workflow manually. vite-plugin-monkey builds `dist/ig-helper.user.js` and `dist/ig-helper.meta.js`; the workflow uploads both as a GitHub Actions artifact and as assets on the matching `v<version>` release.

### Contribution Workflow

#### Development Process
1. **Fork & Clone**: Fork the repository and clone it locally
2. **Branch**: Create a feature branch
3. **Develop**: Run `bun run dev` and make changes to the source files
4. **Build**: Run `bun run build` to generate `dist/ig-helper.user.js` and `dist/ig-helper.meta.js`
5. **Test**: Install the script in your userscript manager and test your changes
6. **Submit**: Create a pull request

#### Code Standards
- Follow the existing code style
- Use ESLint to ensure code quality: `bunx eslint src vite.config.mjs`
- Document new functions and features

## Contributiner
### [@Yomisana](https://github.com/yomisana)
- Menu design suggestions and batch-download ideas
- Enhancement suggestions

### [@sn-o-w](https://github.com/sn-o-w)
- Text translation (Romanian)
- Miscellaneous optimizations and enhancements, plus code debugging

<a href="https://github.com/SN-Koarashi/ig-helper/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=SN-Koarashi/ig-helper" />
</a>
