const LinuxVirusMarkdown = (() => {
  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * Render a markdown string to an HTML string.
   * Supports: **bold**, *italic*, `code`, and newlines → <br>.
   */
  function render(text) {
    let html = escapeHtml(text);
    // **bold**
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    // *italic* (not preceded/followed by *)
    html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");
    // `inline code`
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    // newlines
    html = html.replace(/\n/g, "<br>");
    return html;
  }

  return { render };
})();
