class FrontendStaticBlogGenerator {
    constructor(githubUsername, githubRepo, containerId) {
      this.githubUsername = githubUsername;
      this.githubRepo = githubRepo;
      this.container = document.getElementById(containerId);
      this.posts = [];
      this.tags = {};
      this.config = {
        title: "My Blog",
        author: "Anonymous",
        aboutme: "Welcome to my blog!",
      };
      this.currentPage = 1;
      this.postsPerPage = 5;
      this.currentSort = "date"; // 'date' or 'title'
      this.currentGroup = "none"; // 'none', 'tags', 'month', or 'year'
    }
  
    async fetchMarkdownFiles() {
      const apiUrl = `https://api.github.com/repos/${this.githubUsername}/${this.githubRepo}/contents`;
      try {
        const response = await fetch(apiUrl);
        const files = await response.json();
  
        for (const file of files) {
          if (
            file.name.endsWith(".md") &&
            !["readme.md", "config.md"].includes(file.name.toLowerCase())
          ) {
            try {
              const content = await this.fetchFileContent(file.download_url);
              await this.parseMarkdown(file.name, content);
            } catch (error) {
              console.error(`Error processing file ${file.name}:`, error);
              this.posts.push(this.createErrorPost(file.name, error));
            }
          }
        }
      } catch (error) {
        console.error("Error fetching files:", error);
        this.showErrorPage("Failed to fetch blog posts. Please try again later.");
      }
    }
  
    async fetchConfig() {
      try {
        const configContent = await this.fetchFileContent(
          `https://raw.githubusercontent.com/${this.githubUsername}/${this.githubRepo}/main/config.md`
        );
        this.config = this.parseConfig(configContent);
      } catch (error) {
        console.error("Error fetching config:", error);
      }
    }
  
    parseConfig(content) {
      const lines = content.split("\n");
      const config = {};
      let currentKey = "";
  
      for (const line of lines) {
        if (line.startsWith("# ")) {
          currentKey = line.substring(2).trim().toLowerCase();
          config[currentKey] = "";
        } else if (currentKey) {
          config[currentKey] += line + "\n";
        }
      }
  
      // Trim whitespace from all values
      for (const key in config) {
        config[key] = config[key].trim();
      }
  
      return config;
    }
  
    async fetchFileContent(url) {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.text();
    }
  
    async parseMarkdown(filename, content) {
      try {
        const [, frontmatter, markdown] = content.split("---");
        const metadata = this.parseFrontmatter(frontmatter);
        const htmlContent = marked.parse(markdown);
  
        const post = {
          filename,
          ...metadata,
          content: htmlContent,
        };
  
        this.posts.push(post);
  
        // Update tags
        for (const tag of post.tags || []) {
          if (!this.tags[tag]) {
            this.tags[tag] = [];
          }
          this.tags[tag].push(post);
        }
      } catch (error) {
        console.error(`Error parsing markdown for ${filename}:`, error);
        this.posts.push(this.createErrorPost(filename, error));
      }
    }
  
    createErrorPost(filename, error) {
      return {
        filename,
        title: `Error in ${filename}`,
        date: new Date().toISOString().split("T")[0],
        tags: ["error"],
        description: "This post could not be parsed due to an error.",
        content: `<p>An error occurred while trying to parse this post: ${error.message}</p>`,
      };
    }
  
    parseFrontmatter(frontmatter) {
      const lines = frontmatter.trim().split("\n");
      const metadata = {};
      for (const line of lines) {
        const [key, value] = line.split(":").map((s) => s.trim());
        if (key === "tags") {
          metadata[key] = value.split(",").map((tag) => tag.trim());
        } else {
          metadata[key] = value;
        }
      }
      return metadata;
    }
  
    generatePages() {
      document.querySelector("title").innerHTML = this.config.title || "error fetching title!";
      this.generateHomePage();
      this.generateAboutPage();
      this.generatePostsPage();
      this.generatePostPages();
      this.generateTagPages();
    }
  
    generateHomePage() {
      const homeHtml = `
      <h1>${this.config.title}</h1>
      <p>By ${this.config.author}</p>
      <nav>
        <ul>
          <li><a href="#" onclick="app.showAboutPage()"><i class="fas fa-user"></i> About Me</a></li>
          <li><a href="#" onclick="app.showPostsPage()"><i class="fas fa-book"></i> Blog Posts</a></li>
        </ul>
      </nav>
    `;
      this.container.innerHTML = homeHtml;
    }
  
    generateAboutPage() {
      this.aboutHtml = `
      ${this.generateBreadcrumb(["About"])}
      <h1>About Me</h1>
      <p>${this.config.aboutme}</p>
      <p><a href="#" onclick="app.generateHomePage()"><i class="fas fa-home"></i> Back to Home</a></p>
    `;
    }
  
    sortPosts(posts, sortBy = this.currentSort) {
      return [...posts].sort((a, b) => {
        if (sortBy === "title") {
          console.log(a.title, b.title);
          return a.title.localeCompare(b.title);
        } else {
          // 'date'
          return new Date(b.date) - new Date(a.date);
        }
      });
    }
  
    groupPosts(posts, groupBy = this.currentGroup) {
      if (groupBy === "none") return { "All Posts": posts };
  
      return posts.reduce((groups, post) => {
        let key;
        switch (groupBy) {
          case "tags":
            post.tags.forEach((tag) => {
              if (!groups[tag]) groups[tag] = [];
              groups[tag].push(post);
            });
            return groups;
          case "month":
            key = new Date(post.date).toLocaleString("default", {
              month: "long",
              year: "numeric",
            });
            break;
          case "year":
            key = new Date(post.date).getFullYear().toString();
            break;
        }
        if (groupBy !== "tags") {
          if (!groups[key]) groups[key] = [];
          groups[key].push(post);
        }
        return groups;
      }, {});
    }
  
    paginatePosts(posts, page = this.currentPage) {
      const startIndex = (page - 1) * this.postsPerPage;
      return posts.slice(startIndex, startIndex + this.postsPerPage);
    }
  
    generatePostsPage() {
      const sortedPosts = this.sortPosts(this.posts);
      const groupedPosts = this.groupPosts(sortedPosts);
  
      let postsHtml = "";
      for (const [group, posts] of Object.entries(groupedPosts)) {
        postsHtml += `<h2>${group}</h2>`;
        const paginatedPosts = this.paginatePosts(posts);
        postsHtml += paginatedPosts
          .map(
            (post) => `
        <article>
          <h3><a href="#" onclick="app.showPost('${post.filename}')">${
              post.title
            }</a></h3>
          <p><i class="far fa-calendar-alt"></i> ${this.formatDate(post.date)}</p>
          <p>${post.description || ""}</p>
          <p>${this.generateTagsHtml(post.tags)}</p>
        </article>
      `
          )
          .join("");
  
        postsHtml += this.generatePagination(posts.length);
      }
  
      this.postsHtml = `
      ${this.generateBreadcrumb(["Posts"])}
      <h1>Blog Posts</h1>
      <div>
        <label><i class="fas fa-sort"></i> Sort by: 
          <select onchange="app.changeSort(this.value)">
            <option value="date" ${
              this.currentSort === "date" ? "selected" : ""
            }>Date</option>
            <option value="title" ${
              this.currentSort === "title" ? "selected" : ""
            }>Title</option>
          </select>
        </label>
        <label><i class="fas fa-layer-group"></i> Group by: 
          <select onchange="app.changeGroup(this.value)">
            <option value="none" ${
              this.currentGroup === "none" ? "selected" : ""
            }>None</option>
            <option value="tags" ${
              this.currentGroup === "tags" ? "selected" : ""
            }>Tags</option>
            <option value="month" ${
              this.currentGroup === "month" ? "selected" : ""
            }>Month</option>
            <option value="year" ${
              this.currentGroup === "year" ? "selected" : ""
            }>Year</option>
          </select>
        </label>
      </div>
      ${postsHtml}
      <p><a href="#" onclick="app.generateHomePage()"><i class="fas fa-home"></i> Back to Home</a></p>
    `;
  
      this.container.innerHTML = this.postsHtml;
    }
    generatePagination(totalPosts) {
      const totalPages = Math.ceil(totalPosts / this.postsPerPage);
      let paginationHtml = '<div class="pagination">';
  
      for (let i = 1; i <= totalPages; i++) {
        if (i === this.currentPage) {
          paginationHtml += `<span>${i}</span>`;
        } else {
          paginationHtml += `<a href="#" onclick="app.changePage(${i})">${i}</a>`;
        }
      }
  
      paginationHtml += "</div>";
      return paginationHtml;
    }
  
    changeSort(sortBy) {
      this.currentSort = sortBy;
      this.generatePostsPage();
    }
  
    changeGroup(groupBy) {
      this.currentGroup = groupBy;
      this.currentPage = 1; // Reset to first page when changing grouping
      this.generatePostsPage();
    }
  
    changePage(page) {
      this.currentPage = page;
      this.generatePostsPage();
    }
  
    generatePostPages() {
      for (const post of this.posts) {
        post.html = `
          <article>
            ${this.generateBreadcrumb(["Posts", post.title])}
            <h1>${post.title}</h1>
            <p>Date: ${post.date}</p>
            <p>Author: ${this.config.author}</p>
            <p>Tags: ${(post.tags || [])
              .map(
                (tag) => `<a href="#" onclick="app.showTag('${tag}')">${tag}</a>`
              )
              .join(", ")}</p>
            <div>${post.content}</div>
            <p><a href="#" onclick="app.showPostsPage()">Back to Posts</a></p>
          </article>
        `;
      }
    }
  
    generateTagPages() {
      for (const [tag, posts] of Object.entries(this.tags)) {
        this.tags[tag].html = `
          ${this.generateBreadcrumb(["Tags", tag])}
          <h1>Posts tagged with ${tag}</h1>
          ${posts
            .map(
              (post) => `
            <article>
              <h2><a href="#" onclick="app.showPost('${post.filename}')">${
                post.title
              }</a></h2>
              <p>Date: ${post.date}</p>
              <p>${post.description || ""}</p>
            </article>
          `
            )
            .join("")}
          <p><a href="#" onclick="app.showPostsPage()">Back to Posts</a></p>
        `;
      }
    }
  
    showAboutPage() {
      this.container.innerHTML = this.aboutHtml;
    }
  
    showPostsPage() {
      this.generatePostsPage();
    }
  
    formatDate(dateString) {
      const options = { year: "numeric", month: "long", day: "numeric" };
      return new Date(dateString).toLocaleDateString(undefined, options);
    }
  
    generateTagsHtml(tags) {
      return tags
        .map(
          (tag) =>
            `<span class="tag" onclick="app.showTag('${tag}')">${tag}</span>`
        )
        .join(" ");
    }
  
    showPost(filename) {
      const post = this.posts.find((p) => p.filename === filename);
      if (post) {
        this.container.innerHTML = post.html;
      } else {
        this.showErrorPage(`Post "${filename}" not found.`);
      }
    }
  
    showTag(tag) {
      if (this.tags[tag]) {
        this.container.innerHTML = this.tags[tag].html;
      } else {
        this.showErrorPage(`Tag "${tag}" not found.`);
      }
    }
  
    showErrorPage(message) {
      const errorHtml = `
        ${this.generateBreadcrumb(["Error"])}
        <div class="error-page">
          <h1>Error</h1>
          <p>${message}</p>
          <p><a href="#" onclick="app.generateHomePage()">Return to Home</a></p>
        </div>
      `;
      this.container.innerHTML = errorHtml;
    }
  
    generateBreadcrumb(path = []) {
      const breadcrumbItems = [
        { label: "Home", onClick: "app.generateHomePage()" },
        ...path.map((item, index) => ({
          label: item,
          onClick:
            index === path.length - 1
              ? null
              : item === "Posts"
              ? "app.showPostsPage()"
              : `app.showTag('${item}')`,
        })),
      ];
  
      const breadcrumbHtml = breadcrumbItems
        .map((item, index) => {
          if (index === breadcrumbItems.length - 1) {
            return `<span class="breadcrumb-item current">${item.label}</span>`;
          } else {
            return `<a href="#" class="breadcrumb-item" onclick="${item.onClick}">${item.label}</a>`;
          }
        })
        .join(" &gt; ");
  
      return `
        <nav class="breadcrumb">
          ${breadcrumbHtml}
        </nav>
      `;
    }
  
    async generate() {
      try {
        await this.fetchConfig();
        await this.fetchMarkdownFiles();
        this.generatePages();
        this.generateHomePage(); // Show home page by default
      } catch (error) {
        console.error("Error generating blog:", error);
        this.showErrorPage(
          "An error occurred while generating the blog. Please try again later."
        );
      }
    }
  }
  