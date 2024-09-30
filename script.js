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
    this.totalPosts = 0;
    this.currentSort = "date";
    this.currentGroup = "none";
    this.allPostsMetadata = []; // New property to store all posts metadata
  }

  async fetchAllPostsMetadata() {
    const apiUrl = `https://api.github.com/repos/${this.githubUsername}/${this.githubRepo}/contents`;
    try {
      const response = await fetch(apiUrl);
      const files = await response.json();
      const markdownFiles = files.filter(
        (file) =>
          file.name.endsWith(".md") &&
          !["readme.md", "config.md"].includes(file.name.toLowerCase())
      );

      this.allPostsMetadata = await Promise.all(
        markdownFiles.map(async (file) => {
          const metadata = await this.fetchFileMetadata(file.download_url);
          return {
            filename: file.name,
            ...metadata,
            contentUrl: file.download_url,
          };
        })
      );

      this.totalPosts = this.allPostsMetadata.length;
    } catch (error) {
      console.error("Error fetching all posts metadata:", error);
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

  async fetchMarkdownFiles() {
    const apiUrl = `https://api.github.com/repos/${this.githubUsername}/${this.githubRepo}/contents`;
    try {
      const response = await fetch(apiUrl);
      const files = await response.json();
      this.totalPosts = files.filter(
        (file) =>
          file.name.endsWith(".md") &&
          !["readme.md", "config.md"].includes(file.name.toLowerCase())
      ).length;
      await this.fetchPostsForPage(this.currentPage);
    } catch (error) {
      console.error("Error fetching files:", error);
      this.showErrorPage("Failed to fetch blog posts. Please try again later.");
    }
  }

  async fetchPostsForPage(page) {
    const start = (page - 1) * this.postsPerPage;
    const end = start + this.postsPerPage;

    // Sort all posts metadata
    const sortedPosts = this.sortPosts(this.allPostsMetadata);

    // Get the slice of posts for the current page
    this.posts = sortedPosts.slice(start, end);
  }

  async fetchFileMetadata(url) {
    const content = await this.fetchFileContent(url);
    const [, frontmatter] = content.split("---");
    return this.parseFrontmatter(frontmatter);
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

  generatePages() {
    this.generateHomePage();
    this.generateAboutPage();
    this.generatePostsPage();
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

  generatePostsPage() {
    const groupedPosts = this.groupPosts(this.posts);

    let postsHtml = "";
    for (const [group, posts] of Object.entries(groupedPosts)) {
      postsHtml += `<h2>${group}</h2>`;
      postsHtml += posts
        .map(
          (post) => `
        <article>
          <h3><a href="#" onclick="app.showPost('${post.filename}')">${
            post.title
          }</a></h3>
          <p><i class="far fa-calendar-alt"></i> ${this.formatDate(
            post.date
          )}</p>
          <p>${post.description || ""}</p>
          <p>${this.generateTagsHtml(post.tags)}</p>
        </article>
      `
        )
        .join("");
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
      ${this.generatePagination()}
      <p><a href="#" onclick="app.generateHomePage()"><i class="fas fa-home"></i> Back to Home</a></p>
    `;

    this.container.innerHTML = this.postsHtml;
  }

  async showPost(filename) {
    const post = this.posts.find((p) => p.filename === filename);
    if (post) {
      if (!post.content) {
        this.container.innerHTML = "<p>Loading post...</p>";
        try {
          const content = await this.fetchFileContent(post.contentUrl);
          const [, , markdown] = content.split("---");
          post.content = marked.parse(markdown);
        } catch (error) {
          console.error(`Error fetching post content: ${error}`);
          this.showErrorPage(
            `Failed to load post "${filename}". Please try again later.`
          );
          return;
        }
      }
      this.container.innerHTML = this.generatePostHtml(post);
    } else {
      this.showErrorPage(`Post "${filename}" not found.`);
    }
  }

  generatePostHtml(post) {
    return `
      <article>
        ${this.generateBreadcrumb(["Posts", post.title])}
        <h1>${post.title}</h1>
        <p><i class="far fa-calendar-alt"></i> ${this.formatDate(post.date)}</p>
        <p>Author: ${this.config.author}</p>
        <p>${this.generateTagsHtml(post.tags || [])}</p>
        <div>${post.content}</div>
        <p><a href="#" onclick="app.showPostsPage()"><i class="fas fa-arrow-left"></i> Back to Posts</a></p>
      </article>
    `;
  }

  showAboutPage() {
    this.container.innerHTML = this.aboutHtml;
  }

  showPostsPage() {
    this.generatePostsPage();
  }

  showTag(tag) {
    this.currentGroup = "tags";
    this.generatePostsPage();
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

  sortPosts(posts, sortBy = this.currentSort) {
    return [...posts].sort((a, b) => {
      if (sortBy === "title") {
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

  generatePagination() {
    const totalPages = Math.ceil(this.totalPosts / this.postsPerPage);
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

  async changePage(page) {
    this.currentPage = page;
    await this.fetchPostsForPage(page);
    this.generatePostsPage();
  }

  async changeSort(sortBy) {
    this.currentSort = sortBy;
    this.currentPage = 1; // Reset to first page when changing sort
    await this.fetchPostsForPage(this.currentPage);
    this.generatePostsPage();
  }

  async changeGroup(groupBy) {
    this.currentGroup = groupBy;
    this.currentPage = 1; // Reset to first page when changing grouping
    await this.fetchPostsForPage(this.currentPage);
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
  async generate() {
    try {
      await this.fetchConfig();
      await this.fetchAllPostsMetadata(); // Fetch all posts metadata first
      await this.fetchPostsForPage(this.currentPage); // Fetch posts for the first page
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
