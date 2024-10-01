class ThemeManager {
    constructor(githubUsername, githubRepo) {
      this.githubUsername = githubUsername;
      this.githubRepo = githubRepo;
      this.currentTheme = 'default';
      this.themeLink = document.createElement('link');
      this.themeLink.rel = 'stylesheet';
      document.head.appendChild(this.themeLink);
      this.themes = [];
    }
  
    async fetchThemes() {
      const apiUrl = `https://api.github.com/repos/${this.githubUsername}/${this.githubRepo}/contents`;
      try {
        const response = await fetch(apiUrl);
        const files = await response.json();
        const themeFiles = files.filter(file => file.name.startsWith('theme-') && file.name.endsWith('.css'));
        
        if (themeFiles.length > 0) {
          this.themes = themeFiles.map(file => file.name.replace('theme-', '').replace('.css', ''));
          this.addThemeSelector();
          await this.applyTheme(this.currentTheme);
        }
      } catch (error) {
        console.error('Error fetching themes:', error);
      }
    }
  
    async applyTheme(themeName) {
      if (!this.themes.includes(themeName)) {
        console.error(`Theme ${themeName} not found`);
        return;
      }
  
      const themeUrl = `https://raw.githubusercontent.com/${this.githubUsername}/${this.githubRepo}/main/theme-${themeName}.css`;
      try {
        const response = await fetch(themeUrl);
        if (response.ok) {
          const css = await response.text();
          this.themeLink.href = 'data:text/css;charset=UTF-8,' + encodeURIComponent(css);
          this.currentTheme = themeName;
          localStorage.setItem('selectedTheme', themeName);
          if (this.selector) {
            this.selector.value = themeName;
          }
        } else {
          console.error(`Failed to load theme: ${themeName}`);
        }
      } catch (error) {
        console.error(`Error applying theme ${themeName}:`, error);
      }
    }
  
    addThemeSelector() {
      this.selector = document.createElement('select');
      this.selector.id = 'theme-selector';
      this.themes.forEach(theme => {
        const option = document.createElement('option');
        option.value = theme;
        option.textContent = theme.charAt(0).toUpperCase() + theme.slice(1);
        this.selector.appendChild(option);
      });
      this.selector.value = this.currentTheme;
      this.selector.addEventListener('change', (e) => this.applyTheme(e.target.value));
      
      const label = document.createElement('label');
      label.htmlFor = 'theme-selector';
      label.textContent = 'Theme: ';
      
      const container = document.createElement('div');
      container.id = 'theme-container';
      container.appendChild(label);
      container.appendChild(this.selector);
      
      document.body.insertBefore(container, document.body.firstChild);
    }
  
    async initialize() {
      await this.fetchThemes();
      const savedTheme = localStorage.getItem('selectedTheme');
      if (savedTheme && this.themes.includes(savedTheme)) {
        await this.applyTheme(savedTheme);
      } else if (this.themes.length > 0) {
        await this.applyTheme(this.themes[0]);
      }
    }
  }